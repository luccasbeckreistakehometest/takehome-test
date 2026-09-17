import { randomBytes, randomUUID } from "crypto";
import { db, tenantColumn } from "./db";
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

export function consumeInvite(token: string, usedByRefId: string): void {
  db.prepare(
    "UPDATE invites SET status = 'accepted', usedByRefId = ?, acceptedAt = ? WHERE token = ?"
  ).run(usedByRefId, now(), token);
}

export function revokeInvite(scope: TenantScope, id: string): boolean {
  const where = scopeWhere(scope);
  return db.prepare(`UPDATE invites SET status = 'revoked' WHERE id = ? AND ${where.sql}`).run(id, ...where.params).changes > 0;
}
