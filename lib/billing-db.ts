import { randomUUID } from "crypto";
import { db } from "./db";
import {
  ACTION_COST,
  defaultPlanId,
  getPlan,
  PERIOD_DISCOUNT,
  periodPrice,
  type AccountType,
  type BillingPeriod,
} from "./plans";

// Billing: carteira de coins + assinatura + histórico + ledger de uso.
// Pagamento é SIMULADO (Stripe/Mercado Pago = infra de produção, deferida).
// O "enforcement" (bloquear IA sem saldo) é um flag global, default OFF, para
// não travar a operação enquanto se testa — o admin liga quando for cobrar.

export type Subscription = {
  accountType: AccountType;
  accountId: string; // "agency" para a agência da casa; senão id do cliente/prof
  planId: string;
  period: BillingPeriod;
  status: "active" | "canceled";
  startedAt: string;
  renewsAt: string;
};

export type Wallet = { accountType: AccountType; accountId: string; coins: number };

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
    kind TEXT NOT NULL,           -- subscription | coin_purchase | usage | grant
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
`);

const now = () => new Date().toISOString();
const addMonths = (months: number) => {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
};

export function isEnforced(): boolean {
  // Em produção, BILLING_ENFORCED=true liga o bloqueio por saldo sem depender
  // da flag do banco (o admin ainda pode alternar a flag em /plans).
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
}): void {
  db.prepare(
    `INSERT INTO billing_transactions (id, accountType, accountId, kind, description, amount, coins, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    randomUUID(),
    input.accountType,
    input.accountId,
    input.kind,
    input.description,
    input.amount ?? 0,
    input.coins ?? 0,
    now()
  );
}

// ---------- Carteira ----------
export function getWallet(accountType: AccountType, accountId: string): Wallet {
  const row = db
    .prepare("SELECT * FROM wallets WHERE accountType = ? AND accountId = ?")
    .get(accountType, accountId) as Wallet | undefined;
  return row ?? { accountType, accountId, coins: 0 };
}

export function addCoins(
  accountType: AccountType,
  accountId: string,
  coins: number,
  description: string,
  kind: "coin_purchase" | "grant" | "subscription" = "grant",
  amount = 0
): Wallet {
  db.prepare(
    `INSERT INTO wallets (accountType, accountId, coins) VALUES (?, ?, ?)
     ON CONFLICT(accountType, accountId) DO UPDATE SET coins = coins + ?`
  ).run(accountType, accountId, coins, coins);
  recordTx({ accountType, accountId, kind, description, coins, amount });
  return getWallet(accountType, accountId);
}

// ---------- Assinatura ----------
export function getSubscription(
  accountType: AccountType,
  accountId: string
): Subscription {
  const row = db
    .prepare("SELECT * FROM subscriptions WHERE accountType = ? AND accountId = ?")
    .get(accountType, accountId) as Subscription | undefined;
  if (row) return row;
  // Sem assinatura → plano grátis padrão do tipo
  return {
    accountType,
    accountId,
    planId: defaultPlanId(accountType),
    period: "monthly",
    status: "active",
    startedAt: now(),
    renewsAt: addMonths(1),
  };
}

