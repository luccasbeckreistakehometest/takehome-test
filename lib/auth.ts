import { randomBytes, randomInt, scrypt, timingSafeEqual } from "crypto";
import { randomUUID } from "crypto";
import { addColumnIfMissing, db } from "./db";

export type BrandSource = "agency" | "platform";
export type UserRole = "admin" | "agency" | "client" | "professional";

export type User = {
  id: string;
  username: string;
  email: string | null;
  role: UserRole;
  refId: string | null;
  name: string;
  // whitelabel: "agency" = convidado por uma agência (vê a marca dela);
  // "platform" = auto-cadastrado (vê a marca da plataforma)
  brandSource: BrandSource;
  sessionVersion: number;
  disabledAt: string | null;
  mustChangePassword: boolean;
  consentAt: string | null;
  consentVersion: string | null;
  lastLoginAt: string | null;
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
// Migrações leves (idempotentes e seguras entre processos — ver lib/db.ts)
addColumnIfMissing("users", "brandSource", "TEXT NOT NULL DEFAULT 'agency'");
addColumnIfMissing("users", "onboardedAt", "TEXT");
// E-mail: obrigatório no auto-cadastro, opcional para contas antigas.
addColumnIfMissing("users", "email", "TEXT");
// Revogação de sessão: todo cookie carrega a versão; mudar aqui derruba todos.
addColumnIfMissing("users", "sessionVersion", "INTEGER NOT NULL DEFAULT 0");
addColumnIfMissing("users", "disabledAt", "TEXT");
addColumnIfMissing("users", "mustChangePassword", "INTEGER NOT NULL DEFAULT 0");
addColumnIfMissing("users", "passwordChangedAt", "TEXT");
addColumnIfMissing("users", "consentAt", "TEXT");
addColumnIfMissing("users", "consentVersion", "TEXT");
addColumnIfMissing("users", "lastLoginAt", "TEXT");
try {
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL");
} catch (error) {
  // Outro worker do build pode ter criado no mesmo instante.
  if (!(error instanceof Error && /already exists/i.test(error.message))) throw error;
}

// Registro de acesso (Marco Civil da Internet, art. 15): data, IP e resultado
// de cada login, guardados por 6 meses (limpeza no scheduler).
db.exec(`
  CREATE TABLE IF NOT EXISTS auth_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT,
    kind TEXT NOT NULL,
    ip TEXT NOT NULL DEFAULT '',
    createdAt TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_auth_events_created ON auth_events(createdAt);
  CREATE INDEX IF NOT EXISTS idx_auth_events_user ON auth_events(userId, createdAt);
`);

export function recordAuthEvent(input: { userId: string | null; kind: string; ip: string }): void {
  try {
    db.prepare("INSERT INTO auth_events (userId, kind, ip, createdAt) VALUES (?, ?, ?, ?)").run(
      input.userId,
      input.kind.slice(0, 40),
      input.ip.slice(0, 64),
      new Date().toISOString()
    );
  } catch (error) {
    console.error("[auth] registro de acesso falhou:", error);
  }
}

export function purgeAuthEvents(olderThanDays = 183): number {
  const cutoff = new Date(Date.now() - olderThanDays * 86_400_000).toISOString();
  return db.prepare("DELETE FROM auth_events WHERE createdAt < ?").run(cutoff).changes;
}

type UserRow = {
  id: string;
  username: string;
  passwordHash: string;
  email: string | null;
  role: UserRole;
  refId: string | null;
  name: string;
  brandSource: string;
  sessionVersion: number;
  disabledAt: string | null;
  mustChangePassword: number;
  consentAt: string | null;
  consentVersion: string | null;
  lastLoginAt: string | null;
  createdAt: string;
};

function toUser(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    email: row.email ?? null,
    role: row.role,
    refId: row.refId,
    name: row.name,
    brandSource: row.brandSource === "platform" ? "platform" : "agency",
    sessionVersion: Number(row.sessionVersion ?? 0),
    disabledAt: row.disabledAt ?? null,
    mustChangePassword: Number(row.mustChangePassword ?? 0) === 1,
    consentAt: row.consentAt ?? null,
    consentVersion: row.consentVersion ?? null,
    lastLoginAt: row.lastLoginAt ?? null,
    createdAt: row.createdAt,
  };
}

