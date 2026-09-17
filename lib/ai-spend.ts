import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "crypto";
import { addColumnIfMissing, db, tenantColumn } from "./db";
import type { AccountType, AiQuality } from "./plans";
import { accountSpendTier, type SpendTier } from "./billing-db";

// Gasto real de IA (custo estimado a partir do `usage` de cada chamada) e os
// tetos diários (UTC):
//  - global (AI_DAILY_SPEND_LIMIT_USD): último disjuntor, para toda a IA;
//  - "bolso" do grátis (AI_FREE_DAILY_SPEND_LIMIT_USD, padrão 25% do global):
//    contas sem plano pago param sozinhas, sem pausar quem paga;
//  - por conta: grátis (AI_FREE_ACCOUNT_DAILY_SPEND_LIMIT_USD, padrão US$1) e
//    paga (AI_PAID_ACCOUNT_DAILY_SPEND_LIMIT_USD, padrão 50% do global).
//    A agência da casa só tem o global.
// Voz (TTS) e imagem entram no mesmo gasto.

export type AiContext = {
  action: string;
  // agência em nome de quem a IA roda (nome e estilo da casa nos prompts,
  // atribuição do gasto). null = admin/sistema.
  agencyId?: string | null;
  accountType?: AccountType | null;
  accountId?: string | null;
  userId?: string | null;
  // teto de qualidade do plano de quem paga (economy força o modelo barato)
  quality?: AiQuality | null;
  // faixa de gasto de quem paga (resolvida pela conta quando ausente)
  tier?: SpendTier | null;
};

const storage = new AsyncLocalStorage<AiContext>();

export function runWithAiContext<T>(ctx: AiContext, fn: () => Promise<T>): Promise<T> {
  return storage.run(ctx, fn);
}

export function currentAiContext(): AiContext | undefined {
  return storage.getStore();
}

db.exec(`
  CREATE TABLE IF NOT EXISTS ai_usage (
    id TEXT PRIMARY KEY,
    createdAt TEXT NOT NULL,
    day TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT 'anthropic',
    action TEXT NOT NULL DEFAULT '',
    accountType TEXT,
    accountId TEXT,
    userId TEXT,
    model TEXT NOT NULL DEFAULT '',
    inputTokens INTEGER NOT NULL DEFAULT 0,
    outputTokens INTEGER NOT NULL DEFAULT 0,
    cacheReadTokens INTEGER NOT NULL DEFAULT 0,
    cacheWriteTokens INTEGER NOT NULL DEFAULT 0,
    webSearches INTEGER NOT NULL DEFAULT 0,
    units INTEGER NOT NULL DEFAULT 0,
    costUsd REAL NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_ai_usage_day ON ai_usage(day);
  CREATE INDEX IF NOT EXISTS idx_ai_usage_account ON ai_usage(accountType, accountId, day);
  CREATE TABLE IF NOT EXISTS ai_errors (
    id TEXT PRIMARY KEY,
    createdAt TEXT NOT NULL,
    action TEXT NOT NULL DEFAULT '',
    accountType TEXT,
    accountId TEXT,
    kind TEXT NOT NULL DEFAULT '',
    detail TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS idx_ai_errors_created ON ai_errors(createdAt);
`);
tenantColumn("ai_usage");
tenantColumn("ai_errors");
addColumnIfMissing("ai_usage", "tier", "TEXT");

import { estimateCostUsd, type TokenUsage } from "./ai-spend-cost";
import { getKv, setKv } from "./kv-settings";
import { effectiveAccountCap } from "./ai-margin";

export { estimateCostUsd, type TokenUsage };

const today = () => new Date().toISOString().slice(0, 10);

// Faixa de quem paga (a do contexto, ou resolvida pela conta).
function tierOf(ctx: AiContext | undefined): SpendTier | null {
  if (!ctx?.accountType || !ctx.accountId) return null;
  return ctx.tier ?? accountSpendTier(ctx.accountType, ctx.accountId);
}

export function recordAiUsage(model: string, usage: TokenUsage): number {
  const ctx = currentAiContext();
  const cost = estimateCostUsd(model, usage);
  const at = new Date().toISOString();
  db.prepare(
    `INSERT INTO ai_usage (id, createdAt, day, provider, action, agencyId, accountType, accountId, userId, tier, model,
      inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens, webSearches, costUsd)
     VALUES (?, ?, ?, 'anthropic', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    randomUUID(),
    at,
    at.slice(0, 10),
    ctx?.action ?? "background",
    ctx?.agencyId ?? null,
    ctx?.accountType ?? null,
    ctx?.accountId ?? null,
    ctx?.userId ?? null,
    tierOf(ctx),
    model,
    Number(usage.input_tokens ?? 0),
    Number(usage.output_tokens ?? 0),
    Number(usage.cache_read_input_tokens ?? 0),
    Number(usage.cache_creation_input_tokens ?? 0),
    Number(usage.server_tool_use?.web_search_requests ?? 0),
    cost
  );
  return cost;
}

// Gasto de outros provedores (voz, imagem), com custo estimado por unidade.
export function recordExternalSpend(provider: string, units: number, costUsd: number, model = ""): void {
  const ctx = currentAiContext();
  const at = new Date().toISOString();
  db.prepare(
    `INSERT INTO ai_usage (id, createdAt, day, provider, action, agencyId, accountType, accountId, userId, tier, model, units, costUsd)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    randomUUID(),
    at,
    at.slice(0, 10),
    provider,
    ctx?.action ?? provider,
    ctx?.agencyId ?? null,
    ctx?.accountType ?? null,
    ctx?.accountId ?? null,
    ctx?.userId ?? null,
    tierOf(ctx),
    model,
    Math.max(0, Math.round(units)),
    Math.max(0, costUsd)
  );
}

