import { randomUUID } from "crypto";
import { addColumnIfMissing, db } from "./db";
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
    `INSERT INTO billing_transactions (id, accountType, accountId, kind, description, amount, coins, ref, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
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
  db.prepare("INSERT OR IGNORE INTO wallets (accountType, accountId, coins, planCoins) VALUES (?, ?, 0, 0)").run(
    accountType,
    accountId
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
type SubscriptionRow = Omit<Subscription, "lastRefillAt"> & { lastRefillAt: string | null };

function subscriptionRow(accountType: AccountType, accountId: string): SubscriptionRow | undefined {
  return db
    .prepare("SELECT * FROM subscriptions WHERE accountType = ? AND accountId = ?")
    .get(accountType, accountId) as SubscriptionRow | undefined;
}

function writeSubscription(sub: Subscription): void {
  db.prepare(
    `INSERT INTO subscriptions (accountType, accountId, planId, period, status, startedAt, renewsAt, lastRefillAt)
     VALUES (@accountType, @accountId, @planId, @period, @status, @startedAt, @renewsAt, @lastRefillAt)
     ON CONFLICT(accountType, accountId) DO UPDATE SET planId=@planId, period=@period, status=@status,
       startedAt=@startedAt, renewsAt=@renewsAt, lastRefillAt=@lastRefillAt`
  ).run(sub);
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

// Aplica o calendário da conta (preguiçoso: chamado em toda leitura/uso e no
// tick do scheduler). Cria a assinatura grátis se não existir, expira plano
// pago vencido e recarrega a cota mensal. Idempotente.
export function refreshAccount(accountType: AccountType, accountId: string, now: Date = new Date()): void {
  const at = now.toISOString();
  db.transaction(() => {
    const row = subscriptionRow(accountType, accountId);
    if (!row) {
      startEntryPlan(accountType, accountId, at, "signup");
      return;
    }
    const plan = getPlan(row.planId);
    if (!plan || plan.accountType !== accountType) {
      startEntryPlan(accountType, accountId, at, "expired", plan);
      return;
    }
    if (isPaidPlan(plan) && row.renewsAt <= at) {
      startEntryPlan(accountType, accountId, at, "expired", plan);
      return;
    }
    const lastRefill = row.lastRefillAt ?? row.startedAt;
    if (addMonthsIso(lastRefill, 1) <= at) {
      // Avança em meses inteiros a partir da última recarga (o dia do mês fica estável).
      let next = lastRefill;
      while (addMonthsIso(next, 1) <= at) next = addMonthsIso(next, 1);
      const quota = planQuota(plan);
      writeSubscription({
        ...row,
        status: "active",
        lastRefillAt: next,
        // plano grátis não vence: o "renova em" acompanha a próxima recarga
        renewsAt: isPaidPlan(plan) ? row.renewsAt : addMonthsIso(next, 1),
      });
      setPlanCoins(accountType, accountId, quota);
      recordTx({ accountType, accountId, kind: "refill", description: `Cota mensal do plano ${plan.name}`, coins: quota, at });
    }
  }).immediate();
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
      if (balance < cost && isEnforced()) {
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

export function billingSummary(accountType: AccountType, accountId: string): BillingSummary {
  const subscription = getSubscription(accountType, accountId);
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
    wallet: getWallet(accountType, accountId),
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

export function listTransactions(filter: { accountType?: AccountType; accountId?: string; limit?: number } = {}): BillingTx[] {
  const where: string[] = [];
  const args: (string | number)[] = [];
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
export function platformRevenue(): { total: number; mrr: number; byKind: Record<string, number> } {
  const rows = db
    .prepare("SELECT kind, COALESCE(SUM(amount),0) as total FROM billing_transactions GROUP BY kind")
    .all() as { kind: string; total: number }[];
  const byKind: Record<string, number> = {};
  let total = 0;
  for (const r of rows) {
    byKind[r.kind] = r.total;
    total += r.total;
  }
  // MRR aproximado: preço mensal dos planos pagos vigentes pagos por pagamento
  const at = nowIso();
  const subs = db
    .prepare("SELECT planId FROM subscriptions WHERE status = 'active' AND renewsAt > ?")
    .all(at) as { planId: string }[];
  const mrr = subs.reduce((sum, s) => sum + (getPlan(s.planId)?.monthlyPrice ?? 0), 0);
  return { total, mrr, byKind };
}

export type AccountBillingRow = {
  accountType: AccountType;
  accountId: string;
  planId: string;
  planName: string;
  renewsAt: string;
  coins: number;
  paid: boolean;
};

export function listAccountsBilling(): AccountBillingRow[] {
  const rows = db
    .prepare(
      `SELECT s.accountType, s.accountId, s.planId, s.renewsAt, COALESCE(w.coins,0) + COALESCE(w.planCoins,0) AS coins
       FROM subscriptions s LEFT JOIN wallets w ON w.accountType = s.accountType AND w.accountId = s.accountId`
    )
    .all() as { accountType: AccountType; accountId: string; planId: string; renewsAt: string; coins: number }[];
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

export type PaymentStatus = "credited" | "refunded" | "rejected" | "pending" | "invalid";

export type PaymentRow = {
  id: string;
  status: PaymentStatus;
  mpStatus: string;
  externalReference: string;
  accountType: AccountType | null;
  accountId: string | null;
  amount: number;
  detail: string;
  createdAt: string;
  updatedAt: string | null;
};

export function getPaymentRow(id: string): PaymentRow | null {
  return (db.prepare("SELECT * FROM mp_payments WHERE id = ?").get(id) as PaymentRow | undefined) ?? null;
}

export function listPayments(filter: { accountType?: AccountType; accountId?: string; limit?: number } = {}): PaymentRow[] {
  const where: string[] = [];
  const args: (string | number)[] = [];
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
    `INSERT INTO mp_payments (id, status, mpStatus, externalReference, accountType, accountId, amount, detail, createdAt, updatedAt)
     VALUES (@id, @status, @mpStatus, @externalReference, @accountType, @accountId, @amount, @detail, @at, @at)
     ON CONFLICT(id) DO UPDATE SET status=@status, mpStatus=@mpStatus, externalReference=@externalReference,
       accountType=@accountType, accountId=@accountId, amount=@amount, detail=@detail, updatedAt=@at`
  ).run({ ...row, at });
}

export type MpPaymentInput = {
  id: string;
  status: string; // status do MP: approved | pending | in_process | rejected | cancelled | refunded | charged_back
  externalReference: string;
  amount: number;
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
