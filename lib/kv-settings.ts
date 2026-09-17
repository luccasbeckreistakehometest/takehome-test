import { db } from "./db";

// Configurações de features novas em chave/valor (JSON), separadas da tabela
// `settings` (que é uma linha larga com migração por coluna). Cada feature
// declara seu tipo e default; o merge com o default protege bancos antigos.
db.exec(`
  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );
`);

export function getKv<T extends object>(key: string, fallback: T): T {
  const row = db.prepare("SELECT value FROM app_settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  if (!row) return { ...fallback };
  try {
    return { ...fallback, ...(JSON.parse(row.value) as Partial<T>) };
  } catch {
    return { ...fallback };
  }
}

export function setKv<T extends object>(key: string, value: T): T {
  db.prepare(
    `INSERT INTO app_settings (key, value, updatedAt) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt`
  ).run(key, JSON.stringify(value), new Date().toISOString());
  return value;
}
