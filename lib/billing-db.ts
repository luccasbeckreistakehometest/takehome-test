import { randomUUID } from "crypto";
import { addColumnIfMissing, db, tenantColumn } from "./db";
import { billingAgencyId, HOUSE_AGENCY_ID } from "./tenancy-rules";
import { nextPeriodEnd, parseSubRef, preapprovalEffect, subscriptionExpired } from "./subscription-rules";
import {
  actionCost,
  entryPlanId,
  getCoinPack,
  getPlan,
  isBillingPeriod,
  isPaidPlan,
  PERIOD_DISCOUNT,
  periodPrice,
  type AccountType,
  type BillingPeriod,
  type Plan,
} from "./plans";

// Billing: carteira de coins + assinatura pré-paga + histórico + ledger de uso.
//
// Regras:
// - Plano pago só entra por pagamento confirmado (webhook do Mercado Pago) ou
//   por concessão do admin. É pré-pago, por período, SEM renovação
//   automática: no vencimento (renewsAt) a conta volta para o plano grátis.
// - A carteira tem dois baldes: `planCoins` (cota do mês, recarregada a cada
//   mês de plano ativo, não acumula) e `coins` (comprados ou concedidos, não
//   expiram). O uso consome primeiro a cota do plano.
// - Toda conta nova recebe a cota do plano grátis na criação.
// - O "enforcement" (bloquear IA sem saldo) vem de BILLING_ENFORCED=true ou
//   da flag do admin; desligado, o uso só é registrado.

export type SubscriptionStatus = "active" | "canceled";

export type Subscription = {
  accountType: AccountType;
  accountId: string; // "agency" para a agência da casa; senão id do cliente/prof
  planId: string;
  period: BillingPeriod;
  status: SubscriptionStatus;
  startedAt: string;
  renewsAt: string;
  lastRefillAt: string | null;
  // cobrança automática no cartão (MP); cancelada = vale até renewsAt
  recurring?: boolean;
  cancelAtPeriodEnd?: boolean;
  mpPreapprovalId?: string | null;
  mpStatus?: string;
};

export type Wallet = {
  accountType: AccountType;
  accountId: string;
  coins: number; // saldo total (cota do plano + comprados)
  planCoins: number;
  purchasedCoins: number;
};

