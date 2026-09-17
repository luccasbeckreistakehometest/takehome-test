import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "crypto";
import { db } from "./db";
import type { AccountType, AiQuality } from "./plans";

// Gasto real de IA (custo estimado a partir do `usage` de cada chamada) e o
// teto diário global — o "disjuntor": passou do teto, toda IA para até o dia
// seguinte (UTC). O teto vem de AI_DAILY_SPEND_LIMIT_USD e aparece no admin.

export type AiContext = {
  action: string;
  accountType?: AccountType | null;
  accountId?: string | null;
  userId?: string | null;
  // teto de qualidade do plano de quem paga (economy força o modelo barato)
  quality?: AiQuality | null;
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

// US$ por milhão de tokens (preço de tabela da Anthropic). Modelo
// desconhecido cai no mais caro, para o teto errar para o lado seguro.
const PRICES: Record<string, { input: number; output: number }> = {
  "claude-opus-4-8": { input: 5, output: 25 },
  "claude-opus-5": { input: 5, output: 25 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};
const FALLBACK_PRICE = { input: 5, output: 25 };
const WEB_SEARCH_USD = 10 / 1000; // US$ 10 por mil buscas

export type TokenUsage = {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  server_tool_use?: { web_search_requests?: number | null } | null;
};

export function estimateCostUsd(model: string, usage: TokenUsage): number {
  const price = PRICES[model] ?? FALLBACK_PRICE;
  const input = Number(usage.input_tokens ?? 0);
  const output = Number(usage.output_tokens ?? 0);
  const cacheRead = Number(usage.cache_read_input_tokens ?? 0);
  const cacheWrite = Number(usage.cache_creation_input_tokens ?? 0);
  const searches = Number(usage.server_tool_use?.web_search_requests ?? 0);
  return (
    (input * price.input + output * price.output + cacheRead * price.input * 0.1 + cacheWrite * price.input * 1.25) /
      1_000_000 +
    searches * WEB_SEARCH_USD
  );
}

const today = () => new Date().toISOString().slice(0, 10);

export function recordAiUsage(model: string, usage: TokenUsage): number {
  const ctx = currentAiContext();
  const cost = estimateCostUsd(model, usage);
  const at = new Date().toISOString();
  db.prepare(
    `INSERT INTO ai_usage (id, createdAt, day, provider, action, accountType, accountId, userId, model,
      inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens, webSearches, costUsd)
     VALUES (?, ?, ?, 'anthropic', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    randomUUID(),
    at,
    at.slice(0, 10),
    ctx?.action ?? "background",
    ctx?.accountType ?? null,
    ctx?.accountId ?? null,
    ctx?.userId ?? null,
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
    `INSERT INTO ai_usage (id, createdAt, day, provider, action, accountType, accountId, userId, model, units, costUsd)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    randomUUID(),
    at,
    at.slice(0, 10),
    provider,
    ctx?.action ?? provider,
    ctx?.accountType ?? null,
    ctx?.accountId ?? null,
    ctx?.userId ?? null,
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

// Teto 0 = IA desligada (disjuntor manual pelo env).
export function aiBudgetExceeded(): boolean {
  return aiSpendTodayUsd() >= aiDailyLimitUsd();
}

export function recordAiError(kind: string, detail: string): void {
  const ctx = currentAiContext();
  const clean = detail.replace(/sk-[A-Za-z0-9_-]{8,}/g, "sk-***").slice(0, 600);
  console.error(`[ai] ${ctx?.action ?? "?"} ${kind}: ${clean}`);
  try {
    db.prepare(
      "INSERT INTO ai_errors (id, createdAt, action, accountType, accountId, kind, detail) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(randomUUID(), new Date().toISOString(), ctx?.action ?? "", ctx?.accountType ?? null, ctx?.accountId ?? null, kind, clean);
  } catch {
    // o log no console já basta se o banco falhar
  }
}

export type AiErrorRow = { id: string; createdAt: string; action: string; accountType: string | null; accountId: string | null; kind: string; detail: string };

export function recentAiErrors(limit = 30): AiErrorRow[] {
  return db.prepare("SELECT * FROM ai_errors ORDER BY createdAt DESC LIMIT ?").all(limit) as AiErrorRow[];
}

export type AccountUsageRow = { accountType: string | null; accountId: string | null; calls: number; costUsd: number; lastAt: string };

export function usageByAccount(days = 30): AccountUsageRow[] {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  return db
    .prepare(
      `SELECT accountType, accountId, COUNT(*) AS calls, SUM(costUsd) AS costUsd, MAX(createdAt) AS lastAt
       FROM ai_usage WHERE createdAt >= ? GROUP BY accountType, accountId ORDER BY costUsd DESC LIMIT 200`
    )
    .all(since) as AccountUsageRow[];
}

export function spendByDay(days = 14): { day: string; costUsd: number; calls: number }[] {
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  return db
    .prepare("SELECT day, SUM(costUsd) AS costUsd, COUNT(*) AS calls FROM ai_usage WHERE day >= ? GROUP BY day ORDER BY day")
    .all(since) as { day: string; costUsd: number; calls: number }[];
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
