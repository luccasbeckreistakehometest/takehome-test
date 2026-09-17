import { randomUUID } from "crypto";
import { db, tenantColumn } from "./db";
import { sanitizeQuestions, type QuestionResult, type RadarSummary } from "./ai-visibility-rules";

// Radar de IA: perguntas de compra de cada cliente e as rodadas (resultado
// por pergunta + resumo com participação da marca).

export type RadarRun = {
  id: string;
  clientId: string;
  ranAt: string;
  results: QuestionResult[];
  summary: RadarSummary;
  shareOfVoice: number;
  costUsd: number;
  demo: boolean;
};

db.exec(`
  CREATE TABLE IF NOT EXISTS ai_visibility_queries (
    id TEXT PRIMARY KEY,
    clientId TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    locale TEXT NOT NULL DEFAULT 'pt-BR',
    position INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    createdAt TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_ai_visibility_queries_client ON ai_visibility_queries(clientId, position);
  CREATE TABLE IF NOT EXISTS ai_visibility_runs (
    id TEXT PRIMARY KEY,
    clientId TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    ranAt TEXT NOT NULL,
    resultsJson TEXT NOT NULL,
    summaryJson TEXT NOT NULL,
    shareOfVoice REAL NOT NULL DEFAULT 0,
    mentioned INTEGER NOT NULL DEFAULT 0,
    costUsd REAL NOT NULL DEFAULT 0,
    demo INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_ai_visibility_runs_client ON ai_visibility_runs(clientId, ranAt);
`);
tenantColumn("ai_visibility_queries");
tenantColumn("ai_visibility_runs");

export function listQuestions(clientId: string): string[] {
  return (db.prepare("SELECT question FROM ai_visibility_queries WHERE clientId = ? AND active = 1 ORDER BY position").all(clientId) as { question: string }[]).map((r) => r.question);
}

export function saveQuestions(clientId: string, questions: unknown, locale: string): string[] {
  const clean = sanitizeQuestions(questions);
  const at = new Date().toISOString();
  db.transaction(() => {
    db.prepare("DELETE FROM ai_visibility_queries WHERE clientId = ?").run(clientId);
    const insert = db.prepare(
      `INSERT INTO ai_visibility_queries (id, agencyId, clientId, question, locale, position, active, createdAt)
       VALUES (?, (SELECT agencyId FROM clients WHERE id = ?), ?, ?, ?, ?, 1, ?)`
    );
    clean.forEach((q, i) => insert.run(randomUUID(), clientId, clientId, q, locale, i, at));
  }).immediate();
  return clean;
}

type Row = { id: string; clientId: string; ranAt: string; resultsJson: string; summaryJson: string; shareOfVoice: number; costUsd: number; demo: number };
const toRun = (row: Row): RadarRun => ({
  id: row.id,
  clientId: row.clientId,
  ranAt: row.ranAt,
  results: JSON.parse(row.resultsJson),
  summary: JSON.parse(row.summaryJson),
  shareOfVoice: row.shareOfVoice,
  costUsd: row.costUsd,
  demo: row.demo === 1,
});

export function listRuns(clientId: string, limit = 6): RadarRun[] {
  return (db.prepare("SELECT * FROM ai_visibility_runs WHERE clientId = ? ORDER BY ranAt DESC LIMIT ?").all(clientId, limit) as Row[]).map(toRun);
}

export function lastRunAt(clientId: string): string | null {
  const row = db.prepare("SELECT ranAt FROM ai_visibility_runs WHERE clientId = ? ORDER BY ranAt DESC LIMIT 1").get(clientId) as { ranAt: string } | undefined;
  return row?.ranAt ?? null;
}

export function saveRun(input: Omit<RadarRun, "id" | "shareOfVoice">): RadarRun {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO ai_visibility_runs (id, agencyId, clientId, ranAt, resultsJson, summaryJson, shareOfVoice, mentioned, costUsd, demo)
     VALUES (?, (SELECT agencyId FROM clients WHERE id = ?), ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.clientId,
    input.clientId,
    input.ranAt,
    JSON.stringify(input.results),
    JSON.stringify(input.summary),
    input.summary.shareOfVoice,
    input.summary.clientMentions,
    input.costUsd,
    input.demo ? 1 : 0
  );
  return listRuns(input.clientId, 1)[0];
}

// Rodada do mês para o relatório (a mais recente dentro do mês).
export function monthRun(clientId: string, month: string): RadarRun | null {
  const row = db
    .prepare("SELECT * FROM ai_visibility_runs WHERE clientId = ? AND substr(ranAt, 1, 7) = ? ORDER BY ranAt DESC LIMIT 1")
    .get(clientId, month) as Row | undefined;
  return row ? toRun(row) : null;
}

// Visão da agência: participação mais recente por cliente.
export function agencyRadarOverview(agencyId: string | null): { clientId: string; clientName: string; ranAt: string | null; shareOfVoice: number | null; questions: number }[] {
  const where = agencyId ? "WHERE c.agencyId = ?" : "";
  return db
    .prepare(
      `SELECT c.id AS clientId, c.name AS clientName,
         (SELECT ranAt FROM ai_visibility_runs r WHERE r.clientId = c.id ORDER BY ranAt DESC LIMIT 1) AS ranAt,
         (SELECT shareOfVoice FROM ai_visibility_runs r WHERE r.clientId = c.id ORDER BY ranAt DESC LIMIT 1) AS shareOfVoice,
         (SELECT COUNT(*) FROM ai_visibility_queries q WHERE q.clientId = c.id AND q.active = 1) AS questions
       FROM clients c ${where} ORDER BY ranAt IS NULL, ranAt DESC, c.name LIMIT 200`
    )
    .all(...(agencyId ? [agencyId] : [])) as { clientId: string; clientName: string; ranAt: string | null; shareOfVoice: number | null; questions: number }[];
}

export function runCostUsd(accountType: string | null, accountId: string | null, sinceIso: string): number {
  if (!accountType || !accountId) {
    const row = db.prepare("SELECT COALESCE(SUM(costUsd),0) AS c FROM ai_usage WHERE action = 'ai_radar' AND createdAt >= ? AND accountId IS NULL").get(sinceIso) as { c: number };
    return row.c;
  }
  const row = db
    .prepare("SELECT COALESCE(SUM(costUsd),0) AS c FROM ai_usage WHERE action = 'ai_radar' AND createdAt >= ? AND accountType = ? AND accountId = ?")
    .get(sinceIso, accountType, accountId) as { c: number };
  return row.c;
}