db.exec(`
  CREATE TABLE IF NOT EXISTS subscriptions (
    accountType TEXT NOT NULL,
    accountId TEXT NOT NULL,
    planId TEXT NOT NULL,
    period TEXT NOT NULL DEFAULT 'monthly',
    status TEXT NOT NULL DEFAULT 'active',
    startedAt TEXT NOT NULL,
    renewsAt TEXT NOT NULL,
    PRIMARY KEY (accountType, accountId)
  );
  CREATE TABLE IF NOT EXISTS wallets (
    accountType TEXT NOT NULL,
    accountId TEXT NOT NULL,
    coins REAL NOT NULL DEFAULT 0,
    PRIMARY KEY (accountType, accountId)
  );
  CREATE TABLE IF NOT EXISTS billing_transactions (
    id TEXT PRIMARY KEY,
    accountType TEXT NOT NULL,
    accountId TEXT NOT NULL,
    kind TEXT NOT NULL,           -- subscription | coin_purchase | usage | refund | grant | refill | plan_expired | payment_refund
    description TEXT NOT NULL DEFAULT '',
    amount REAL NOT NULL DEFAULT 0,   -- BRL (receita) quando aplicável
    coins REAL NOT NULL DEFAULT 0,    -- variação de coins (+entra / -consumo)
    createdAt TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_tx_account ON billing_transactions(accountType, accountId, createdAt);
  CREATE TABLE IF NOT EXISTS billing_flags (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    enforced INTEGER NOT NULL DEFAULT 0
  );
  INSERT OR IGNORE INTO billing_flags (id, enforced) VALUES (1, 0);
  CREATE TABLE IF NOT EXISTS mp_payments (
    id TEXT PRIMARY KEY,
    createdAt TEXT NOT NULL
  );
`);
addColumnIfMissing("subscriptions", "lastRefillAt", "TEXT");
// Assinatura recorrente no cartão (Mercado Pago preapproval)
addColumnIfMissing("subscriptions", "recurring", "INTEGER NOT NULL DEFAULT 0");
addColumnIfMissing("subscriptions", "cancelAtPeriodEnd", "INTEGER NOT NULL DEFAULT 0");
addColumnIfMissing("subscriptions", "mpPreapprovalId", "TEXT");
addColumnIfMissing("subscriptions", "mpStatus", "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing("wallets", "planCoins", "REAL NOT NULL DEFAULT 0");
addColumnIfMissing("billing_transactions", "ref", "TEXT");
addColumnIfMissing("mp_payments", "status", "TEXT NOT NULL DEFAULT 'credited'");
addColumnIfMissing("mp_payments", "externalReference", "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing("mp_payments", "accountType", "TEXT");
addColumnIfMissing("mp_payments", "accountId", "TEXT");
addColumnIfMissing("mp_payments", "amount", "REAL NOT NULL DEFAULT 0");
addColumnIfMissing("mp_payments", "mpStatus", "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing("mp_payments", "detail", "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing("mp_payments", "updatedAt", "TEXT");
// cobrança recorrente: o pagamento do MP que ela gerou e a assinatura dela
// (é por aqui que um estorno/chargeback do pagamento acha o que desfazer)
addColumnIfMissing("mp_payments", "linkedPaymentId", "TEXT");
addColumnIfMissing("mp_payments", "preapprovalId", "TEXT");
for (const table of ["subscriptions", "wallets", "billing_transactions", "mp_payments"]) tenantColumn(table);

// Agência de uma conta de billing: a própria (conta de agência), a da marca
// ou a do profissional (null = freelancer do marketplace aberto).
const tableHas = (table: string) =>
  Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table));
export function accountAgencyId(accountType: AccountType | null | undefined, accountId: string | null | undefined): string | null {
  return billingAgencyId(accountType, accountId, {
    client: (id) =>
      ((db.prepare("SELECT agencyId FROM clients WHERE id = ?").get(id) as { agencyId: string | null } | undefined)?.agencyId ?? null),
    professional: (id) =>
      tableHas("professionals")
        ? ((db.prepare("SELECT agencyId FROM professionals WHERE id = ?").get(id) as { agencyId: string | null } | undefined)?.agencyId ?? null)
        : null,
  });
}

const nowIso = () => new Date().toISOString();

export function addMonthsIso(fromIso: string, months: number): string {
  const d = new Date(fromIso);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  // 31/01 + 1 mês = último dia de fevereiro (não 03/03)
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d.toISOString();
}

export function isEnforced(): boolean {
  if (process.env.BILLING_ENFORCED === "true") return true;
  const row = db.prepare("SELECT enforced FROM billing_flags WHERE id = 1").get() as
    | { enforced: number }
    | undefined;
  return row?.enforced === 1;
}
// Quem é bloqueado quando o saldo acaba. Plano grátis/de entrada é SEMPRE
// bloqueado — cadastro aberto não pode virar IA sem cota enquanto a chave
// global está desligada. Planos pagos seguem a chave global
// (BILLING_ENFORCED ou o admin). A agência da casa (operação do dono) só é
// bloqueada com a chave global ligada.
export function enforcedFor(accountType: AccountType, accountId: string, plan: Plan | undefined): boolean {
  if (isEnforced()) return true;
  if (accountType === "agency" && accountId === HOUSE_AGENCY_ID) return false;
  return !isPaidPlan(plan);
}

// Faixa de gasto de IA de uma conta: a casa (operação do dono), plano pago
// vigente ou grátis/entrada. Os tetos diários por conta e o "bolso" do
// grátis (lib/ai-spend.ts) dependem disso.
export type SpendTier = "house" | "paid" | "free";
export function accountSpendTier(accountType: AccountType, accountId: string): SpendTier {
  if (accountType === "agency" && accountId === HOUSE_AGENCY_ID) return "house";
  return isPaidPlan(getPlan(getSubscription(accountType, accountId).planId)) ? "paid" : "free";
}

export function setEnforced(on: boolean): void {
  db.prepare("UPDATE billing_flags SET enforced = ? WHERE id = 1").run(on ? 1 : 0);
}

function recordTx(input: {
  accountType: AccountType;
  accountId: string;
  kind: string;
  description: string;
  amount?: number;
  coins?: number;
  ref?: string | null;
  at?: string;
}): string {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO billing_transactions (id, agencyId, accountType, accountId, kind, description, amount, coins, ref, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    accountAgencyId(input.accountType, input.accountId),
    input.accountType,
    input.accountId,
    input.kind,
    input.description,
    input.amount ?? 0,
    input.coins ?? 0,
    input.ref ?? null,
    input.at ?? nowIso()
  );
  return id;
}

// ---------- Carteira ----------
type WalletRow = { accountType: AccountType; accountId: string; coins: number; planCoins: number };

function walletRow(accountType: AccountType, accountId: string): WalletRow {
  const row = db
    .prepare("SELECT accountType, accountId, coins, planCoins FROM wallets WHERE accountType = ? AND accountId = ?")
    .get(accountType, accountId) as WalletRow | undefined;
  return row ?? { accountType, accountId, coins: 0, planCoins: 0 };
}

function toWallet(row: WalletRow): Wallet {
  const planCoins = Number(row.planCoins ?? 0);
  const purchasedCoins = Number(row.coins ?? 0);
  return {
    accountType: row.accountType,
    accountId: row.accountId,
    coins: planCoins + purchasedCoins,
    planCoins,
    purchasedCoins,
  };
}

function ensureWallet(accountType: AccountType, accountId: string): void {
  db.prepare("INSERT OR IGNORE INTO wallets (accountType, accountId, agencyId, coins, planCoins) VALUES (?, ?, ?, 0, 0)").run(
    accountType,
    accountId,
    accountAgencyId(accountType, accountId)
  );
}

function setPlanCoins(accountType: AccountType, accountId: string, planCoins: number): void {
  ensureWallet(accountType, accountId);
  db.prepare("UPDATE wallets SET planCoins = ? WHERE accountType = ? AND accountId = ?").run(
    planCoins,
    accountType,
    accountId
  );
}

export function getWallet(accountType: AccountType, accountId: string): Wallet {
  refreshAccount(accountType, accountId);
  return toWallet(walletRow(accountType, accountId));
}

// Coins que não expiram (compra confirmada ou concessão do admin). Aceita
// valor negativo para estornos.
export function addCoins(
  accountType: AccountType,
  accountId: string,
  coins: number,
  description: string,
  kind: "coin_purchase" | "grant" | "payment_refund" = "grant",
  amount = 0,
  ref: string | null = null
): Wallet {
  return db
    .transaction(() => {
      ensureWallet(accountType, accountId);
      db.prepare("UPDATE wallets SET coins = coins + ? WHERE accountType = ? AND accountId = ?").run(
        coins,
        accountType,
        accountId
      );
      recordTx({ accountType, accountId, kind, description, coins, amount, ref });
      return toWallet(walletRow(accountType, accountId));
    })
    .immediate();
}

// ---------- Assinatura (pré-paga) ----------
type RawSubscriptionRow = Omit<Subscription, "lastRefillAt" | "recurring" | "cancelAtPeriodEnd"> & {
  lastRefillAt: string | null;
  recurring?: number | boolean | null;
  cancelAtPeriodEnd?: number | boolean | null;
};
type SubscriptionRow = Omit<Subscription, "lastRefillAt"> & { lastRefillAt: string | null };

function subscriptionRow(accountType: AccountType, accountId: string): SubscriptionRow | undefined {
  const row = db
    .prepare("SELECT * FROM subscriptions WHERE accountType = ? AND accountId = ?")
    .get(accountType, accountId) as RawSubscriptionRow | undefined;
  if (!row) return undefined;
  return {
    ...row,
    recurring: Number(row.recurring ?? 0) === 1,
    cancelAtPeriodEnd: Number(row.cancelAtPeriodEnd ?? 0) === 1,
    mpPreapprovalId: row.mpPreapprovalId ?? null,
    mpStatus: row.mpStatus ?? "",
  };
}

function writeSubscription(sub: Subscription): void {
  db.prepare(
    `INSERT INTO subscriptions (accountType, accountId, agencyId, planId, period, status, startedAt, renewsAt, lastRefillAt, recurring, cancelAtPeriodEnd, mpPreapprovalId, mpStatus)
     VALUES (@accountType, @accountId, @agencyId, @planId, @period, @status, @startedAt, @renewsAt, @lastRefillAt, @recurring, @cancelAtPeriodEnd, @mpPreapprovalId, @mpStatus)
     ON CONFLICT(accountType, accountId) DO UPDATE SET agencyId=@agencyId, planId=@planId, period=@period, status=@status,
       startedAt=@startedAt, renewsAt=@renewsAt, lastRefillAt=@lastRefillAt, recurring=@recurring,
       cancelAtPeriodEnd=@cancelAtPeriodEnd, mpPreapprovalId=@mpPreapprovalId, mpStatus=@mpStatus`
  ).run({
    ...sub,
    agencyId: accountAgencyId(sub.accountType, sub.accountId),
    recurring: sub.recurring ? 1 : 0,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd ? 1 : 0,
    mpPreapprovalId: sub.mpPreapprovalId ?? null,
    mpStatus: sub.mpStatus ?? "",
  });
}

function planQuota(plan: Plan): number {
  return plan.unlimited ? 0 : plan.aiCoinsPerMonth;
}

function startEntryPlan(accountType: AccountType, accountId: string, at: string, reason: "signup" | "expired", previous?: Plan): void {
  const entry = getPlan(entryPlanId(accountType))!;
  writeSubscription({
    accountType,
    accountId,
    planId: entry.id,
    period: "monthly",
    status: "active",
    startedAt: at,
    renewsAt: addMonthsIso(at, 1),
    lastRefillAt: at,
  });
  setPlanCoins(accountType, accountId, planQuota(entry));
  recordTx({
    accountType,
    accountId,
    kind: reason === "signup" ? "grant" : "plan_expired",
    description:
      reason === "signup"
        ? `Cota do plano ${entry.name}`
        : `Plano ${previous?.name ?? ""} venceu — conta voltou para o ${entry.name}`,
    coins: planQuota(entry),
    at,
  });
}

// Projeção pura do calendário da conta: o que a assinatura e a cota do plano
// SERIAM agora (plano grátis se não houver linha, vencimento de plano pago,
// recarga mensal). Usada para gravar (refreshAccount) e para leituras sem
// efeito colateral (rotas GET).
type AccountProjection = {
  sub: Subscription;
  planCoins: number;
  change: null | { kind: "signup" | "expired" | "refill"; plan: Plan; previous?: Plan };
};

function projectAccount(
  accountType: AccountType,
  accountId: string,
  row: SubscriptionRow | undefined,
  currentPlanCoins: number,
  at: string
): AccountProjection {
  const entry = getPlan(entryPlanId(accountType))!;
  const fresh = (kind: "signup" | "expired", previous?: Plan): AccountProjection => ({
    sub: {
      accountType,
      accountId,
      planId: entry.id,
      period: "monthly",
      status: "active",
      startedAt: at,
      renewsAt: addMonthsIso(at, 1),
      lastRefillAt: at,
    },
    planCoins: planQuota(entry),
    change: { kind, plan: entry, previous },
  });
  if (!row) return fresh("signup");
  const plan = getPlan(row.planId);
  if (!plan || plan.accountType !== accountType) return fresh("expired", plan);
  if (isPaidPlan(plan) && subscriptionExpired({ renewsAt: row.renewsAt, recurring: Boolean(row.recurring), cancelAtPeriodEnd: Boolean(row.cancelAtPeriodEnd) }, new Date(at))) {
    return fresh("expired", plan);
  }
  const current: Subscription = { ...row, period: isBillingPeriod(row.period) ? row.period : "monthly" };
  const lastRefill = row.lastRefillAt ?? row.startedAt;
  // Plano pago só recarrega pelo calendário DENTRO do período já pago (plano
  // trimestral/anual recarrega todo mês). No fim do período quem recarrega é a
  // cobrança aprovada — nada de cota nova na carência nem antes da renovação.
  const refillDue = (date: string) => addMonthsIso(date, 1) <= at && (!isPaidPlan(plan) || addMonthsIso(date, 1) < row.renewsAt);
  if (!refillDue(lastRefill)) return { sub: current, planCoins: currentPlanCoins, change: null };
  // Avança em meses inteiros a partir da última recarga (o dia do mês fica estável).
  let next = lastRefill;
  while (refillDue(next)) next = addMonthsIso(next, 1);
  return {
    sub: {
      ...current,
      status: "active",
      lastRefillAt: next,
      // plano grátis não vence: o "renova em" acompanha a próxima recarga
      renewsAt: isPaidPlan(plan) ? row.renewsAt : addMonthsIso(next, 1),
    },
    planCoins: planQuota(plan),
    change: { kind: "refill", plan },
  };
}

// Aplica o calendário da conta (preguiçoso: chamado nos caminhos que gravam —
// cobrança, pagamento, cadastro — e no tick do scheduler). Idempotente.
export function refreshAccount(accountType: AccountType, accountId: string, now: Date = new Date()): void {
  const at = now.toISOString();
  db.transaction(() => {
    const row = subscriptionRow(accountType, accountId);
    const projection = projectAccount(accountType, accountId, row, walletRow(accountType, accountId).planCoins, at);
    const change = projection.change;
    if (!change) return;
    if (change.kind === "refill") {
      writeSubscription(projection.sub);
      setPlanCoins(accountType, accountId, projection.planCoins);
      recordTx({
        accountType,
        accountId,
        kind: "refill",
        description: `Cota mensal do plano ${change.plan.name}`,
        coins: projection.planCoins,
        at,
      });
      return;
    }
    startEntryPlan(accountType, accountId, at, change.kind, change.previous);
  }).immediate();
}

// Leitura sem gravar nada (para rotas GET).
export function viewAccount(
  accountType: AccountType,
  accountId: string,
  now: Date = new Date()
): { subscription: Subscription; wallet: Wallet } {
  const row = subscriptionRow(accountType, accountId);
  const wallet = walletRow(accountType, accountId);
  const projection = projectAccount(accountType, accountId, row, Number(wallet.planCoins ?? 0), now.toISOString());
  return { subscription: projection.sub, wallet: toWallet({ ...wallet, planCoins: projection.planCoins }) };
}

// Tick do scheduler: expira planos vencidos e recarrega cotas de todas as
// contas com assinatura (o acesso também faz isso, de forma preguiçosa).
export function refreshAllAccounts(now: Date = new Date()): number {
  // Inclui contas antigas que ainda não têm assinatura gravada.
  const hasProfessionals = Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'professionals'").get());
  const rows = db
    .prepare(
      `SELECT accountType, accountId FROM subscriptions
       UNION SELECT 'client', id FROM clients
       ${hasProfessionals ? "UNION SELECT 'professional', id FROM professionals" : ""}
       UNION SELECT 'agency', id FROM agencies`
    )
    .all() as { accountType: AccountType; accountId: string }[];
  for (const row of rows) refreshAccount(row.accountType, row.accountId, now);
  return rows.length;
}

export function getSubscription(accountType: AccountType, accountId: string): Subscription {
  refreshAccount(accountType, accountId);
  const row = subscriptionRow(accountType, accountId)!;
  return { ...row, period: isBillingPeriod(row.period) ? row.period : "monthly" };
}

// Conta nova: plano grátis + cota do mês (idempotente).
export function startAccount(accountType: AccountType, accountId: string): Wallet {
  return getWallet(accountType, accountId);
}

// Ativa um plano pago confirmado (pagamento ou concessão do admin). Mesmo
// plano ainda vigente → estende a partir do vencimento atual (renovação
// antecipada). Outro plano → começa agora.
function activatePlan(input: {
  accountType: AccountType;
  accountId: string;
  plan: Plan;
  period: BillingPeriod;
  months?: number;
  amount: number;
  description: string;
  ref?: string | null;
  kind?: "subscription" | "grant";
}): Subscription {
  const at = nowIso();
  const months = input.months ?? PERIOD_DISCOUNT[input.period].months;
  const current = subscriptionRow(input.accountType, input.accountId);
  const extending = Boolean(current && current.planId === input.plan.id && current.renewsAt > at && isPaidPlan(input.plan));
  const sub: Subscription = {
    // pagamento avulso do mesmo plano não desliga a renovação no cartão
    recurring: extending ? current!.recurring : false,
    cancelAtPeriodEnd: extending ? current!.cancelAtPeriodEnd : false,
    mpPreapprovalId: extending ? current!.mpPreapprovalId : null,
    mpStatus: extending ? current!.mpStatus : "",
    accountType: input.accountType,
    accountId: input.accountId,
    planId: input.plan.id,
    period: input.period,
    status: "active",
    startedAt: extending ? current!.startedAt : at,
    renewsAt: addMonthsIso(extending ? current!.renewsAt : at, months),
    lastRefillAt: extending ? current!.lastRefillAt : at,
  };
  writeSubscription(sub);
  if (!extending) setPlanCoins(input.accountType, input.accountId, planQuota(input.plan));
  recordTx({
    accountType: input.accountType,
    accountId: input.accountId,
    kind: input.kind ?? "subscription",
    description: input.description,
    amount: input.amount,
    coins: extending ? 0 : planQuota(input.plan),
    ref: input.ref ?? null,
    at,
  });
  return sub;
}

// Troca para um plano GRÁTIS (a única troca sem pagamento). Plano pago ainda
// vigente não é derrubado por engano: ele volta ao grátis no vencimento.
export function switchToFreePlan(input: {
  accountType: AccountType;
  accountId: string;
  planId: string;
}): { ok: true; subscription: Subscription } | { ok: false; status: number; error: string } {
  const plan = getPlan(input.planId);
  if (!plan || plan.accountType !== input.accountType) {
    return { ok: false, status: 400, error: "Plano inválido para este tipo de conta." };
  }
  if (isPaidPlan(plan)) {
    return { ok: false, status: 402, error: "Planos pagos são contratados pelo pagamento (Mercado Pago)." };
  }
  const current = getSubscription(input.accountType, input.accountId);
  const currentPlan = getPlan(current.planId);
  if (currentPlan && isPaidPlan(currentPlan)) {
    return {
      ok: false,
      status: 409,
      error: `Seu plano ${currentPlan.name} está pago até ${current.renewsAt.slice(0, 10)}. Depois disso a conta volta sozinha para o plano grátis.`,
    };
  }
  return { ok: true, subscription: current };
}

// Admin: define o plano de uma conta sem pagamento (cortesia, parceria,
// agência da casa). Plano grátis = volta ao grátis agora.
export function adminSetPlan(input: {
  accountType: AccountType;
  accountId: string;
  planId: string;
  months: number;
}): Subscription {
  const plan = getPlan(input.planId);
  if (!plan || plan.accountType !== input.accountType) throw new Error("Plano inválido para este tipo de conta.");
  return db
    .transaction(() => {
      if (!isPaidPlan(plan)) {
        startEntryPlan(input.accountType, input.accountId, nowIso(), "expired", getPlan(subscriptionRow(input.accountType, input.accountId)?.planId ?? ""));
        return getSubscription(input.accountType, input.accountId);
      }
      const months = Math.max(1, Math.min(36, Math.floor(input.months)));
      return activatePlan({
        accountType: input.accountType,
        accountId: input.accountId,
        plan,
        period: "monthly",
        months,
        amount: 0,
        kind: "grant",
        description: `Plano ${plan.name} concedido pelo admin (${months} ${months === 1 ? "mês" : "meses"})`,
      });
    })
    .immediate();
}

// ---------- Metering de uso ----------
export type ChargeResult = {
  ok: boolean;
  charged: number;
  balance: number;
  reason?: string;
  // quanto saiu de cada balde (para o estorno devolver no mesmo lugar)
  fromPlan: number;
  fromPurchased: number;
};

// Reserva (debita) coins antes de uma ação de IA. Se a ação falhar, chame
// refundUsage com o resultado. Plano ilimitado não debita. Com enforcement
// ligado e saldo insuficiente, recusa.
export function chargeUsage(input: {
  accountType: AccountType;
  accountId: string;
  action: string;
  units?: number;
}): ChargeResult {
  return db
    .transaction((): ChargeResult => {
      const sub = getSubscription(input.accountType, input.accountId);
      const plan = getPlan(sub.planId);
      const row = walletRow(input.accountType, input.accountId);
      const balance = Number(row.planCoins) + Number(row.coins);
      if (plan?.unlimited) {
        recordTx({ ...input, kind: "usage", description: `IA: ${input.action} (plano ilimitado)`, coins: 0 });
        return { ok: true, charged: 0, balance, fromPlan: 0, fromPurchased: 0 };
      }
      const cost = actionCost(input.action) * Math.max(1, input.units ?? 1);
      if (cost <= 0) return { ok: true, charged: 0, balance, fromPlan: 0, fromPurchased: 0 };
      if (balance < cost && enforcedFor(input.accountType, input.accountId, plan)) {
        return {
          ok: false,
          charged: 0,
          balance,
          fromPlan: 0,
          fromPurchased: 0,
          reason: "Seus coins acabaram. Veja os planos ou compre um pacote de coins para continuar.",
        };
      }
      const fromPlan = Math.min(Math.max(0, Number(row.planCoins)), cost);
      const fromPurchased = cost - fromPlan;
      ensureWallet(input.accountType, input.accountId);
      db.prepare(
        "UPDATE wallets SET planCoins = planCoins - ?, coins = coins - ? WHERE accountType = ? AND accountId = ?"
      ).run(fromPlan, fromPurchased, input.accountType, input.accountId);
      recordTx({ ...input, kind: "usage", description: `IA: ${input.action}`, coins: -cost });
      return { ok: true, charged: cost, balance: balance - cost, fromPlan, fromPurchased };
    })
    .immediate();
}

// Devolve uma reserva de uso (a geração falhou: ninguém paga por erro).
export function refundUsage(
  account: { accountType: AccountType; accountId: string },
  action: string,
  charge: ChargeResult
): void {
  if (!charge.ok || charge.charged <= 0) return;
  db.transaction(() => {
    ensureWallet(account.accountType, account.accountId);
    db.prepare(
      "UPDATE wallets SET planCoins = planCoins + ?, coins = coins + ? WHERE accountType = ? AND accountId = ?"
    ).run(charge.fromPlan, charge.fromPurchased, account.accountType, account.accountId);
    recordTx({
      ...account,
      kind: "refund",
      description: `Estorno: ${action} falhou`,
      coins: charge.charged,
    });
  }).immediate();
}

export type BillingSummary = {
  plan: Plan | undefined;
  subscription: Subscription;
  wallet: Wallet;
  usageThisMonth: number;
  prepaid: true; // sem renovação automática
};

// Resumo para telas (GET): não grava nada.
export function billingSummary(accountType: AccountType, accountId: string): BillingSummary {
  const { subscription, wallet } = viewAccount(accountType, accountId);
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const usage = db
    .prepare(
      `SELECT COALESCE(SUM(-coins),0) as c FROM billing_transactions
       WHERE accountType = ? AND accountId = ? AND kind IN ('usage','refund') AND createdAt >= ?`
    )
    .get(accountType, accountId, monthStart.toISOString()) as { c: number };
  return {
    plan: getPlan(subscription.planId),
    subscription,
    wallet,
    usageThisMonth: Math.max(0, usage.c),
    prepaid: true,
  };
}

export type BillingTx = {
  id: string;
  accountType: AccountType;
  accountId: string;
  kind: string;
  description: string;
  amount: number;
  coins: number;
  ref: string | null;
  createdAt: string;
};

export function listTransactions(
  filter: { accountType?: AccountType; accountId?: string; agencyId?: string | null; limit?: number } = {}
): BillingTx[] {
  const where: string[] = [];
  const args: (string | number)[] = [];
  if (filter.agencyId) {
    where.push("agencyId = ?");
    args.push(filter.agencyId);
  }
  if (filter.accountType) {
    where.push("accountType = ?");
    args.push(filter.accountType);
  }
  if (filter.accountId) {
    where.push("accountId = ?");
    args.push(filter.accountId);
  }
  args.push(Math.min(500, filter.limit ?? 100));
  return db
    .prepare(
      `SELECT * FROM billing_transactions ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY createdAt DESC LIMIT ?`
    )
    .all(...args) as BillingTx[];
}

// Receita da plataforma (para o admin): só dinheiro que entrou de verdade
// (pagamentos confirmados menos estornos).
export function platformRevenue(agencyId?: string | null): { total: number; mrr: number; byKind: Record<string, number> } {
  const byAgency = agencyId ? "WHERE agencyId = ?" : "";
  const agencyArgs = agencyId ? [agencyId] : [];
  const rows = db
    .prepare(`SELECT kind, COALESCE(SUM(amount),0) as total FROM billing_transactions ${byAgency} GROUP BY kind`)
    .all(...agencyArgs) as { kind: string; total: number }[];
  const byKind: Record<string, number> = {};
  let total = 0;
  for (const r of rows) {
    byKind[r.kind] = r.total;
    total += r.total;
  }
  // MRR aproximado: preço mensal dos planos pagos vigentes pagos por pagamento
  const at = nowIso();
  const subs = db
    .prepare(`SELECT planId FROM subscriptions WHERE status = 'active' AND renewsAt > ? ${agencyId ? "AND agencyId = ?" : ""}`)
    .all(at, ...agencyArgs) as { planId: string }[];
  const mrr = subs.reduce((sum, s) => sum + (getPlan(s.planId)?.monthlyPrice ?? 0), 0);
  return { total, mrr, byKind };
}

export type AccountBillingRow = {
  agencyId: string | null;
  accountType: AccountType;
  accountId: string;
  planId: string;
  planName: string;
  renewsAt: string;
  coins: number;
  paid: boolean;
};

export function listAccountsBilling(agencyId?: string | null): AccountBillingRow[] {
  const rows = db
    .prepare(
      `SELECT s.agencyId, s.accountType, s.accountId, s.planId, s.renewsAt, COALESCE(w.coins,0) + COALESCE(w.planCoins,0) AS coins
       FROM subscriptions s LEFT JOIN wallets w ON w.accountType = s.accountType AND w.accountId = s.accountId
       ${agencyId ? "WHERE s.agencyId = ?" : ""}`
    )
    .all(...(agencyId ? [agencyId] : [])) as {
    agencyId: string | null;
    accountType: AccountType;
    accountId: string;
    planId: string;
    renewsAt: string;
    coins: number;
  }[];
  return rows.map((r) => {
    const plan = getPlan(r.planId);
    return { ...r, planName: plan?.name ?? r.planId, paid: isPaidPlan(plan) };
  });
}

// LGPD: ao excluir uma conta, os lançamentos financeiros ficam (contabilidade)
// mas perdem o vínculo com a pessoa.
export function anonymiseBillingAccount(accountType: AccountType, accountId: string): void {
  const alias = `removido-${randomUUID().slice(0, 8)}`;
  db.transaction(() => {
    db.prepare("UPDATE billing_transactions SET accountId = ? WHERE accountType = ? AND accountId = ?").run(
      alias,
      accountType,
      accountId
    );
    db.prepare("UPDATE mp_payments SET accountId = ? WHERE accountType = ? AND accountId = ?").run(
      alias,
      accountType,
      accountId
    );
    db.prepare("DELETE FROM subscriptions WHERE accountType = ? AND accountId = ?").run(accountType, accountId);
    db.prepare("DELETE FROM wallets WHERE accountType = ? AND accountId = ?").run(accountType, accountId);
  }).immediate();
}

export function exportBillingAccount(accountType: AccountType, accountId: string) {
  return {
    subscription: subscriptionRow(accountType, accountId) ?? null,
    wallet: toWallet(walletRow(accountType, accountId)),
    transactions: listTransactions({ accountType, accountId, limit: 500 }),
    payments: listPayments({ accountType, accountId }),
  };
}

// ---------- Pagamentos (Mercado Pago) ----------
export type PaymentRef =
  | { kind: "coins"; accountType: AccountType; accountId: string; packId: string }
  | { kind: "plan"; accountType: AccountType; accountId: string; planId: string; period: BillingPeriod };

const ACCOUNT_TYPES: AccountType[] = ["client", "professional", "agency"];

export function parsePaymentRef(ref: string): PaymentRef | null {
  const parts = (ref ?? "").split("|");
  const accountType = parts[1] as AccountType;
  if (!ACCOUNT_TYPES.includes(accountType) || !parts[2]) return null;
  if (parts[0] === "coins" && parts.length === 4 && getCoinPack(parts[3])) {
    return { kind: "coins", accountType, accountId: parts[2], packId: parts[3] };
  }
  if (parts[0] === "plan" && parts.length === 5 && isBillingPeriod(parts[4])) {
    const plan = getPlan(parts[3]);
    if (!plan || plan.accountType !== accountType || !isPaidPlan(plan)) return null;
    return { kind: "plan", accountType, accountId: parts[2], planId: plan.id, period: parts[4] };
  }
  return null;
}

// Preço esperado da referência (o valor pago precisa bater).
export function expectedAmount(ref: PaymentRef): number {
  if (ref.kind === "coins") return getCoinPack(ref.packId)!.price;
  return periodPrice(getPlan(ref.planId)!.monthlyPrice, ref.period);
}

// linked = pagamento gerado por uma cobrança da assinatura no cartão (quem
// credita é a cobrança `sub_<id>`; esta linha só registra o pagamento)
export type PaymentStatus = "credited" | "refunded" | "rejected" | "pending" | "invalid" | "linked";

export type PaymentRow = {
  id: string;
  agencyId?: string | null;
  status: PaymentStatus;
  mpStatus: string;
  externalReference: string;
  accountType: AccountType | null;
  accountId: string | null;
  amount: number;
  detail: string;
  linkedPaymentId?: string | null;
  preapprovalId?: string | null;
  createdAt: string;
  updatedAt: string | null;
};

export function getPaymentRow(id: string): PaymentRow | null {
  return (db.prepare("SELECT * FROM mp_payments WHERE id = ?").get(id) as PaymentRow | undefined) ?? null;
}

export function listPayments(
  filter: { accountType?: AccountType; accountId?: string; agencyId?: string | null; limit?: number } = {}
): PaymentRow[] {
  const where: string[] = [];
  const args: (string | number)[] = [];
  if (filter.agencyId) {
    where.push("agencyId = ?");
    args.push(filter.agencyId);
  }
  if (filter.accountType) {
    where.push("accountType = ?");
    args.push(filter.accountType);
  }
  if (filter.accountId) {
    where.push("accountId = ?");
    args.push(filter.accountId);
  }
  args.push(Math.min(500, filter.limit ?? 200));
  return db
    .prepare(`SELECT * FROM mp_payments ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY createdAt DESC LIMIT ?`)
    .all(...args) as PaymentRow[];
}

function upsertPayment(row: Omit<PaymentRow, "createdAt" | "updatedAt">): void {
  const at = nowIso();
  db.prepare(
    `INSERT INTO mp_payments (id, agencyId, status, mpStatus, externalReference, accountType, accountId, amount, detail, linkedPaymentId, preapprovalId, createdAt, updatedAt)
     VALUES (@id, @agencyId, @status, @mpStatus, @externalReference, @accountType, @accountId, @amount, @detail, @linkedPaymentId, @preapprovalId, @at, @at)
     ON CONFLICT(id) DO UPDATE SET agencyId=@agencyId, status=@status, mpStatus=@mpStatus, externalReference=@externalReference,
       accountType=@accountType, accountId=@accountId, amount=@amount, detail=@detail,
       linkedPaymentId=COALESCE(@linkedPaymentId, linkedPaymentId), preapprovalId=COALESCE(@preapprovalId, preapprovalId), updatedAt=@at`
  ).run({
    ...row,
    linkedPaymentId: row.linkedPaymentId ?? null,
    preapprovalId: row.preapprovalId ?? null,
    at,
    agencyId: accountAgencyId(row.accountType, row.accountId),
  });
}

export type MpPaymentInput = {
  id: string;
  status: string; // status do MP: approved | pending | in_process | rejected | cancelled | refunded | charged_back
  externalReference: string;
  amount: number;
  // pagamento gerado por assinatura: a autorização (preapproval) e a cobrança
  preapprovalId?: string | null;
  authorizedPaymentId?: string | null;
};

export type PaymentOutcome = "credited" | "already_credited" | "refunded" | "already_refunded" | "ignored" | "invalid";

// Aplica o estado de um pagamento do MP — a verdade vem SEMPRE da API do MP
// (o webhook relê o pagamento). Marcar e creditar acontecem na MESMA
// transação: ou os dois, ou nenhum (o MP reenvia e tentamos de novo).
export function applyMpPayment(p: MpPaymentInput): PaymentOutcome {
  const id = String(p.id);
  return db
    .transaction((): PaymentOutcome => {
      const existing = getPaymentRow(id);
      const subRefFound = parseSubRef(p.externalReference);
      if (subRefFound || p.preapprovalId) return applyLinkedSubscriptionPayment(p, existing, subRefFound);
      const ref = parsePaymentRef(p.externalReference);
      const base = {
        id,
        mpStatus: p.status,
        externalReference: p.externalReference ?? "",
        accountType: ref?.accountType ?? null,
        accountId: ref?.accountId ?? null,
        amount: Number(p.amount) || 0,
      };

      if (p.status === "refunded" || p.status === "charged_back") {
        if (existing?.status === "refunded") return "already_refunded";
        if (existing?.status !== "credited" || !ref) {
          upsertPayment({ ...base, status: "refunded", detail: "estornado antes de ser creditado" });
          return "ignored";
        }
        reverseCredit(ref, id, base.amount);
        upsertPayment({ ...base, status: "refunded", detail: `estorno (${p.status})` });
        return "refunded";
      }

      if (p.status !== "approved") {
        if (existing?.status === "credited" || existing?.status === "refunded") return "ignored";
        const status: PaymentStatus = p.status === "rejected" || p.status === "cancelled" ? "rejected" : "pending";
        upsertPayment({ ...base, status, detail: `status ${p.status}` });
        return "ignored";
      }

      if (existing?.status === "credited") return "already_credited";
      if (existing?.status === "refunded") return "already_refunded";
      if (!ref) {
        upsertPayment({ ...base, status: "invalid", detail: "referência desconhecida" });
        return "invalid";
      }
      const expected = expectedAmount(ref);
      if (base.amount + 0.01 < expected) {
        upsertPayment({ ...base, status: "invalid", detail: `valor pago ${base.amount} menor que ${expected}` });
        return "invalid";
      }
      creditRef(ref, id, base.amount);
      upsertPayment({ ...base, status: "credited", detail: "" });
      return "credited";
    })
    .immediate();
}

function creditRef(ref: PaymentRef, paymentId: string, amount: number): void {
  if (ref.kind === "coins") {
    const pack = getCoinPack(ref.packId)!;
    addCoins(
      ref.accountType,
      ref.accountId,
      pack.coins + pack.bonus,
      `Compra de ${pack.coins}${pack.bonus ? ` +${pack.bonus}` : ""} coins`,
      "coin_purchase",
      amount,
      `mp:${paymentId}`
    );
    return;
  }
  const plan = getPlan(ref.planId)!;
  refreshAccount(ref.accountType, ref.accountId);
  activatePlan({
    accountType: ref.accountType,
    accountId: ref.accountId,
    plan,
    period: ref.period,
    amount,
    description: `${plan.name} · ${PERIOD_DISCOUNT[ref.period].label} (pré-pago)`,
    ref: `mp:${paymentId}`,
  });
}

// Estorno/chargeback: tira o que foi dado. Coins comprados saem da carteira
// (pode ficar negativa, o que bloqueia novo uso); plano pago volta ao grátis.
function reverseCredit(ref: PaymentRef, paymentId: string, amount: number): void {
  if (ref.kind === "coins") {
    const pack = getCoinPack(ref.packId)!;
    addCoins(ref.accountType, ref.accountId, -(pack.coins + pack.bonus), "Estorno de compra de coins", "payment_refund", -amount, `mp:${paymentId}`);
    return;
  }
  const current = subscriptionRow(ref.accountType, ref.accountId);
  const plan = getPlan(ref.planId);
  if (current && current.planId === ref.planId) {
    startEntryPlan(ref.accountType, ref.accountId, nowIso(), "expired", plan);
  }
  recordTx({
    accountType: ref.accountType,
    accountId: ref.accountId,
    kind: "payment_refund",
    description: `Estorno do plano ${plan?.name ?? ref.planId}`,
    amount: -amount,
    ref: `mp:${paymentId}`,
  });
}

export function recordPaymentLookupFailure(id: string, detail: string): void {
  const existing = getPaymentRow(id);
  if (existing && existing.status !== "pending") return;
  upsertPayment({
    id,
    status: "pending",
    mpStatus: existing?.mpStatus ?? "",
    externalReference: existing?.externalReference ?? "",
    accountType: existing?.accountType ?? null,
    accountId: existing?.accountId ?? null,
    amount: existing?.amount ?? 0,
    detail: `consulta ao Mercado Pago falhou: ${detail}`.slice(0, 300),
  });
}

// ---------- Assinatura recorrente (Mercado Pago preapproval) ----------
db.exec(`
  CREATE TABLE IF NOT EXISTS mp_plans (
    id TEXT PRIMARY KEY,
    planId TEXT NOT NULL,
    period TEXT NOT NULL,
    amount REAL NOT NULL,
    createdAt TEXT NOT NULL,
    UNIQUE (planId, period, amount)
  );
  CREATE TABLE IF NOT EXISTS mp_preapprovals (
    id TEXT PRIMARY KEY,
    accountType TEXT NOT NULL,
    accountId TEXT NOT NULL,
    planId TEXT NOT NULL,
    period TEXT NOT NULL,
    amount REAL NOT NULL,
    mpPlanRowId TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    payerEmail TEXT NOT NULL DEFAULT '',
    initPoint TEXT NOT NULL DEFAULT '',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_mp_preapprovals_account ON mp_preapprovals(accountType, accountId);
`);
tenantColumn("mp_preapprovals");
// substituída (assinatura nova da mesma conta, cancelamento, estorno ou
// pendente esquecida): o sincronizador cancela no MP e cobranças dela não ligam plano
addColumnIfMissing("mp_preapprovals", "supersededAt", "TEXT");

export type MpPlanRow = { id: string; planId: string; period: BillingPeriod; amount: number; createdAt: string };

// Preço recorrente de um plano/período. Mudou o preço → nova linha; quem já
// assina segue no valor da própria assinatura.
export function ensurePlanPrice(planId: string, period: BillingPeriod): MpPlanRow {
  const plan = getPlan(planId);
  if (!plan || !isPaidPlan(plan)) throw new Error("Plano inválido");
  const amount = periodPrice(plan.monthlyPrice, period);
  const existing = db.prepare("SELECT * FROM mp_plans WHERE planId = ? AND period = ? AND amount = ?").get(planId, period, amount) as MpPlanRow | undefined;
  if (existing) return existing;
  const row: MpPlanRow = { id: randomUUID(), planId, period, amount, createdAt: nowIso() };
  db.prepare("INSERT OR IGNORE INTO mp_plans (id, planId, period, amount, createdAt) VALUES (@id, @planId, @period, @amount, @createdAt)").run(row);
  return db.prepare("SELECT * FROM mp_plans WHERE planId = ? AND period = ? AND amount = ?").get(planId, period, amount) as MpPlanRow;
}

export type PreapprovalRow = {
  id: string;
  supersededAt?: string | null;
  accountType: AccountType;
  accountId: string;
  planId: string;
  period: BillingPeriod;
  amount: number;
  status: string;
  payerEmail: string;
  initPoint: string;
  createdAt: string;
  updatedAt: string;
};

export function recordPreapproval(input: Omit<PreapprovalRow, "createdAt" | "updatedAt"> & { mpPlanRowId: string }): void {
  const at = nowIso();
  db.prepare(
    `INSERT INTO mp_preapprovals (id, agencyId, accountType, accountId, planId, period, amount, mpPlanRowId, status, payerEmail, initPoint, createdAt, updatedAt)
     VALUES (@id, @agencyId, @accountType, @accountId, @planId, @period, @amount, @mpPlanRowId, @status, @payerEmail, @initPoint, @at, @at)
     ON CONFLICT(id) DO UPDATE SET status = excluded.status, updatedAt = excluded.updatedAt`
  ).run({ ...input, agencyId: accountAgencyId(input.accountType, input.accountId), at });
}

export function getPreapproval(id: string): PreapprovalRow | null {
  return (db.prepare("SELECT * FROM mp_preapprovals WHERE id = ?").get(id) as PreapprovalRow | undefined) ?? null;
}

export function listPreapprovals(filter: { accountType?: AccountType; accountId?: string; agencyId?: string | null; limit?: number } = {}): PreapprovalRow[] {
  const where: string[] = [];
  const args: (string | number)[] = [];
  if (filter.agencyId) {
    where.push("agencyId = ?");
    args.push(filter.agencyId);
  }
  if (filter.accountType) {
    where.push("accountType = ?");
    args.push(filter.accountType);
  }
  if (filter.accountId) {
    where.push("accountId = ?");
    args.push(filter.accountId);
  }
  args.push(Math.min(500, filter.limit ?? 100));
  return db
    .prepare(`SELECT * FROM mp_preapprovals ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY createdAt DESC LIMIT ?`)
    .all(...args) as PreapprovalRow[];
}

// Mudança de estado da autorização no MP (autorizada, pausada, cancelada).
export function applyPreapprovalStatus(input: { id: string; status: string; externalReference?: string }): "updated" | "unknown" {
  const local = getPreapproval(input.id);
  if (!local) {
    const ref = parseSubRef(input.externalReference);
    if (!ref) return "unknown";
  }
  const at = nowIso();
  db.transaction(() => {
    db.prepare("UPDATE mp_preapprovals SET status = ?, updatedAt = ? WHERE id = ?").run(input.status, at, input.id);
    const effect = preapprovalEffect(input.status);
    const owner = local ?? parseSubRef(input.externalReference);
    if (!owner) return;
    const sub = subscriptionRow(owner.accountType, owner.accountId);
    if (!sub || sub.mpPreapprovalId !== input.id) return;
    if (effect === "cancel") {
      writeSubscription({ ...sub, cancelAtPeriodEnd: true, mpStatus: input.status });
    } else if (effect === "active") {
      writeSubscription({ ...sub, mpStatus: input.status });
    }
  }).immediate();
  return "updated";
}

export type SubscriptionPaymentInput = {
  authorizedPaymentId: string;
  preapprovalId: string;
  approved: boolean;
  amount: number;
  externalReference?: string;
  mpStatus: string;
  // id do pagamento que a cobrança gerou no MP (liga estorno/chargeback)
  paymentId?: string | null;
};

const REVERSAL_STATUSES = new Set(["refunded", "charged_back"]);

// Autorização que não pode mais ligar plano: cancelada ou substituída por
// uma assinatura mais nova da mesma conta.
function preapprovalRetired(row: (PreapprovalRow & { supersededAt?: string | null }) | null): boolean {
  return Boolean(row && (row.status === "cancelled" || row.supersededAt));
}

// Marca as outras autorizações abertas da conta como substituídas: o
// sincronizador (lib/subscription-sync) cancela cada uma no Mercado Pago.
export function supersedeOtherPreapprovals(accountType: AccountType, accountId: string, keepId: string | null, onlyPending = false): number {
  return db
    .prepare(
      `UPDATE mp_preapprovals SET supersededAt = ?, updatedAt = ?
       WHERE accountType = ? AND accountId = ? AND id != ? AND supersededAt IS NULL
         AND status ${onlyPending ? "= 'pending'" : "NOT IN ('cancelled')"}`
    )
    .run(nowIso(), nowIso(), accountType, accountId, keepId ?? "").changes;
}

// Pendentes há mais de `days` (o cliente nunca concluiu no MP) saem do ar.
export function supersedeStalePendingPreapprovals(days = 7, now: Date = new Date()): number {
  const cutoff = new Date(now.getTime() - days * 86_400_000).toISOString();
  return db
    .prepare("UPDATE mp_preapprovals SET supersededAt = ?, updatedAt = ? WHERE status = 'pending' AND supersededAt IS NULL AND createdAt < ?")
    .run(now.toISOString(), now.toISOString(), cutoff).changes;
}

// Autorizações que precisam ser canceladas no MP (substituídas e ainda não
// canceladas). Janela de 30 dias para não tentar para sempre.
export function preapprovalsToCancel(now: Date = new Date()): PreapprovalRow[] {
  const since = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  return db
    .prepare("SELECT * FROM mp_preapprovals WHERE supersededAt IS NOT NULL AND supersededAt >= ? AND status != 'cancelled' ORDER BY supersededAt LIMIT 50")
    .all(since) as PreapprovalRow[];
}

export function markPreapprovalCancelled(id: string): void {
  db.prepare("UPDATE mp_preapprovals SET status = 'cancelled', updatedAt = ? WHERE id = ?").run(nowIso(), id);
}

// Estorno/chargeback de uma cobrança recorrente já creditada: a conta volta
// ao plano de entrada (sem a cota do plano pago), a receita sai do caixa e a
// autorização é aposentada (o sincronizador cancela no MP; cobranças novas
// dela são ignoradas).
function reverseSubscriptionCredit(row: PaymentRow, mpStatus: string, paymentId: string | null): void {
  if (!row.accountType || !row.accountId) return;
  const current = subscriptionRow(row.accountType, row.accountId);
  const preapprovalId = row.preapprovalId ?? null;
  const plan = current ? getPlan(current.planId) : undefined;
  const fundedByIt = Boolean(current && current.recurring && preapprovalId && current.mpPreapprovalId === preapprovalId);
  if (fundedByIt) startEntryPlan(row.accountType, row.accountId, nowIso(), "expired", plan);
  recordTx({
    accountType: row.accountType,
    accountId: row.accountId,
    kind: "payment_refund",
    description: `Estorno da cobrança no cartão${plan && fundedByIt ? ` (${plan.name})` : ""} — ${mpStatus === "charged_back" ? "chargeback" : "reembolso"}`,
    amount: -Math.abs(Number(row.amount) || 0),
    ref: `mp_sub:${row.id.replace(/^sub_/, "")}`,
  });
  upsertPayment({
    ...row,
    status: "refunded",
    mpStatus,
    detail: `estorno (${mpStatus})`,
    linkedPaymentId: paymentId ?? row.linkedPaymentId ?? null,
  });
  if (preapprovalId) {
    db.prepare("UPDATE mp_preapprovals SET supersededAt = COALESCE(supersededAt, ?), updatedAt = ? WHERE id = ?").run(nowIso(), nowIso(), preapprovalId);
  }
}

// Pagamento (tópico "payment") que nasceu de uma assinatura. Aprovado: só
// registra (quem credita é a cobrança). Estornado: desfaz a cobrança ligada.
function applyLinkedSubscriptionPayment(p: MpPaymentInput, existing: PaymentRow | null, ref: ReturnType<typeof parseSubRef>): PaymentOutcome {
  const id = String(p.id);
  const byPayment = db.prepare("SELECT * FROM mp_payments WHERE linkedPaymentId = ? AND id LIKE 'sub\\_%' ESCAPE '\\'").get(id) as PaymentRow | undefined;
  const byCharge = p.authorizedPaymentId ? getPaymentRow(`sub_${p.authorizedPaymentId}`) : null;
  const byPreapproval = p.preapprovalId
    ? (db
        .prepare("SELECT * FROM mp_payments WHERE preapprovalId = ? AND id LIKE 'sub\\_%' ESCAPE '\\' AND status IN ('credited','refunded') ORDER BY createdAt DESC LIMIT 1")
        .get(p.preapprovalId) as PaymentRow | undefined)
    : undefined;
  const charge = byPayment ?? byCharge ?? byPreapproval ?? null;
  const local = p.preapprovalId ? getPreapproval(p.preapprovalId) : null;
  const owner = charge?.accountType && charge.accountId ? { accountType: charge.accountType, accountId: charge.accountId } : (local ?? ref);
  const base = {
    id,
    mpStatus: p.status,
    externalReference: p.externalReference ?? "",
    accountType: owner?.accountType ?? null,
    accountId: owner?.accountId ?? null,
    amount: Number(p.amount) || 0,
    preapprovalId: p.preapprovalId ?? charge?.preapprovalId ?? null,
  };
  if (REVERSAL_STATUSES.has(p.status)) {
    if (existing?.status === "refunded") return "already_refunded";
    if (!charge) {
      upsertPayment({ ...base, status: "invalid", detail: `estorno (${p.status}) de assinatura sem cobrança ligada — conferir no admin` });
      return "invalid";
    }
    if (charge.status === "refunded") {
      upsertPayment({ ...base, status: "refunded", detail: `estorno (${p.status}) já aplicado na cobrança ${charge.id}` });
      return "already_refunded";
    }
    if (charge.status !== "credited") {
      upsertPayment({ ...base, status: "refunded", detail: "estornado antes de ser creditado" });
      return "ignored";
    }
    reverseSubscriptionCredit(charge, p.status, id);
    upsertPayment({ ...base, status: "refunded", detail: `estorno (${p.status}) da cobrança ${charge.id}` });
    return "refunded";
  }
  if (existing?.status === "refunded") return "already_refunded";
  // guarda a ligação para um estorno futuro achar a cobrança
  if (charge && !charge.linkedPaymentId) {
    db.prepare("UPDATE mp_payments SET linkedPaymentId = ? WHERE id = ?").run(id, charge.id);
  }
  upsertPayment({
    ...base,
    status: "linked",
    detail: charge ? `cobrança da assinatura (${charge.id})` : `cobrança da assinatura (status ${p.status})`,
  });
  return "ignored";
}

// Cobrança recorrente: cada pagamento aprovado renova o período e recarrega a
// cota do plano (sem acumular). Idempotente pelo id da cobrança.
// - cobrança de autorização cancelada/substituída não liga nada (fica no
//   admin para estornar);
// - a 1ª cobrança de uma assinatura nova substitui a anterior (o
//   sincronizador cancela a antiga no MP);
// - reembolso/chargeback de uma cobrança creditada desfaz o plano.
export function applySubscriptionPayment(input: SubscriptionPaymentInput, now: Date = new Date()): PaymentOutcome {
  const paymentKey = `sub_${input.authorizedPaymentId}`;
  return db
    .transaction((): PaymentOutcome => {
      const existing = getPaymentRow(paymentKey);
      const local = getPreapproval(input.preapprovalId) as (PreapprovalRow & { supersededAt?: string | null }) | null;
      const ref = local
        ? { accountType: local.accountType, accountId: local.accountId, planId: local.planId, period: local.period }
        : parseSubRef(input.externalReference);
      const base = {
        id: paymentKey,
        mpStatus: input.mpStatus,
        externalReference: input.externalReference ?? `preapproval:${input.preapprovalId}`,
        accountType: ref?.accountType ?? null,
        accountId: ref?.accountId ?? null,
        amount: Number(input.amount) || 0,
        linkedPaymentId: input.paymentId ? String(input.paymentId) : null,
        preapprovalId: input.preapprovalId || null,
      };
      if (!input.approved) {
        if (existing?.status === "refunded") return "already_refunded";
        if (existing?.status === "credited") {
          if (!REVERSAL_STATUSES.has(input.mpStatus)) return "ignored";
          reverseSubscriptionCredit({ ...existing, linkedPaymentId: existing.linkedPaymentId ?? base.linkedPaymentId, preapprovalId: existing.preapprovalId ?? base.preapprovalId }, input.mpStatus, base.linkedPaymentId);
          return "refunded";
        }
        if (!ref) {
          upsertPayment({ ...base, status: "invalid", detail: "assinatura desconhecida" });
          return "invalid";
        }
        upsertPayment({ ...base, status: existing?.status === "rejected" ? "rejected" : "pending", detail: `cobrança recorrente ${input.mpStatus}` });
        return "ignored";
      }
      if (existing?.status === "credited") return "already_credited";
      if (existing?.status === "refunded") return "already_refunded";
      if (!ref) {
        upsertPayment({ ...base, status: "invalid", detail: "assinatura desconhecida" });
        return "invalid";
      }
      if (preapprovalRetired(local)) {
        upsertPayment({ ...base, status: "invalid", detail: "cobrança de assinatura cancelada ou substituída — estornar no Mercado Pago" });
        return "invalid";
      }
      const plan = getPlan(ref.planId);
      if (!plan || plan.accountType !== ref.accountType || !isPaidPlan(plan)) {
        upsertPayment({ ...base, status: "invalid", detail: "plano inválido" });
        return "invalid";
      }
      const expected = local?.amount ?? periodPrice(plan.monthlyPrice, ref.period);
      if (base.amount + 0.01 < expected) {
        upsertPayment({ ...base, status: "invalid", detail: `valor pago ${base.amount} menor que ${expected}` });
        return "invalid";
      }
      const at = now.toISOString();
      const months = PERIOD_DISCOUNT[ref.period].months;
      const current = subscriptionRow(ref.accountType, ref.accountId);
      // mesmo plano ainda vigente (renovação no cartão, ou pré-pago que vira
      // cartão): o período novo começa no fim do atual — nada pago se perde
      const currentValid = Boolean(
        current &&
          !subscriptionExpired({ renewsAt: current.renewsAt, recurring: Boolean(current.recurring), cancelAtPeriodEnd: Boolean(current.cancelAtPeriodEnd) }, now)
      );
      const samePlan = Boolean(current && current.planId === plan.id && (current.recurring || currentValid));
      writeSubscription({
        accountType: ref.accountType,
        accountId: ref.accountId,
        planId: plan.id,
        period: ref.period,
        status: "active",
        startedAt: samePlan ? current!.startedAt : at,
        renewsAt: nextPeriodEnd(samePlan ? current!.renewsAt : null, now, months),
        lastRefillAt: at,
        recurring: true,
        cancelAtPeriodEnd: false,
        mpPreapprovalId: input.preapprovalId,
        mpStatus: "authorized",
      });
      setPlanCoins(ref.accountType, ref.accountId, planQuota(plan));
      recordTx({
        accountType: ref.accountType,
        accountId: ref.accountId,
        kind: "subscription_renewal",
        description: `${plan.name} · cobrança no cartão (${PERIOD_DISCOUNT[ref.period].label})`,
        amount: base.amount,
        coins: planQuota(plan),
        ref: `mp_sub:${input.authorizedPaymentId}`,
        at,
      });
      db.prepare("UPDATE mp_preapprovals SET status = 'authorized', updatedAt = ? WHERE id = ?").run(at, input.preapprovalId);
      // uma assinatura só por conta: as outras abertas saem (cancelar no MP)
      supersedeOtherPreapprovals(ref.accountType, ref.accountId, input.preapprovalId);
      upsertPayment({ ...base, status: "credited", detail: "" });
      return "credited";
    })
    .immediate();
}

// Cancelar a renovação: o plano vale até o fim do período já pago.
export function markCancelAtPeriodEnd(accountType: AccountType, accountId: string): Subscription | null {
  const sub = subscriptionRow(accountType, accountId);
  if (!sub || !sub.recurring) return null;
  writeSubscription({ ...sub, cancelAtPeriodEnd: true, mpStatus: "cancelled" });
  if (sub.mpPreapprovalId) {
    db.prepare("UPDATE mp_preapprovals SET status = 'cancelled', supersededAt = COALESCE(supersededAt, ?), updatedAt = ? WHERE id = ?").run(nowIso(), nowIso(), sub.mpPreapprovalId);
  }
  // nenhuma outra autorização da conta continua cobrando
  supersedeOtherPreapprovals(accountType, accountId, sub.mpPreapprovalId ?? null);
  return getSubscription(accountType, accountId);
}

export function recurringSubscriptions(): SubscriptionRow[] {
  const rows = db.prepare("SELECT accountType, accountId FROM subscriptions WHERE recurring = 1").all() as { accountType: AccountType; accountId: string }[];
  return rows.map((r) => subscriptionRow(r.accountType, r.accountId)).filter((r): r is SubscriptionRow => Boolean(r));
}
