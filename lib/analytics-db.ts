import { randomUUID } from "crypto";
import { addColumnIfMissing, db } from "./db";
import "./auth"; // cria a tabela users antes das colunas de atribuição
import {
  audienceFromRole,
  FUNNEL_STEPS,
  retentionCutoff,
  sanitizeUtm,
  type Audience,
  type EventName,
  type FunnelStep,
  type Utm,
} from "./analytics-rules";

// Eventos de página e de conversão, sem cookie. Os eventos crus ficam 90
// dias; o resumo diário (contagens) fica para sempre.

db.exec(`
  CREATE TABLE IF NOT EXISTS page_events (
    id TEXT PRIMARY KEY,
    ts TEXT NOT NULL,
    day TEXT NOT NULL,
    name TEXT NOT NULL,
    path TEXT NOT NULL DEFAULT '',
    audience TEXT NOT NULL DEFAULT 'geral',
    utmSource TEXT NOT NULL DEFAULT '',
    utmMedium TEXT NOT NULL DEFAULT '',
    utmCampaign TEXT NOT NULL DEFAULT '',
    utmContent TEXT NOT NULL DEFAULT '',
    referrerHost TEXT NOT NULL DEFAULT '',
    lang TEXT NOT NULL DEFAULT 'pt',
    device TEXT NOT NULL DEFAULT '',
    visitorHash TEXT NOT NULL DEFAULT '',
    userId TEXT,
    metaJson TEXT NOT NULL DEFAULT '{}'
  );
  CREATE INDEX IF NOT EXISTS idx_page_events_day ON page_events(day, name);
  CREATE INDEX IF NOT EXISTS idx_page_events_user ON page_events(userId, name);
  CREATE TABLE IF NOT EXISTS page_events_daily (
    day TEXT NOT NULL,
    name TEXT NOT NULL,
    audience TEXT NOT NULL,
    source TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    uniques INTEGER,
    PRIMARY KEY (day, name, audience, source)
  );
`);
// 1º toque (UTM) de quem se cadastrou
addColumnIfMissing("users", "signupUtmJson", "TEXT NOT NULL DEFAULT '{}'");
addColumnIfMissing("users", "signupAudience", "TEXT NOT NULL DEFAULT ''");

export type EventInput = {
  name: EventName;
  path?: string;
  audience: Audience;
  utm?: Utm;
  referrerHost?: string;
  lang?: string;
  device?: string;
  visitorHash?: string;
  userId?: string | null;
  meta?: Record<string, unknown>;
  at?: Date;
};

