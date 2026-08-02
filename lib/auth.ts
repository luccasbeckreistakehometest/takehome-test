import { randomUUID, scryptSync, timingSafeEqual } from "crypto";
import { db, listClients } from "./db";
import { listProfessionals } from "./marketplace-db";

export type User = {
  id: string;
  username: string;
  role: "admin" | "agency" | "client" | "professional";
  refId: string | null;
  name: string;
  createdAt: string;
};

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    passwordHash TEXT NOT NULL,
    role TEXT NOT NULL,
    refId TEXT,
    name TEXT NOT NULL,
    createdAt TEXT NOT NULL
  );
`);

function hashPassword(password: string): string {
  const salt = randomUUID().slice(0, 8);
  return `${salt}:${scryptSync(password, salt, 32).toString("hex")}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 32);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, ".")
      .replace(/^\.|\.$/g, "") || "usuario"
  );
}

export function createUser(input: {
  username?: string;
  password: string;
  role: User["role"];
  refId: string | null;
  name: string;
}): { username: string } {
  let username = input.username ?? slugify(input.name);
  let suffix = 1;
  while (db.prepare("SELECT 1 FROM users WHERE username = ?").get(username)) {
    suffix += 1;
    username = `${input.username ?? slugify(input.name)}${suffix}`;
  }
  db.prepare(
    "INSERT INTO users (id, username, passwordHash, role, refId, name, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(
    randomUUID(),
    username,
    hashPassword(input.password),
    input.role,
    input.refId,
    input.name,
    new Date().toISOString()
  );
  return { username };
}

export function verifyLogin(username: string, password: string): User | null {
  const row = db
    .prepare("SELECT * FROM users WHERE username = ?")
    .get(username.toLowerCase().trim()) as (User & { passwordHash: string }) | undefined;
  if (!row || !verifyPassword(password, row.passwordHash)) return null;
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    refId: row.refId,
    name: row.name,
    createdAt: row.createdAt,
  };
}

export function listUsers(): { username: string; role: string; name: string }[] {
  return db
    .prepare("SELECT username, role, name FROM users ORDER BY role, username")
    .all() as { username: string; role: string; name: string }[];
}

export function userExistsForRef(refId: string): boolean {
  return Boolean(db.prepare("SELECT 1 FROM users WHERE refId = ?").get(refId));
}

// Seed: cria logins (senha luccas123) para a agência e para todos os
// clientes/profissionais já cadastrados — idempotente
const DEFAULT_PASSWORD = "luccas123";
// Admin geral da plataforma: controla agências, clientes, profissionais,
// planos e receita. Login: admin / luccas123
if (!db.prepare("SELECT 1 FROM users WHERE role = 'admin'").get()) {
  createUser({
    username: "admin",
    password: DEFAULT_PASSWORD,
    role: "admin",
    refId: null,
    name: "Admin da Plataforma",
  });
}
if (!db.prepare("SELECT 1 FROM users WHERE role = 'agency'").get()) {
  createUser({
    username: "agencia",
    password: DEFAULT_PASSWORD,
    role: "agency",
    refId: null,
    name: "Agência",
  });
}
for (const client of listClients()) {
  if (!userExistsForRef(client.id)) {
    createUser({
      password: DEFAULT_PASSWORD,
      role: "client",
      refId: client.id,
      name: client.name,
    });
  }
}
for (const professional of listProfessionals()) {
  if (!userExistsForRef(professional.id)) {
    createUser({
      password: DEFAULT_PASSWORD,
      role: "professional",
      refId: professional.id,
      name: professional.name,
    });
  }
}
