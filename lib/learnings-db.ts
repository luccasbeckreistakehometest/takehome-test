import { createHash } from "crypto";
import { db } from "./db";
// listScheduledPosts/listSales também garantem scheduled_posts e metric_snapshots
import { listScheduledPosts } from "./marketplace-db";
import { listSales } from "./integrations-db";
import { computeLearnings, type Learnings, type LearningSnapshot, type LearningsReading } from "./learnings-rules";

// "O que funciona pra este cliente": os números são calculados ao vivo; a
// leitura de 3 linhas da IA é salva por (cliente, mês) junto com o hash dos
// números que ela leu — números mudaram, a leitura fica marcada como velha.

db.exec(`
  CREATE TABLE IF NOT EXISTS client_learnings (
    clientId TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    month TEXT NOT NULL,
    dataHash TEXT NOT NULL,
    reading TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    PRIMARY KEY (clientId, month)
  );
`);

export function learningsHash(l: Learnings): string {
  return createHash("sha256")
    .update(JSON.stringify({ m: l.month, metric: l.metric, b: l.baseline, n: l.postsAnalyzed, best: l.best, worst: l.worst, dims: l.dimensions }))
    .digest("hex");
}

export function loadLearnings(clientId: string, month: string): Learnings {
  const posts = listScheduledPosts(clientId).map((p) => ({
    id: p.id,
    channel: p.channel,
    status: p.status,
    scheduledFor: p.scheduledFor,
    format: p.format,
    hookType: p.hookType,
  }));
  const snapshots = db.prepare("SELECT platform, periodStart, periodEnd, clicks, conversions, revenue, createdAt FROM metric_snapshots WHERE clientId = ?").all(clientId) as LearningSnapshot[];
  return computeLearnings({ month, posts, snapshots, sales: listSales(clientId) });
}

type Row = { dataHash: string; reading: string; createdAt: string };

export function getReading(clientId: string, month: string, hash: string): { reading: LearningsReading & { createdAt: string }; stale: boolean } | null {
  const row = db.prepare("SELECT dataHash, reading, createdAt FROM client_learnings WHERE clientId = ? AND month = ?").get(clientId, month) as Row | undefined;
  if (!row) return null;
  try {
    return { reading: { ...(JSON.parse(row.reading) as LearningsReading), createdAt: row.createdAt }, stale: row.dataHash !== hash };
  } catch {
    return null;
  }
}

// Só a leitura atual (dos mesmos números) — é o que o relatório mensal usa.
export function getFreshReading(clientId: string, month: string, l: Learnings): LearningsReading | null {
  const saved = getReading(clientId, month, learningsHash(l));
  return saved && !saved.stale ? { lines: saved.reading.lines, demo: saved.reading.demo } : null;
}

export function saveReading(clientId: string, month: string, hash: string, reading: LearningsReading): void {
  db.prepare(
    `INSERT INTO client_learnings (clientId, month, dataHash, reading, createdAt) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(clientId, month) DO UPDATE SET dataHash = excluded.dataHash, reading = excluded.reading, createdAt = excluded.createdAt`
  ).run(clientId, month, hash, JSON.stringify(reading), new Date().toISOString());
}
