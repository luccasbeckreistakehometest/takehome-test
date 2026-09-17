import { randomUUID } from "crypto";
import { db } from "./db";

// Caixa de entrada da plataforma: mensagens do formulário de contato e
// pedidos de acesso de agências (cadastro público de agência fechado). O admin
// acompanha e muda o status no painel.

export type InboxKind = "contact" | "access_request";
export type InboxStatus = "new" | "in_progress" | "done";

export type InboxMessage = {
  id: string;
  kind: InboxKind;
  name: string;
  email: string;
  topic: string;
  message: string;
  meta: Record<string, string>;
  status: InboxStatus;
  userId: string | null;
  ip: string;
  createdAt: string;
  updatedAt: string;
};

db.exec(`
  CREATE TABLE IF NOT EXISTS contact_messages (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL DEFAULT 'contact',
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    topic TEXT NOT NULL DEFAULT '',
    message TEXT NOT NULL,
    meta TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'new',
    userId TEXT,
    ip TEXT NOT NULL DEFAULT '',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_contact_status ON contact_messages(status, createdAt);
`);

type Row = Omit<InboxMessage, "meta"> & { meta: string };

function toMessage(row: Row): InboxMessage {
  let meta: Record<string, string> = {};
  try {
    meta = JSON.parse(row.meta || "{}");
  } catch {
    meta = {};
  }
  return { ...row, kind: row.kind === "access_request" ? "access_request" : "contact", meta };
}

export function createInboxMessage(input: {
  kind: InboxKind;
  name: string;
  email: string;
  topic?: string;
  message: string;
  meta?: Record<string, string>;
  userId?: string | null;
  ip?: string;
}): InboxMessage {
  const at = new Date().toISOString();
  const row: Row = {
    id: randomUUID(),
    kind: input.kind,
    name: input.name.slice(0, 120),
    email: input.email.slice(0, 200),
    topic: (input.topic ?? "").slice(0, 60),
    message: input.message.slice(0, 5000),
    meta: JSON.stringify(input.meta ?? {}),
    status: "new",
    userId: input.userId ?? null,
    ip: (input.ip ?? "").slice(0, 64),
    createdAt: at,
    updatedAt: at,
  };
  db.prepare(
    `INSERT INTO contact_messages (id, kind, name, email, topic, message, meta, status, userId, ip, createdAt, updatedAt)
     VALUES (@id, @kind, @name, @email, @topic, @message, @meta, @status, @userId, @ip, @createdAt, @updatedAt)`
  ).run(row);
  return toMessage(row);
}

export function listInbox(filter: { kind?: InboxKind; status?: InboxStatus } = {}): InboxMessage[] {
  const where: string[] = [];
  const args: string[] = [];
  if (filter.kind) {
    where.push("kind = ?");
    args.push(filter.kind);
  }
  if (filter.status) {
    where.push("status = ?");
    args.push(filter.status);
  }
  const sql = `SELECT * FROM contact_messages ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY createdAt DESC LIMIT 300`;
  return (db.prepare(sql).all(...args) as Row[]).map(toMessage);
}

export function setInboxStatus(id: string, status: InboxStatus): boolean {
  return (
    db
      .prepare("UPDATE contact_messages SET status = ?, updatedAt = ? WHERE id = ?")
      .run(status, new Date().toISOString(), id).changes > 0
  );
}

export function inboxCounts(): Record<InboxStatus, number> {
  const rows = db.prepare("SELECT status, COUNT(*) AS c FROM contact_messages GROUP BY status").all() as {
    status: InboxStatus;
    c: number;
  }[];
  const out: Record<InboxStatus, number> = { new: 0, in_progress: 0, done: 0 };
  for (const r of rows) if (r.status in out) out[r.status] = r.c;
  return out;
}

// Retenção: mensagens resolvidas somem 2 anos depois (Política de Privacidade).
export function purgeOldInbox(olderThanDays = 730): number {
  const cutoff = new Date(Date.now() - olderThanDays * 86_400_000).toISOString();
  return db.prepare("DELETE FROM contact_messages WHERE status = 'done' AND updatedAt < ?").run(cutoff).changes;
}

// LGPD: mensagens ligadas a uma conta apagada perdem o vínculo e os dados de contato.
export function anonymiseInboxForUser(userId: string): void {
  db.prepare(
    "UPDATE contact_messages SET userId = NULL, name = '[removido]', email = '[removido]', ip = '' WHERE userId = ?"
  ).run(userId);
}

export function listInboxForUser(userId: string): InboxMessage[] {
  return (db.prepare("SELECT * FROM contact_messages WHERE userId = ? ORDER BY createdAt").all(userId) as Row[]).map(
    toMessage
  );
}