export function envUsd(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function aiDailyLimitUsd(): number {
  return envUsd("AI_DAILY_SPEND_LIMIT_USD", 20);
}

export function aiSpendTodayUsd(): number {
  const row = db.prepare("SELECT COALESCE(SUM(costUsd),0) AS c FROM ai_usage WHERE day = ?").get(today()) as {
    c: number;
  };
  return row.c;
}

// "Bolso" diário das contas sem plano pago (padrão: 25% do teto global).
export function aiFreePoolLimitUsd(): number {
  return envUsd("AI_FREE_DAILY_SPEND_LIMIT_USD", aiDailyLimitUsd() * 0.25);
}

export function aiFreePoolSpendTodayUsd(): number {
  const row = db.prepare("SELECT COALESCE(SUM(costUsd),0) AS c FROM ai_usage WHERE day = ? AND tier = 'free'").get(today()) as {
    c: number;
  };
  return row.c;
}

// Teto diário de UMA conta (a casa não tem teto próprio, só o global).
export function aiAccountLimitUsd(tier: SpendTier): number {
  if (tier === "free") return envUsd("AI_FREE_ACCOUNT_DAILY_SPEND_LIMIT_USD", 1);
  if (tier === "paid") return envUsd("AI_PAID_ACCOUNT_DAILY_SPEND_LIMIT_USD", aiDailyLimitUsd() * 0.5);
  return Number.POSITIVE_INFINITY;
}

// Ajuste do admin no teto diário de UMA conta (null = padrão da faixa).
const capKey = (accountType: string, accountId: string) => `ai_cap_override:${accountType}:${accountId}`;
export function accountCapOverride(accountType: string, accountId: string): number | null {
  const value = getKv<{ usd: number | null }>(capKey(accountType, accountId), { usd: null }).usd;
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}
export function setAccountCapOverride(accountType: string, accountId: string, usd: number | null): void {
  setKv(capKey(accountType, accountId), { usd: usd === null ? null : Math.max(0, usd) });
}
export function accountCapFor(accountType: AccountType, accountId: string, tier: SpendTier): number {
  return effectiveAccountCap(aiAccountLimitUsd(tier), accountCapOverride(accountType, accountId));
}

export function accountSpendTodayUsd(accountType: AccountType, accountId: string): number {
  const row = db
    .prepare("SELECT COALESCE(SUM(costUsd),0) AS c FROM ai_usage WHERE accountType = ? AND accountId = ? AND day = ?")
    .get(accountType, accountId, today()) as { c: number };
  return row.c;
}

// Qual teto barra esta chamada (null = liberada). Sem conta (admin/sistema):
// só o global. Teto 0 = IA desligada (disjuntor manual pelo env).
export type BudgetBlock = "global" | "free_pool" | "account" | null;
export function aiBudgetBlock(ctx: AiContext | undefined = currentAiContext()): BudgetBlock {
  if (aiSpendTodayUsd() >= aiDailyLimitUsd()) return "global";
  const tier = tierOf(ctx);
  if (!tier || !ctx?.accountType || !ctx.accountId) return null;
  if (tier === "free" && aiFreePoolSpendTodayUsd() >= aiFreePoolLimitUsd()) return "free_pool";
  if (accountSpendTodayUsd(ctx.accountType, ctx.accountId) >= accountCapFor(ctx.accountType, ctx.accountId, tier)) return "account";
  return null;
}

export function aiBudgetExceeded(ctx?: AiContext): boolean {
  return aiBudgetBlock(ctx ?? currentAiContext()) !== null;
}

export function recordAiError(kind: string, detail: string, context?: AiContext): void {
  const ctx = context ?? currentAiContext();
  const clean = detail.replace(/sk-[A-Za-z0-9_-]{8,}/g, "sk-***").slice(0, 600);
  console.error(`[ai] ${ctx?.action ?? "?"} ${kind}: ${clean}`);
  try {
    db.prepare(
      "INSERT INTO ai_errors (id, createdAt, action, agencyId, accountType, accountId, kind, detail) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(randomUUID(), new Date().toISOString(), ctx?.action ?? "", ctx?.agencyId ?? null, ctx?.accountType ?? null, ctx?.accountId ?? null, kind, clean);
  } catch {
    // o log no console já basta se o banco falhar
  }
}

export type AiErrorRow = { id: string; createdAt: string; action: string; accountType: string | null; accountId: string | null; kind: string; detail: string };

export function recentAiErrors(limit = 30, agencyId?: string | null): AiErrorRow[] {
  const where = agencyId ? "WHERE agencyId = ?" : "";
  return db
    .prepare(`SELECT * FROM ai_errors ${where} ORDER BY createdAt DESC LIMIT ?`)
    .all(...(agencyId ? [agencyId] : []), limit) as AiErrorRow[];
}

export type AccountUsageRow = {
  agencyId: string | null;
  accountType: string | null;
  accountId: string | null;
  calls: number;
  costUsd: number;
  lastAt: string;
};

export function usageByAccount(days = 30, agencyId?: string | null): AccountUsageRow[] {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const where = agencyId ? "AND agencyId = ?" : "";
  return db
    .prepare(
      `SELECT agencyId, accountType, accountId, COUNT(*) AS calls, SUM(costUsd) AS costUsd, MAX(createdAt) AS lastAt
       FROM ai_usage WHERE createdAt >= ? ${where} GROUP BY agencyId, accountType, accountId ORDER BY costUsd DESC LIMIT 200`
    )
    .all(since, ...(agencyId ? [agencyId] : [])) as AccountUsageRow[];
}

export function spendByDay(days = 14, agencyId?: string | null): { day: string; costUsd: number; calls: number }[] {
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const where = agencyId ? "AND agencyId = ?" : "";
  return db
    .prepare(`SELECT day, SUM(costUsd) AS costUsd, COUNT(*) AS calls FROM ai_usage WHERE day >= ? ${where} GROUP BY day ORDER BY day`)
    .all(since, ...(agencyId ? [agencyId] : [])) as { day: string; costUsd: number; calls: number }[];
}

// Custo por ação e modelo (admin): onde o dinheiro de IA está indo.
export type ActionModelRow = { action: string; provider: string; model: string; calls: number; costUsd: number; webSearches: number };
export function usageByActionModel(days = 30, agencyId?: string | null): ActionModelRow[] {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const where = agencyId ? "AND agencyId = ?" : "";
  return db
    .prepare(
      `SELECT action, provider, model, COUNT(*) AS calls, SUM(costUsd) AS costUsd, SUM(webSearches) AS webSearches
       FROM ai_usage WHERE createdAt >= ? ${where} GROUP BY action, provider, model ORDER BY costUsd DESC LIMIT 100`
    )
    .all(since, ...(agencyId ? [agencyId] : [])) as ActionModelRow[];
}

// Custo de IA e receita confirmada por conta no período (entrada da margem).
export function costAndRevenueByAccount(days = 30, agencyId?: string | null) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const where = agencyId ? "AND agencyId = ?" : "";
  const args = agencyId ? [agencyId] : [];
  const costs = db
    .prepare(
      `SELECT accountType, accountId, SUM(costUsd) AS costUsd, COUNT(*) AS calls FROM ai_usage
       WHERE createdAt >= ? ${where} GROUP BY accountType, accountId`
    )
    .all(since, ...args) as { accountType: string | null; accountId: string | null; costUsd: number; calls: number }[];
  const revenue = db
    .prepare(
      `SELECT accountType, accountId, SUM(amount) AS revenueBrl FROM billing_transactions
       WHERE createdAt >= ? AND amount != 0 ${where} GROUP BY accountType, accountId`
    )
    .all(since, ...args) as { accountType: string | null; accountId: string | null; revenueBrl: number }[];
  return { costs, revenue };
}

// Caracteres de voz (TTS) gerados hoje por uma conta.
export function ttsCharsTodayForAccount(accountType: string, accountId: string): number {
  const row = db
    .prepare("SELECT COALESCE(SUM(units),0) AS c FROM ai_usage WHERE day = ? AND provider LIKE 'tts_%' AND accountType = ? AND accountId = ?")
    .get(new Date().toISOString().slice(0, 10), accountType, accountId) as { c: number };
  return row.c;
}

export function purgeOldAiErrors(olderThanDays = 90): number {
  const cutoff = new Date(Date.now() - olderThanDays * 86_400_000).toISOString();
  return db.prepare("DELETE FROM ai_errors WHERE createdAt < ?").run(cutoff).changes;
}

// LGPD: o gasto fica (custo da plataforma), sem o vínculo com a pessoa.
export function anonymiseAiUsage(accountType: AccountType, accountId: string, userId: string): void {
  db.prepare("UPDATE ai_usage SET accountId = NULL, userId = NULL WHERE (accountType = ? AND accountId = ?) OR userId = ?").run(
    accountType,
    accountId,
    userId
  );
  db.prepare("UPDATE ai_errors SET accountId = NULL WHERE accountType = ? AND accountId = ?").run(accountType, accountId);
}
