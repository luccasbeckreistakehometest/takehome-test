import { randomUUID, scryptSync, timingSafeEqual } from "crypto";
import { addColumnIfMissing, db, listClients } from "./db";
import { listProfessionals } from "./marketplace-db";

export type BrandSource = "agency" | "platform";

export type User = {
  id: string;
  username: string;
  role: "admin" | "agency" | "client" | "professional";
  refId: string | null;
  name: string;
  // whitelabel: "agency" = convidado por uma agência (vê a marca dela);
  // "platform" = auto-cadastrado (vê a marca da plataforma)
  brandSource: BrandSource;
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
    brandSource TEXT NOT NULL DEFAULT 'agency',
    onboardedAt TEXT,
    createdAt TEXT NOT NULL
  );
`);
// Migração leve
addColumnIfMissing("users", "brandSource", "TEXT NOT NULL DEFAULT 'agency'");
addColumnIfMissing("users", "onboardedAt", "TEXT");

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
  brandSource?: BrandSource;
}): { username: string; id: string } {
  let username = input.username ?? slugify(input.name);
  let suffix = 1;
  while (db.prepare("SELECT 1 FROM users WHERE username = ?").get(username)) {
    suffix += 1;
    username = `${input.username ?? slugify(input.name)}${suffix}`;
  }
  const id = randomUUID();
  db.prepare(
    "INSERT INTO users (id, username, passwordHash, role, refId, name, brandSource, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(
    id,
    username,
    hashPassword(input.password),
    input.role,
    input.refId,
    input.name,
    input.brandSource ?? "agency",
    new Date().toISOString()
  );
  return { username, id };
}

export function markOnboarded(userId: string): void {
  db.prepare("UPDATE users SET onboardedAt = ? WHERE id = ?").run(
    new Date().toISOString(),
    userId
  );
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
    brandSource: (row.brandSource as BrandSource) ?? "agency",
    createdAt: row.createdAt,
  };
}

// Home de destino por papel após o login. Marca em modo autônomo (selfServe)
// cai direto no workspace próprio; marca gerenciada por agência, no portal.
export function homeForUser(
  user: Pick<User, "role" | "refId">,
  opts?: { selfServe?: boolean }
): string {
  if (user.role === "admin") return "/admin";
  if (user.role === "client") {
    return opts?.selfServe ? `/clients/${user.refId}` : `/portal/client/${user.refId}`;
  }
  if (user.role === "professional") return `/professionals/${user.refId}`;
  return "/";
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
// Em produção defina SEED_PASSWORD com uma senha forte; troque as senhas das
// contas seed (admin/agencia) após o primeiro acesso.
const DEFAULT_PASSWORD = process.env.SEED_PASSWORD || "luccas123";
// Admin geral da plataforma: controla agências, clientes, profissionais,
// planos e receita. Login: admin / luccas123
// O `next build` carrega este módulo em vários workers ao mesmo tempo, todos
// no mesmo arquivo. Sem serializar, dois deles viam "não há admin": ou o build
// caía na unicidade do username, ou nascia um segundo admin ("admin2").
// BEGIN IMMEDIATE faz o próximo esperar o anterior e reler com os usuários já
// criados — no Docker o banco do build nasce vazio, então isso roda sempre.
db.transaction(() => {
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
}).immediate();
