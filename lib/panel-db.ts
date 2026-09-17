import { randomUUID } from "crypto";
import { db, tenantColumn } from "./db";
import { clicksByPost } from "./links-db";
import { calibration, type PanelResult, type Persona } from "./panel-rules";

// Testes do painel sintético: variantes, personas usadas, resultado e (quando
// as variantes vão ao ar) os posts de cada uma para comparar com os cliques.

export type PanelTest = {
  id: string;
  clientId: string;
  postId: string | null;
  variants: string[];
  personas: Persona[];
  generic: boolean;
  result: PanelResult;
  predictedWinner: number;
  variantPostIds: (string | null)[];
  hash: string;
  demo: boolean;
  createdAt: string;
};

db.exec(`
  CREATE TABLE IF NOT EXISTS panel_tests (
    id TEXT PRIMARY KEY,
    clientId TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    postId TEXT,
    variantsJson TEXT NOT NULL,
    personasJson TEXT NOT NULL,
    generic INTEGER NOT NULL DEFAULT 0,
    resultJson TEXT NOT NULL,
    predictedWinner INTEGER NOT NULL DEFAULT 0,
    variantPostsJson TEXT NOT NULL DEFAULT '[]',
    hash TEXT NOT NULL,
    demo INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_panel_tests_client ON panel_tests(clientId, createdAt);
  CREATE INDEX IF NOT EXISTS idx_panel_tests_hash ON panel_tests(hash);
`);
tenantColumn("panel_tests");

type Row = { id: string; clientId: string; postId: string | null; variantsJson: string; personasJson: string; generic: number; resultJson: string; predictedWinner: number; variantPostsJson: string; hash: string; demo: number; createdAt: string };
const toTest = (r: Row): PanelTest => ({
  id: r.id,
  clientId: r.clientId,
  postId: r.postId,
  variants: JSON.parse(r.variantsJson),
  personas: JSON.parse(r.personasJson),
  generic: r.generic === 1,
  result: JSON.parse(r.resultJson),
  predictedWinner: r.predictedWinner,
  variantPostIds: JSON.parse(r.variantPostsJson),
  hash: r.hash,
  demo: r.demo === 1,
  createdAt: r.createdAt,
});

export function findByHash(hash: string): PanelTest | null {
  const row = db.prepare("SELECT * FROM panel_tests WHERE hash = ? ORDER BY createdAt DESC LIMIT 1").get(hash) as Row | undefined;
  return row ? toTest(row) : null;
}

export function getPanelTest(id: string): PanelTest | null {
  const row = db.prepare("SELECT * FROM panel_tests WHERE id = ?").get(id) as Row | undefined;
  return row ? toTest(row) : null;
}

export function listPanelTests(clientId: string, limit = 20): PanelTest[] {
  return (db.prepare("SELECT * FROM panel_tests WHERE clientId = ? ORDER BY createdAt DESC LIMIT ?").all(clientId, limit) as Row[]).map(toTest);
}

export function savePanelTest(input: Omit<PanelTest, "id" | "createdAt" | "variantPostIds" | "predictedWinner">): PanelTest {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO panel_tests (id, agencyId, clientId, postId, variantsJson, personasJson, generic, resultJson, predictedWinner, variantPostsJson, hash, demo, createdAt)
     VALUES (?, (SELECT agencyId FROM clients WHERE id = ?), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.clientId,
    input.clientId,
    input.postId,
    JSON.stringify(input.variants),
    JSON.stringify(input.personas),
    input.generic ? 1 : 0,
    JSON.stringify(input.result),
    input.result.winner,
    JSON.stringify(input.variants.map(() => null)),
    input.hash,
    input.demo ? 1 : 0,
    new Date().toISOString()
  );
  return getPanelTest(id)!;
}

export function linkVariantPost(testId: string, variant: number, postId: string): PanelTest | null {
  const test = getPanelTest(testId);
  if (!test || variant < 0 || variant >= test.variants.length) return null;
  const posts = [...test.variantPostIds];
  posts[variant] = postId;
  db.prepare("UPDATE panel_tests SET variantPostsJson = ? WHERE id = ?").run(JSON.stringify(posts), testId);
  return getPanelTest(testId);
}

// "O painel acertou X de Y" com os cliques dos links de cada variante.
export function clientCalibration(clientId: string) {
  const clicks = clicksByPost(clientId);
  const published = new Set(
    (db.prepare("SELECT id FROM scheduled_posts WHERE clientId = ? AND status = 'published'").all(clientId) as { id: string }[]).map((r) => r.id)
  );
  const tests = listPanelTests(clientId, 200).map((t) => ({
    predictedWinner: t.predictedWinner,
    clicksByVariant: t.variantPostIds.map((postId) => (postId && published.has(postId) ? (clicks.get(postId) ?? 0) : null)),
  }));
  return calibration(tests);
}