const now = () => new Date().toISOString();

// ---------- Senhas (scrypt assíncrono: não trava o único vCPU) ----------
const KEY_LENGTH = 32;
export const MIN_PASSWORD_LENGTH = 8;

function scryptAsync(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, (error, key) => (error ? reject(error) : resolve(key)));
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(12).toString("hex");
  return `${salt}:${(await scryptAsync(password, salt)).toString("hex")}`;
}

// Mesmo formato "salt:hash" das contas antigas (salt de 8 caracteres) — as
// duas gerações de hash continuam válidas.
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = (stored ?? "").split(":");
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  if (expected.length !== KEY_LENGTH) return false;
  const candidate = await scryptAsync(password, salt);
  return timingSafeEqual(candidate, expected);
}

export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `A senha precisa de pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  if (password.length > 200) return "Senha longa demais.";
  return null;
}

// Senha provisória legível (sem 0/O, 1/l/I): ~70 bits, mostrada uma única vez.
const PASSWORD_ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function randomPassword(groups = 3, groupSize = 4): string {
  const parts: string[] = [];
  for (let g = 0; g < groups; g++) {
    let part = "";
    for (let i = 0; i < groupSize; i++) part += PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)];
    parts.push(part);
  }
  return parts.join("-");
}

// ---------- Identificadores ----------
export function normalizeEmail(email: string | null | undefined): string | null {
  const value = (email ?? "").trim().toLowerCase();
  return value ? value : null;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 200;
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, ".")
      .replace(/^\.|\.$/g, "")
      .slice(0, 40) || "usuario"
  );
}

export function emailInUse(email: string): boolean {
  const value = normalizeEmail(email);
  return Boolean(value && db.prepare("SELECT 1 FROM users WHERE email = ?").get(value));
}

export class EmailTakenError extends Error {
  constructor() {
    super("Este e-mail já tem uma conta. Entre com ele ou recupere o acesso pelo suporte.");
  }
}

export async function createUser(input: {
  username?: string;
  password: string;
  role: UserRole;
  refId: string | null;
  name: string;
  brandSource?: BrandSource;
  email?: string | null;
  consentVersion?: string | null;
  mustChangePassword?: boolean;
}): Promise<{ username: string; id: string }> {
  const email = normalizeEmail(input.email);
  const passwordHash = await hashPassword(input.password);
  const base = input.username ?? slugify(input.name);
  const id = randomUUID();
  const createdAt = now();
  // Transação síncrona: checagem de unicidade e insert sem outro request no meio.
  const username = db
    .transaction(() => {
      if (email && db.prepare("SELECT 1 FROM users WHERE email = ?").get(email)) {
        throw new EmailTakenError();
      }
      let candidate = base;
      let suffix = 1;
      while (db.prepare("SELECT 1 FROM users WHERE username = ?").get(candidate)) {
        suffix += 1;
        candidate = `${base}${suffix}`;
      }
      db.prepare(
        `INSERT INTO users (id, username, passwordHash, role, refId, name, brandSource, email,
          mustChangePassword, consentAt, consentVersion, passwordChangedAt, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id,
        candidate,
        passwordHash,
        input.role,
        input.refId,
        input.name,
        input.brandSource ?? "agency",
        email,
        input.mustChangePassword ? 1 : 0,
        input.consentVersion ? createdAt : null,
        input.consentVersion ?? null,
        createdAt,
        createdAt
      );
      return candidate;
    })
    .immediate();
  return { username, id };
}

export function markOnboarded(userId: string): void {
  db.prepare("UPDATE users SET onboardedAt = COALESCE(onboardedAt, ?) WHERE id = ?").run(now(), userId);
}

function findRowByLogin(identifier: string): UserRow | undefined {
  const value = identifier.trim().toLowerCase();
  if (!value) return undefined;
  const column = value.includes("@") ? "email" : "username";
  return db.prepare(`SELECT * FROM users WHERE ${column} = ?`).get(value) as UserRow | undefined;
}

