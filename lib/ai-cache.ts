import { createHash } from "crypto";
import { db, tenantColumn } from "./db";

// Cache de respostas de IA por hash do conteúdo (mesma entrada = mesma
// resposta, sem nova chamada nem cobrança). Usado pelas features da rodada 3.
db.exec(`
  CREATE TABLE IF NOT EXISTS ai_cache (
    hash TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    clientId TEXT,
    result TEXT NOT NULL,
    createdAt TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_ai_cache_client ON ai_cache(clientId, kind);
`);
tenantColumn("ai_cache");

// JSON estável (chaves ordenadas) para o hash não mudar com a ordem.
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable((value as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

export function aiHash(kind: string, input: unknown): string {
  return createHash("sha256").update(`${kind}:${stable(input)}`).digest("hex");
}

export function readAiCache<T>(hash: string): T | null {
  const row = db.prepare("SELECT result FROM ai_cache WHERE hash = ?").get(hash) as { result: string } | undefined;
  if (!row) return null;
  try {
    return JSON.parse(row.result) as T;
  } catch {
    return null;
  }
}

export function writeAiCache(hash: string, kind: string, clientId: string | null, result: unknown): void {
  db.prepare(
    `INSERT INTO ai_cache (hash, kind, clientId, agencyId, result, createdAt)
     VALUES (?, ?, ?, (SELECT agencyId FROM clients WHERE id = ?), ?, ?)
     ON CONFLICT(hash) DO UPDATE SET result = excluded.result, createdAt = excluded.createdAt`
  ).run(hash, kind, clientId, clientId, JSON.stringify(result), new Date().toISOString());
}
