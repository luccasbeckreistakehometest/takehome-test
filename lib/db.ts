import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { Client, ClientInput, Generation, GenerationType } from "./types";
import { addColumn, createIndex } from "./sqlite-migrate";
import { migrateTenancy } from "./tenancy-migration";
import { scopeWhere, type TenantScope } from "./tenancy-rules";

export { addColumn };

function createDb() {
  const dataDir = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
  fs.mkdirSync(dataDir, { recursive: true });
  // timeout: workers paralelos do build esperam o lock da migração.
  const db = new Database(path.join(dataDir, "agencyhub.db"), { timeout: 15_000 });
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      industry TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      audience TEXT NOT NULL DEFAULT '',
      tone TEXT NOT NULL DEFAULT '',
      goals TEXT NOT NULL DEFAULT '',
      budget TEXT NOT NULL DEFAULT '',
      channels TEXT NOT NULL DEFAULT '[]',
      differentials TEXT NOT NULL DEFAULT '',
      competitors TEXT NOT NULL DEFAULT '',
      brandColors TEXT NOT NULL DEFAULT '',
      website TEXT NOT NULL DEFAULT '',
      instagram TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      capabilities TEXT NOT NULL DEFAULT '',
      language TEXT NOT NULL DEFAULT 'pt-BR',
      source TEXT NOT NULL DEFAULT 'agency',
      country TEXT NOT NULL DEFAULT 'Brasil',
      selfServe INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS generations (
      id TEXT PRIMARY KEY,
      clientId TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      params TEXT NOT NULL DEFAULT '{}',
      content TEXT NOT NULL,
      actuals TEXT NOT NULL DEFAULT '{}',
      createdAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_generations_client ON generations(clientId, type, createdAt);
  `);
  db.pragma("foreign_keys = ON");

  // Migrações leves para bancos criados em versões anteriores
  addColumn(db, "clients", "language", "TEXT NOT NULL DEFAULT 'pt-BR'");
  addColumn(db, "clients", "source", "TEXT NOT NULL DEFAULT 'agency'");
  addColumn(db, "clients", "country", "TEXT NOT NULL DEFAULT 'Brasil'");
  addColumn(db, "clients", "capabilities", "TEXT NOT NULL DEFAULT ''");
  addColumn(db, "clients", "selfServe", "INTEGER NOT NULL DEFAULT 0");
  addColumn(db, "generations", "actuals", "TEXT NOT NULL DEFAULT '{}'");

  // Multi-tenant: agências + agencyId em toda tabela que já existe (uma vez).
  migrateTenancy(db);

  return db;
}

// Reuse the connection across Next.js hot reloads in dev
const globalForDb = globalThis as unknown as { __agencyhubDb?: Database.Database };
export const db = globalForDb.__agencyhubDb ?? createDb();
globalForDb.__agencyhubDb = db;

// Migração de coluna idempotente e segura entre processos. O `next build`
// importa os módulos (que migram ao carregar) em vários workers ao mesmo
// tempo, todos no mesmo arquivo: dois deles podem ver a coluna faltando e
// ambos tentarem o ALTER — o segundo falhava com "duplicate column name" e
// derrubava o build (no Docker o banco nasce vazio, então todo ALTER roda).
// Toda migração de coluna passa por aqui; `table`/`column`/`definition` são
// sempre literais do código, nunca entrada de usuário.
export function addColumnIfMissing(table: string, column: string, definition: string): void {
  addColumn(db, table, column, definition);
}

// Coluna de tenant (agencyId) + índice, para tabelas criadas depois da
// migração inicial (banco novo). Chamar logo após o CREATE TABLE do módulo.
export function tenantColumn(table: string): void {
  addColumn(db, table, "agencyId", "TEXT");
  createIndex(db, `CREATE INDEX IF NOT EXISTS idx_${table}_agency ON ${table}(agencyId)`);
}

tenantColumn("clients");
tenantColumn("generations");

type ClientRow = Omit<Client, "channels" | "selfServe"> & {
  channels: string;
  selfServe: number;
};
type GenerationRow = Omit<Generation, "params" | "actuals"> & {
  params: string;
  actuals: string;
};

function toClient(row: ClientRow): Client {
  return {
    ...row,
    agencyId: row.agencyId ?? "",
    channels: JSON.parse(row.channels),
    language: row.language === "en" ? "en" : "pt-BR",
    source: row.source === "self" ? "self" : "agency",
    selfServe: Number(row.selfServe) === 1,
  };
}

function toGeneration(row: GenerationRow): Generation {
  let actuals: Record<string, string> = {};
  try {
    actuals = JSON.parse(row.actuals || "{}");
  } catch {
    actuals = {};
  }
  return {
    ...row,
    type: row.type as GenerationType,
    params: JSON.parse(row.params),
    actuals,
  };
}

export function updateGenerationContent(id: string, content: string): Generation | null {
  const result = db
    .prepare("UPDATE generations SET content = ? WHERE id = ?")
    .run(content, id);
  return result.changes > 0 ? getGeneration(id) : null;
}

export function updateGenerationActuals(
  id: string,
  actuals: Record<string, string>
): Generation | null {
  const result = db
    .prepare("UPDATE generations SET actuals = ? WHERE id = ?")
    .run(JSON.stringify(actuals), id);
  return result.changes > 0 ? getGeneration(id) : null;
}

export function listClients(scope: TenantScope): Client[] {
  const where = scopeWhere(scope);
  const rows = db
    .prepare(`SELECT * FROM clients WHERE ${where.sql} ORDER BY createdAt DESC`)
    .all(...where.params) as ClientRow[];
  return rows.map(toClient);
}

// Agência dona do cliente (null = cliente inexistente).
export function clientAgencyId(clientId: string): string | null {
  const row = db.prepare("SELECT agencyId FROM clients WHERE id = ?").get(clientId) as { agencyId: string | null } | undefined;
  return row ? (row.agencyId ?? null) : null;
}

export function getClient(id: string): Client | null {
  const row = db.prepare("SELECT * FROM clients WHERE id = ?").get(id) as
    | ClientRow
    | undefined;
  return row ? toClient(row) : null;
}

// Alterna só o modo da marca (autônoma x gerenciada por agência) sem tocar no
// resto do briefing. Usado pelo seletor de modo do onboarding.
export function setClientSelfServe(id: string, selfServe: boolean): Client | null {
  const existing = getClient(id);
  if (!existing) return null;
  db.prepare("UPDATE clients SET selfServe=? WHERE id=?").run(selfServe ? 1 : 0, id);
  return getClient(id);
}

export function createClient(input: ClientInput, agencyId: string): Client {
  if (!agencyId) throw new Error("createClient: agência obrigatória");
  const client: Client = {
    ...input,
    agencyId,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };
  db.prepare(
    `INSERT INTO clients (id, agencyId, name, industry, description, audience, tone, goals, budget, channels, differentials, competitors, brandColors, website, instagram, notes, capabilities, language, source, country, selfServe, createdAt)
     VALUES (@id, @agencyId, @name, @industry, @description, @audience, @tone, @goals, @budget, @channels, @differentials, @competitors, @brandColors, @website, @instagram, @notes, @capabilities, @language, @source, @country, @selfServe, @createdAt)`
  ).run({
    ...client,
    channels: JSON.stringify(client.channels),
    selfServe: client.selfServe ? 1 : 0,
  });
  return client;
}

export function updateClient(id: string, input: ClientInput): Client | null {
  const existing = getClient(id);
  if (!existing) return null;
  db.prepare(
    `UPDATE clients SET name=@name, industry=@industry, description=@description, audience=@audience, tone=@tone, goals=@goals, budget=@budget, channels=@channels, differentials=@differentials, competitors=@competitors, brandColors=@brandColors, website=@website, instagram=@instagram, notes=@notes, capabilities=@capabilities, language=@language, country=@country, selfServe=@selfServe
     WHERE id=@id`
  ).run({
    ...input,
    id,
    channels: JSON.stringify(input.channels),
    selfServe: input.selfServe ? 1 : 0,
  });
  return getClient(id);
}

export function deleteClient(id: string): boolean {
  const result = db.prepare("DELETE FROM clients WHERE id = ?").run(id);
  return result.changes > 0;
}

export function listGenerations(clientId: string, type?: GenerationType): Generation[] {
  const rows = (
    type
      ? db
          .prepare(
            "SELECT * FROM generations WHERE clientId = ? AND type = ? ORDER BY createdAt DESC"
          )
          .all(clientId, type)
      : db
          .prepare("SELECT * FROM generations WHERE clientId = ? ORDER BY createdAt DESC")
          .all(clientId)
  ) as GenerationRow[];
  return rows.map(toGeneration);
}

export function getGeneration(id: string): Generation | null {
  const row = db.prepare("SELECT * FROM generations WHERE id = ?").get(id) as
    | GenerationRow
    | undefined;
  return row ? toGeneration(row) : null;
}

export function createGeneration(input: {
  clientId: string;
  type: GenerationType;
  title: string;
  params: Record<string, unknown>;
  content: string;
}): Generation {
  const generation: Generation = {
    ...input,
    actuals: {},
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };
  db.prepare(
    `INSERT INTO generations (id, agencyId, clientId, type, title, params, content, actuals, createdAt)
     VALUES (@id, (SELECT agencyId FROM clients WHERE id = @clientId), @clientId, @type, @title, @params, @content, @actuals, @createdAt)`
  ).run({ ...generation, params: JSON.stringify(generation.params), actuals: "{}" });
  return generation;
}

export function deleteGeneration(id: string): boolean {
  const result = db.prepare("DELETE FROM generations WHERE id = ?").run(id);
  return result.changes > 0;
}
