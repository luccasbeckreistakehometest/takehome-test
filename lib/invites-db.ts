import { randomBytes, randomUUID } from "crypto";
import { addColumnIfMissing, db, tenantColumn } from "./db";
import { scopeWhere, type TenantScope } from "./tenancy-rules";

// Convites com token: a agência gera um link para trazer cliente/profissional
// (ou até outra agência) para dentro. Quem entra por convite fica marcado como
// whitelabel da agência (brandSource="agency"). Token expira e é rastreável.

export type InviteRole = "client" | "professional" | "agency";
export type InviteStatus = "pending" | "accepted" | "revoked";

export type Invite = {
  id: string;
  agencyId: string; // agência que convidou (quem entra vai para ela)
  token: string;
  role: InviteRole;
  note: string;
  status: InviteStatus;
  expiresAt: string | null;
  usedByRefId: string | null;
  createdAt: string;
  acceptedAt: string | null;
};

db.exec(`
  CREATE TABLE IF NOT EXISTS invites (
    id TEXT PRIMARY KEY,
    token TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending',
    expiresAt TEXT,
    usedByRefId TEXT,
    createdAt TEXT NOT NULL,
    acceptedAt TEXT
  );
`);
tenantColumn("invites");
// Reserva do convite durante o cadastro (dois cadastros ao mesmo tempo com o
// mesmo link: só um passa).
addColumnIfMissing("invites", "claimedAt", "TEXT");

const now = () => new Date().toISOString();

export function createInvite(input: {
  agencyId: string;
  role: InviteRole;
  note?: string;
  expiresInDays?: number;
}): Invite {
  const expiresAt = input.expiresInDays
    ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
    : null;
  if (!input.agencyId) throw new Error("createInvite: agência obrigatória");
  const invite: Invite = {
    id: randomUUID(),
    agencyId: input.agencyId,
    token: randomBytes(16).toString("hex"),
    role: input.role,
    note: input.note ?? "",
    status: "pending",
    expiresAt,
    usedByRefId: null,
    createdAt: now(),
    acceptedAt: null,
  };
  db.prepare(
    `INSERT INTO invites (id, agencyId, token, role, note, status, expiresAt, usedByRefId, createdAt, acceptedAt)
     VALUES (@id, @agencyId, @token, @role, @note, @status, @expiresAt, @usedByRefId, @createdAt, @acceptedAt)`
  ).run(invite);
  return invite;
}

export function getInvite(token: string): Invite | undefined {
  return db.prepare("SELECT * FROM invites WHERE token = ?").get(token) as Invite | undefined;
}

export function listInvites(scope: TenantScope): Invite[] {
  const where = scopeWhere(scope);
  return db.prepare(`SELECT * FROM invites WHERE ${where.sql} ORDER BY createdAt DESC`).all(...where.params) as Invite[];
}

// Reserva expira sozinha se o cadastro morrer no meio.
const CLAIM_TTL_MS = 2 * 60 * 1000;

// Reserva atômica: true só para UM pedido por convite pendente e válido.
export function claimInvite(token: string): boolean {
  const at = now();
  const stale = new Date(Date.now() - CLAIM_TTL_MS).toISOString();
  return (
    db
      .prepare(
        `UPDATE invites SET claimedAt = @at WHERE token = @token AND status = 'pending'
         AND (expiresAt IS NULL OR expiresAt >= @at) AND (claimedAt IS NULL OR claimedAt < @stale)`
      )
      .run({ at, token, stale }).changes === 1
  );
}

// Cadastro falhou depois da reserva: o convite volta a valer.
export function releaseInvite(token: string): void {
  db.prepare("UPDATE invites SET claimedAt = NULL WHERE token = ? AND status = 'pending'").run(token);
}

export function consumeInvite(token: string, usedByRefId: string): void {
  db.prepare(
    "UPDATE invites SET status = 'accepted', usedByRefId = ?, acceptedAt = ? WHERE token = ?"
  ).run(usedByRefId, now(), token);
}

export function revokeInvite(scope: TenantScope, id: string): boolean {
  const where = scopeWhere(scope);
  return db.prepare(`UPDATE invites SET status = 'revoked' WHERE id = ? AND ${where.sql}`).run(id, ...where.params).changes > 0;
}
