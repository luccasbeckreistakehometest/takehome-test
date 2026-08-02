import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { Client, ClientInput, Generation, GenerationType } from "./types";

function createDb() {
  const dataDir = path.join(process.cwd(), "data");
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new Database(path.join(dataDir, "agencyhub.db"));
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
      language TEXT NOT NULL DEFAULT 'pt-BR',
      source TEXT NOT NULL DEFAULT 'agency',
      createdAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS generations (
      id TEXT PRIMARY KEY,
      clientId TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      params TEXT NOT NULL DEFAULT '{}',
      content TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_generations_client ON generations(clientId, type, createdAt);
  `);
  db.pragma("foreign_keys = ON");

  // Migrações leves para bancos criados em versões anteriores
  const clientColumns = (
    db.prepare("PRAGMA table_info(clients)").all() as { name: string }[]
  ).map((column) => column.name);
  if (!clientColumns.includes("language")) {
    db.exec("ALTER TABLE clients ADD COLUMN language TEXT NOT NULL DEFAULT 'pt-BR'");
  }
  if (!clientColumns.includes("source")) {
    db.exec("ALTER TABLE clients ADD COLUMN source TEXT NOT NULL DEFAULT 'agency'");
  }

  return db;
}

// Reuse the connection across Next.js hot reloads in dev
const globalForDb = globalThis as unknown as { __agencyhubDb?: Database.Database };
export const db = globalForDb.__agencyhubDb ?? createDb();
globalForDb.__agencyhubDb = db;

type ClientRow = Omit<Client, "channels"> & { channels: string };
type GenerationRow = Omit<Generation, "params"> & { params: string };

function toClient(row: ClientRow): Client {
  return {
    ...row,
    channels: JSON.parse(row.channels),
    language: row.language === "en" ? "en" : "pt-BR",
    source: row.source === "self" ? "self" : "agency",
  };
}

function toGeneration(row: GenerationRow): Generation {
  return { ...row, type: row.type as GenerationType, params: JSON.parse(row.params) };
}

export function listClients(): Client[] {
  const rows = db
    .prepare("SELECT * FROM clients ORDER BY createdAt DESC")
    .all() as ClientRow[];
  return rows.map(toClient);
}

export function getClient(id: string): Client | null {
  const row = db.prepare("SELECT * FROM clients WHERE id = ?").get(id) as
    | ClientRow
    | undefined;
  return row ? toClient(row) : null;
}

export function createClient(input: ClientInput): Client {
  const client: Client = {
    ...input,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };
  db.prepare(
    `INSERT INTO clients (id, name, industry, description, audience, tone, goals, budget, channels, differentials, competitors, brandColors, website, instagram, notes, language, source, createdAt)
     VALUES (@id, @name, @industry, @description, @audience, @tone, @goals, @budget, @channels, @differentials, @competitors, @brandColors, @website, @instagram, @notes, @language, @source, @createdAt)`
  ).run({ ...client, channels: JSON.stringify(client.channels) });
  return client;
}

export function updateClient(id: string, input: ClientInput): Client | null {
  const existing = getClient(id);
  if (!existing) return null;
  db.prepare(
    `UPDATE clients SET name=@name, industry=@industry, description=@description, audience=@audience, tone=@tone, goals=@goals, budget=@budget, channels=@channels, differentials=@differentials, competitors=@competitors, brandColors=@brandColors, website=@website, instagram=@instagram, notes=@notes, language=@language
     WHERE id=@id`
  ).run({ ...input, id, channels: JSON.stringify(input.channels) });
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
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };
  db.prepare(
    `INSERT INTO generations (id, clientId, type, title, params, content, createdAt)
     VALUES (@id, @clientId, @type, @title, @params, @content, @createdAt)`
  ).run({ ...generation, params: JSON.stringify(generation.params) });
  return generation;
}

export function deleteGeneration(id: string): boolean {
  const result = db.prepare("DELETE FROM generations WHERE id = ?").run(id);
  return result.changes > 0;
}