export function recordEvent(input: EventInput): void {
  const at = input.at ?? new Date();
  const ts = at.toISOString();
  const day = ts.slice(0, 10);
  const utm = input.utm ?? sanitizeUtm({});
  db.transaction(() => {
    db.prepare(
      `INSERT INTO page_events (id, ts, day, name, path, audience, utmSource, utmMedium, utmCampaign, utmContent, referrerHost, lang, device, visitorHash, userId, metaJson)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      randomUUID(),
      ts,
      day,
      input.name,
      input.path ?? "",
      input.audience,
      utm.source,
      utm.medium,
      utm.campaign,
      utm.content,
      input.referrerHost ?? "",
      input.lang ?? "pt",
      input.device ?? "",
      input.visitorHash ?? "",
      input.userId ?? null,
      JSON.stringify(input.meta ?? {})
    );
    db.prepare(
      `INSERT INTO page_events_daily (day, name, audience, source, count) VALUES (?, ?, ?, ?, 1)
       ON CONFLICT(day, name, audience, source) DO UPDATE SET count = count + 1`
    ).run(day, input.name, input.audience, utm.source);
  }).immediate();
}

// Evento do servidor atribuído à pessoa (público e UTM do cadastro dela).
export function recordUserEvent(name: EventName, userId: string, meta: Record<string, unknown> = {}, opts: { once?: boolean } = {}): void {
  try {
    if (opts.once && db.prepare("SELECT 1 FROM page_events WHERE userId = ? AND name = ? LIMIT 1").get(userId, name)) return;
    const user = db.prepare("SELECT role, signupUtmJson, signupAudience FROM users WHERE id = ?").get(userId) as
      | { role: string; signupUtmJson: string; signupAudience: string }
      | undefined;
    if (!user) return;
    let utm = sanitizeUtm({});
    try {
      utm = sanitizeUtm(JSON.parse(user.signupUtmJson || "{}"));
    } catch {
      /* sem UTM */
    }
    const audience = (user.signupAudience || audienceFromRole(user.role)) as Audience;
    recordEvent({ name, audience, utm, userId, meta });
  } catch (error) {
    console.error("[analytics] evento não gravado:", error);
  }
}

// Pagamento: a conta de billing → a pessoa que a abriu.
export function recordAccountEvent(name: EventName, account: { accountType: string; accountId: string }, meta: Record<string, unknown> = {}): void {
  const row = (
    account.accountType === "agency"
      ? db.prepare("SELECT id FROM users WHERE role = 'agency' AND agencyId = ? ORDER BY createdAt LIMIT 1").get(account.accountId)
      : db.prepare("SELECT id FROM users WHERE refId = ? ORDER BY createdAt LIMIT 1").get(account.accountId)
  ) as { id: string } | undefined;
  if (row) recordUserEvent(name, row.id, meta);
}

export function saveSignupAttribution(userId: string, utm: Utm, audience: Audience): void {
  db.prepare("UPDATE users SET signupUtmJson = ?, signupAudience = ? WHERE id = ?").run(JSON.stringify(utm), audience, userId);
}

// Retenção: antes de apagar os crus, grava os visitantes únicos do dia.
export function pruneEvents(now: Date = new Date()): number {
  const cutoff = retentionCutoff(now);
  return db
    .transaction(() => {
      const days = db.prepare("SELECT DISTINCT day FROM page_events WHERE ts < ?").all(cutoff) as { day: string }[];
      for (const { day } of days) {
        const rows = db
          .prepare("SELECT name, audience, utmSource AS source, COUNT(DISTINCT visitorHash) AS uniques FROM page_events WHERE day = ? GROUP BY name, audience, utmSource")
          .all(day) as { name: string; audience: string; source: string; uniques: number }[];
        for (const r of rows) {
          db.prepare("UPDATE page_events_daily SET uniques = ? WHERE day = ? AND name = ? AND audience = ? AND source = ?").run(r.uniques, day, r.name, r.audience, r.source);
        }
      }
      return db.prepare("DELETE FROM page_events WHERE ts < ?").run(cutoff).changes;
    })
    .immediate();
}

export type AnalyticsFilter = { days: number; audience?: Audience | ""; source?: string };

function whereFor(filter: AnalyticsFilter): { sql: string; params: string[] } {
  const since = new Date(Date.now() - filter.days * 86_400_000).toISOString().slice(0, 10);
  const clauses = ["day >= ?"];
  const params = [since];
  if (filter.audience) {
    clauses.push("audience = ?");
    params.push(filter.audience);
  }
  if (filter.source !== undefined && filter.source !== "") {
    clauses.push("utmSource = ?");
    params.push(filter.source === "(direto)" ? "" : filter.source);
  }
  return { sql: clauses.join(" AND "), params };
}

// Funil: passos da web contam visitantes únicos; do servidor, pessoas.
export function funnelCounts(filter: AnalyticsFilter): Record<FunnelStep, number> {
  const where = whereFor(filter);
  const out = {} as Record<FunnelStep, number>;
  for (const step of FUNNEL_STEPS) {
    const web = step === "view" || step === "cta_click" || step === "signup_started";
    const row = db
      .prepare(
        web
          ? `SELECT COUNT(DISTINCT day || visitorHash) AS c FROM page_events WHERE name = ? AND ${where.sql}`
          : `SELECT COUNT(DISTINCT COALESCE(userId, id)) AS c FROM page_events WHERE name = ? AND ${where.sql}`
      )
      .get(step, ...where.params) as { c: number };
    out[step] = row.c;
  }
  return out;
}

export function visitorsPerDay(filter: AnalyticsFilter): { day: string; visitors: number; views: number }[] {
  const where = whereFor(filter);
  return db
    .prepare(
      `SELECT day, COUNT(DISTINCT visitorHash) AS visitors, COUNT(*) AS views FROM page_events
       WHERE name = 'view' AND ${where.sql} GROUP BY day ORDER BY day`
    )
    .all(...where.params) as { day: string; visitors: number; views: number }[];
}

export function topSources(filter: AnalyticsFilter): { source: string; campaign: string; visitors: number; signups: number }[] {
  const where = whereFor({ ...filter, source: undefined });
  return db
    .prepare(
      `SELECT utmSource AS source, utmCampaign AS campaign,
         COUNT(DISTINCT CASE WHEN name = 'view' THEN day || visitorHash END) AS visitors,
         COUNT(DISTINCT CASE WHEN name = 'signup_completed' THEN userId END) AS signups
       FROM page_events WHERE ${where.sql} GROUP BY utmSource, utmCampaign ORDER BY visitors DESC, signups DESC LIMIT 20`
    )
    .all(...where.params) as { source: string; campaign: string; visitors: number; signups: number }[];
}

export function recentSignups(limit = 30): { username: string; role: string; createdAt: string; audience: string; utm: Utm }[] {
  const rows = db
    .prepare("SELECT username, role, createdAt, signupAudience, signupUtmJson FROM users WHERE role != 'admin' ORDER BY createdAt DESC LIMIT ?")
    .all(limit) as { username: string; role: string; createdAt: string; signupAudience: string; signupUtmJson: string }[];
  return rows.map((r) => {
    let utm = sanitizeUtm({});
    try {
      utm = sanitizeUtm(JSON.parse(r.signupUtmJson || "{}"));
    } catch {
      /* sem UTM */
    }
    return { username: r.username, role: r.role, createdAt: r.createdAt, audience: r.signupAudience || audienceFromRole(r.role), utm };
  });
}

// Primeiros passos concluídos (evento activation_step, um por conta e passo).
export function activationCounts(filter: AnalyticsFilter): { step: string; accounts: number }[] {
  const where = whereFor(filter);
  return db
    .prepare(
      `SELECT json_extract(metaJson, '$.step') AS step, COUNT(DISTINCT userId) AS accounts FROM page_events
       WHERE name = 'activation_step' AND ${where.sql} GROUP BY step ORDER BY step`
    )
    .all(...where.params)
    .filter((r): r is { step: string; accounts: number } => typeof (r as { step: unknown }).step === "string");
}

export function dailyRows(days: number): { day: string; audience: string; source: string; step: string; count: number }[] {
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  return db
    .prepare("SELECT day, audience, source, name AS step, count FROM page_events_daily WHERE day >= ? ORDER BY day, audience, source, name")
    .all(since) as { day: string; audience: string; source: string; step: string; count: number }[];
}