export type LoginResult =
  | { ok: true; user: User }
  | { ok: false; reason: "invalid" | "disabled" };

// Login por usuário OU e-mail. Conta desativada só é revelada para quem
// acertou a senha (não vira oráculo de contas).
export async function verifyLogin(identifier: string, password: string): Promise<LoginResult> {
  const row = findRowByLogin(identifier);
  if (!row) {
    // Custo parecido com um login real: não dá pra medir quem existe pelo tempo.
    await hashPassword(password);
    return { ok: false, reason: "invalid" };
  }
  if (!(await verifyPassword(password, row.passwordHash))) return { ok: false, reason: "invalid" };
  if (row.disabledAt) return { ok: false, reason: "disabled" };
  db.prepare("UPDATE users SET lastLoginAt = ? WHERE id = ?").run(now(), row.id);
  return { ok: true, user: toUser({ ...row, lastLoginAt: now() }) };
}

export function getUserById(id: string): User | null {
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
  return row ? toUser(row) : null;
}

export function findUserByRef(refId: string): User | null {
  const row = db.prepare("SELECT * FROM users WHERE refId = ? ORDER BY createdAt LIMIT 1").get(refId) as
    | UserRow
    | undefined;
  return row ? toUser(row) : null;
}

// Consulta barata (PK) feita em toda requisição autenticada.
export function getSessionState(userId: string): { sessionVersion: number; disabled: boolean } | null {
  const row = db.prepare("SELECT sessionVersion, disabledAt FROM users WHERE id = ?").get(userId) as
    | { sessionVersion: number; disabledAt: string | null }
    | undefined;
  if (!row) return null;
  return { sessionVersion: Number(row.sessionVersion ?? 0), disabled: Boolean(row.disabledAt) };
}

export function bumpSessionVersion(userId: string): number {
  db.prepare("UPDATE users SET sessionVersion = sessionVersion + 1 WHERE id = ?").run(userId);
  return getSessionState(userId)?.sessionVersion ?? 0;
}

export async function changePassword(
  userId: string,
  current: string,
  next: string
): Promise<{ ok: true; sessionVersion: number } | { ok: false; error: string }> {
  const row = db.prepare("SELECT passwordHash FROM users WHERE id = ?").get(userId) as
    | { passwordHash: string }
    | undefined;
  if (!row) return { ok: false, error: "Conta não encontrada." };
  if (!(await verifyPassword(current, row.passwordHash))) {
    return { ok: false, error: "A senha atual não confere." };
  }
  const problem = passwordProblem(next);
  if (problem) return { ok: false, error: problem };
  if (current === next) return { ok: false, error: "A nova senha precisa ser diferente da atual." };
  const hash = await hashPassword(next);
  db.prepare(
    "UPDATE users SET passwordHash = ?, mustChangePassword = 0, passwordChangedAt = ?, sessionVersion = sessionVersion + 1 WHERE id = ?"
  ).run(hash, now(), userId);
  return { ok: true, sessionVersion: getSessionState(userId)?.sessionVersion ?? 0 };
}

// Admin gera uma senha provisória (mostrada uma vez) e derruba as sessões.
export async function adminResetPassword(userId: string): Promise<string | null> {
  if (!getUserById(userId)) return null;
  const password = randomPassword();
  const hash = await hashPassword(password);
  db.prepare(
    "UPDATE users SET passwordHash = ?, mustChangePassword = 1, passwordChangedAt = ?, sessionVersion = sessionVersion + 1 WHERE id = ?"
  ).run(hash, now(), userId);
  return password;
}

export function setUserDisabled(userId: string, disabled: boolean): boolean {
  const result = db
    .prepare("UPDATE users SET disabledAt = ?, sessionVersion = sessionVersion + 1 WHERE id = ?")
    .run(disabled ? now() : null, userId);
  return result.changes > 0;
}

