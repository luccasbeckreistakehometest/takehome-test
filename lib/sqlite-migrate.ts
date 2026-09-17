import type Database from "better-sqlite3";

// Migração de coluna idempotente e segura entre processos. O `next build`
// importa os módulos (que migram ao carregar) em vários workers ao mesmo
// tempo, todos no mesmo arquivo: dois deles podem ver a coluna faltando e
// ambos tentarem o ALTER — o segundo falhava com "duplicate column name".
// `table`/`column`/`definition` são sempre literais do código.
export function addColumn(
  database: Pick<Database.Database, "prepare" | "exec">,
  table: string,
  column: string,
  definition: string
): void {
  const columns = (database.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name);
  // Tabela inexistente: quem a cria ainda não carregou; a migração roda quando carregar.
  if (columns.length === 0 || columns.includes(column)) return;
  try {
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  } catch (error) {
    if (!(error instanceof Error && /duplicate column name/i.test(error.message))) throw error;
  }
}

// CREATE INDEX IF NOT EXISTS ainda pode perder a corrida para outro worker.
export function createIndex(database: Pick<Database.Database, "exec">, sql: string): void {
  try {
    database.exec(sql);
  } catch (error) {
    if (!(error instanceof Error && /already exists/i.test(error.message))) throw error;
  }
}

export function tableExists(database: Pick<Database.Database, "prepare">, table: string): boolean {
  return Boolean(database.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table));
}

export function hasColumn(database: Pick<Database.Database, "prepare">, table: string, column: string): boolean {
  return (database.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).some((c) => c.name === column);
}