// Assina um plano (pagamento simulado). Credita a cota de coins do plano e
// registra a receita do período.
export function subscribe(input: {
  accountType: AccountType;
  accountId: string;
  planId: string;
  period: BillingPeriod;
}): { subscription: Subscription; wallet: Wallet } {
  const plan = getPlan(input.planId);
  if (!plan || plan.accountType !== input.accountType) {
    throw new Error("Plano inválido para este tipo de conta.");
  }
  const months = PERIOD_DISCOUNT[input.period].months;
  const sub: Subscription = {
    accountType: input.accountType,
    accountId: input.accountId,
    planId: input.planId,
    period: input.period,
    status: "active",
    startedAt: now(),
    renewsAt: addMonths(months),
  };
  db.prepare(
    `INSERT INTO subscriptions (accountType, accountId, planId, period, status, startedAt, renewsAt)
     VALUES (@accountType, @accountId, @planId, @period, @status, @startedAt, @renewsAt)
     ON CONFLICT(accountType, accountId) DO UPDATE SET planId=@planId, period=@period, status='active', startedAt=@startedAt, renewsAt=@renewsAt`
  ).run(sub);
  const revenue = periodPrice(plan.monthlyPrice, input.period);
  recordTx({
    accountType: input.accountType,
    accountId: input.accountId,
    kind: "subscription",
    description: `${plan.name} · ${PERIOD_DISCOUNT[input.period].label}`,
    amount: revenue,
  });
  // Credita a cota de coins do plano (ilimitado não usa coins)
  const wallet = plan.unlimited
    ? getWallet(input.accountType, input.accountId)
    : addCoins(
        input.accountType,
        input.accountId,
        plan.aiCoinsPerMonth * months,
        `Cota do plano ${plan.name}`,
        "subscription"
      );
  return { subscription: sub, wallet };
}

// ---------- Metering de uso ----------
export type ChargeResult = { ok: boolean; charged: number; balance: number; reason?: string };

// Cobra coins por uma ação de IA. Se o plano é ilimitado, não cobra. Se
// enforcement está ligado e não há saldo, bloqueia; senão deixa passar
// (registra saldo negativo) para não travar a operação em modo de teste.
export function chargeUsage(input: {
  accountType: AccountType;
  accountId: string;
  action: string;
  units?: number;
}): ChargeResult {
  const sub = getSubscription(input.accountType, input.accountId);
  const plan = getPlan(sub.planId);
  if (plan?.unlimited) {
    return { ok: true, charged: 0, balance: Infinity };
  }
  const cost = (ACTION_COST[input.action] ?? 2) * (input.units ?? 1);
  const wallet = getWallet(input.accountType, input.accountId);
  if (wallet.coins < cost && isEnforced()) {
    return {
      ok: false,
      charged: 0,
      balance: wallet.coins,
      reason: "Saldo de coins insuficiente. Assine um plano ou compre coins.",
    };
  }
  db.prepare(
    `INSERT INTO wallets (accountType, accountId, coins) VALUES (?, ?, ?)
     ON CONFLICT(accountType, accountId) DO UPDATE SET coins = coins - ?`
  ).run(input.accountType, input.accountId, -cost, cost);
  recordTx({
    accountType: input.accountType,
    accountId: input.accountId,
    kind: "usage",
    description: `IA: ${input.action}`,
    coins: -cost,
  });
  return { ok: true, charged: cost, balance: getWallet(input.accountType, input.accountId).coins };
}

export type BillingSummary = {
  plan: ReturnType<typeof getPlan>;
  subscription: Subscription;
  wallet: Wallet;
  usageThisMonth: number;
};

export function billingSummary(
  accountType: AccountType,
  accountId: string
): BillingSummary {
  const subscription = getSubscription(accountType, accountId);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const usage = db
    .prepare(
      `SELECT COALESCE(SUM(-coins),0) as c FROM billing_transactions
       WHERE accountType = ? AND accountId = ? AND kind = 'usage' AND createdAt >= ?`
    )
    .get(accountType, accountId, monthStart.toISOString()) as { c: number };
  return {
    plan: getPlan(subscription.planId),
    subscription,
    wallet: getWallet(accountType, accountId),
    usageThisMonth: usage.c,
  };
}

// Receita total da plataforma (para o admin).
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
  // MRR aproximado: soma dos preços mensais das assinaturas ativas
  const subs = db.prepare("SELECT planId FROM subscriptions WHERE status = 'active'").all() as {
    planId: string;
  }[];
  const mrr = subs.reduce((sum, s) => sum + (getPlan(s.planId)?.monthlyPrice ?? 0), 0);
  return { total, mrr, byKind };
}