export function setUserEmail(userId: string, email: string | null): { ok: true } | { ok: false; error: string } {
  const value = normalizeEmail(email);
  if (value && !isValidEmail(value)) return { ok: false, error: "E-mail inválido." };
  if (value) {
    const other = db.prepare("SELECT id FROM users WHERE email = ?").get(value) as { id: string } | undefined;
    if (other && other.id !== userId) return { ok: false, error: new EmailTakenError().message };
  }
  db.prepare("UPDATE users SET email = ? WHERE id = ?").run(value, userId);
  return { ok: true };
}

export function recordConsent(userId: string, version: string): void {
  db.prepare("UPDATE users SET consentAt = ?, consentVersion = ? WHERE id = ?").run(now(), version, userId);
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

export type AdminUserRow = Pick<
  User,
  "id" | "username" | "email" | "role" | "name" | "refId" | "disabledAt" | "lastLoginAt" | "createdAt" | "mustChangePassword"
>;

export function listUsers(): AdminUserRow[] {
  const rows = db
    .prepare(
      "SELECT id, username, email, role, name, refId, disabledAt, lastLoginAt, createdAt, mustChangePassword FROM users ORDER BY role, username"
    )
    .all() as (Omit<AdminUserRow, "mustChangePassword"> & { mustChangePassword: number })[];
  return rows.map((r) => ({ ...r, mustChangePassword: Number(r.mustChangePassword) === 1 }));
}

// Só para a lista de contas do login em desenvolvimento.
export function listLoginHints(): { username: string; role: string; name: string }[] {
  return db
    .prepare("SELECT username, role, name FROM users WHERE disabledAt IS NULL ORDER BY role, username")
    .all() as { username: string; role: string; name: string }[];
}

export function userExistsForRef(refId: string): boolean {
  return Boolean(db.prepare("SELECT 1 FROM users WHERE refId = ?").get(refId));
}

export function countActiveAdmins(): number {
  return (db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'admin' AND disabledAt IS NULL").get() as {
    c: number;
  }).c;
}

// ---------- Contas seed (admin + agência da casa) ----------
// Só essas duas, e só com SEED_PASSWORD definido. Clientes e profissionais
// NUNCA ganham login automático com senha conhecida: quem cria a conta recebe
// uma senha provisória aleatória (ou manda um convite).
// Roda na inicialização do servidor (instrumentation.ts) e, por garantia, no
// primeiro login. BEGIN IMMEDIATE serializa processos concorrentes: o segundo
// relê com os usuários já criados e não duplica ("admin2").
let seedPromise: Promise<void> | null = null;

export function ensureSeedUsers(): Promise<void> {
  if (!seedPromise) {
    seedPromise = seedUsers().catch((error) => {
      seedPromise = null;
      console.error("[auth] seed de usuários falhou:", error instanceof Error ? error.message : error);
    });
  }
  return seedPromise;
}

export async function seedUsers(password: string | undefined = process.env.SEED_PASSWORD): Promise<void> {
  const has = (role: string) => Boolean(db.prepare("SELECT 1 FROM users WHERE role = ?").get(role));
  if (has("admin") && has("agency")) return;
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    console.error(
      `[auth] SEED_PASSWORD ausente ou curto (mín. ${MIN_PASSWORD_LENGTH}): contas admin/agencia não foram criadas.`
    );
    return;
  }
  const passwordHash = await hashPassword(password);
  db.transaction(() => {
    const insert = (username: string, role: UserRole, name: string) => {
      if (db.prepare("SELECT 1 FROM users WHERE role = ?").get(role)) return;
      if (db.prepare("SELECT 1 FROM users WHERE username = ?").get(username)) return;
      db.prepare(
        "INSERT INTO users (id, username, passwordHash, role, refId, name, brandSource, passwordChangedAt, createdAt) VALUES (?, ?, ?, ?, NULL, ?, 'agency', ?, ?)"
      ).run(randomUUID(), username, passwordHash, role, name, now(), now());
    };
    insert("admin", "admin", "Admin da Plataforma");
    insert("agencia", "agency", "Agência");
  }).immediate();
}
