import { randomUUID } from "crypto";
import { db, tenantColumn } from "./db";
import {
  DEFAULT_ATTENDANT_CONFIG,
  sanitizeAttendantConfig,
  type AttendantConfig,
  type AttendantMode,
} from "./attendant-rules";

// Atendente de WhatsApp com IA — configuração por cliente + log de cada
// resposta gerada (modo, confiança, o que aconteceu com ela).

db.exec(`
  CREATE TABLE IF NOT EXISTS attendants (
    clientId TEXT PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
    mode TEXT NOT NULL DEFAULT 'off',
    phoneNumberId TEXT NOT NULL DEFAULT '',
    apiToken TEXT NOT NULL DEFAULT '',
    hoursStart INTEGER NOT NULL DEFAULT 8,
    hoursEnd INTEGER NOT NULL DEFAULT 18,
    days TEXT NOT NULL DEFAULT '[1,2,3,4,5]',
    timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    maxAutoPerContactPerDay INTEGER NOT NULL DEFAULT 5,
    minConfidence REAL NOT NULL DEFAULT 0.7,
    instructions TEXT NOT NULL DEFAULT '',
    handoffMessage TEXT NOT NULL DEFAULT '',
    updatedAt TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS attendant_replies (
    id TEXT PRIMARY KEY,
    clientId TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    inboundId TEXT NOT NULL,
    contactAddress TEXT NOT NULL,
    contactName TEXT NOT NULL DEFAULT '',
    inboundBody TEXT NOT NULL DEFAULT '',
    mode TEXT NOT NULL,
    status TEXT NOT NULL,
    reply TEXT NOT NULL DEFAULT '',
    intent TEXT NOT NULL DEFAULT '',
    confidence REAL NOT NULL DEFAULT 0,
    reason TEXT NOT NULL DEFAULT '',
    outboxId TEXT,
    createdAt TEXT NOT NULL,
    sentAt TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_attendant_replies_client ON attendant_replies(clientId, createdAt);
  CREATE INDEX IF NOT EXISTS idx_attendant_replies_contact ON attendant_replies(clientId, contactAddress, status, createdAt);
`);
tenantColumn("attendants");
tenantColumn("attendant_replies");

// draft = esperando a agência aprovar; sent = enviada (auto ou aprovada);
// handoff = passada para humano; skipped = não respondida (erro/desligado);
// discarded = rascunho descartado pela agência
export type ReplyStatus = "draft" | "sent" | "handoff" | "skipped" | "discarded";

export type AttendantReply = {
  id: string;
  clientId: string;
  inboundId: string;
  contactAddress: string;
  contactName: string;
  inboundBody: string;
  mode: AttendantMode;
  status: ReplyStatus;
  reply: string;
  intent: string;
  confidence: number;
  reason: string;
  outboxId: string | null;
  createdAt: string;
  sentAt: string | null;
};

type Row = Omit<AttendantConfig, "days"> & { clientId: string; days: string; updatedAt: string };

const now = () => new Date().toISOString();

export function getAttendant(clientId: string): AttendantConfig | null {
  const row = db.prepare("SELECT * FROM attendants WHERE clientId = ?").get(clientId) as Row | undefined;
  if (!row) return null;
  let days: number[] = DEFAULT_ATTENDANT_CONFIG.days;
  try {
    days = JSON.parse(row.days);
  } catch {
    days = DEFAULT_ATTENDANT_CONFIG.days;
  }
  return sanitizeAttendantConfig({ ...row, days });
}

export function saveAttendant(clientId: string, input: Partial<AttendantConfig>): AttendantConfig {
  const base = getAttendant(clientId) ?? DEFAULT_ATTENDANT_CONFIG;
  const cfg = sanitizeAttendantConfig(input, base);
  db.prepare(
    `INSERT INTO attendants (clientId, agencyId, mode, phoneNumberId, apiToken, hoursStart, hoursEnd, days, timezone, maxAutoPerContactPerDay, minConfidence, instructions, handoffMessage, updatedAt)
     VALUES (@clientId, (SELECT agencyId FROM clients WHERE id = @clientId), @mode, @phoneNumberId, @apiToken, @hoursStart, @hoursEnd, @days, @timezone, @maxAutoPerContactPerDay, @minConfidence, @instructions, @handoffMessage, @updatedAt)
     ON CONFLICT(clientId) DO UPDATE SET mode=@mode, phoneNumberId=@phoneNumberId, apiToken=@apiToken, hoursStart=@hoursStart, hoursEnd=@hoursEnd,
       days=@days, timezone=@timezone, maxAutoPerContactPerDay=@maxAutoPerContactPerDay, minConfidence=@minConfidence, instructions=@instructions,
       handoffMessage=@handoffMessage, updatedAt=@updatedAt`
  ).run({ ...cfg, clientId, days: JSON.stringify(cfg.days), updatedAt: now() });
  return cfg;
}

// Outra agência já usa este id de conta (conexão da agência ou atendente de
// uma marca dela)? O webhook roteia pelo id: ele não pode ter dois donos.
export function accountIdClaimedElsewhere(channel: "whatsapp" | "instagram", accountId: string, agencyId: string): boolean {
  const id = accountId.trim();
  if (!id) return false;
  const hasConnections = Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'channel_connections'").get());
  if (
    hasConnections &&
    db
      .prepare("SELECT 1 FROM channel_connections WHERE channel = ? AND apiAccountId = ? AND COALESCE(agencyId, '') != ? LIMIT 1")
      .get(channel, id, agencyId)
  ) {
    return true;
  }
  if (channel !== "whatsapp") return false;
  return Boolean(
    db
      .prepare(
        `SELECT 1 FROM attendants a JOIN clients c ON c.id = a.clientId
         WHERE a.phoneNumberId = ? AND COALESCE(c.agencyId, '') != ? LIMIT 1`
      )
      .get(id, agencyId)
  );
}

// Roteia uma mensagem recebida pelo phone_number_id do número (WhatsApp Cloud).
export function findClientByPhoneNumberId(phoneNumberId: string): { clientId: string; agencyId: string | null } | null {
  if (!phoneNumberId) return null;
  const rows = db
    .prepare(
      `SELECT a.clientId, c.agencyId FROM attendants a JOIN clients c ON c.id = a.clientId
       WHERE a.phoneNumberId = ? AND a.phoneNumberId != '' ORDER BY a.updatedAt DESC`
    )
    .all(phoneNumberId) as { clientId: string; agencyId: string | null }[];
  // Mesmo número em agências diferentes (dado antigo): não roteia para nenhuma.
  if (new Set(rows.map((r) => r.agencyId ?? "")).size > 1) return null;
  return rows[0] ?? null;
}

export function logReply(input: Omit<AttendantReply, "id" | "createdAt">): AttendantReply {
  const reply: AttendantReply = { ...input, id: randomUUID(), createdAt: now() };
  db.prepare(
    `INSERT INTO attendant_replies (id, agencyId, clientId, inboundId, contactAddress, contactName, inboundBody, mode, status, reply, intent, confidence, reason, outboxId, createdAt, sentAt)
     VALUES (@id, (SELECT agencyId FROM clients WHERE id = @clientId), @clientId, @inboundId, @contactAddress, @contactName, @inboundBody, @mode, @status, @reply, @intent, @confidence, @reason, @outboxId, @createdAt, @sentAt)`
  ).run(reply);
  return reply;
}

export function getReply(id: string): AttendantReply | null {
  return ((db.prepare("SELECT * FROM attendant_replies WHERE id = ?").get(id) as AttendantReply) ?? null);
}

export function updateReply(
  id: string,
  patch: Partial<Pick<AttendantReply, "status" | "reply" | "outboxId" | "sentAt" | "reason">>
): AttendantReply | null {
  const existing = getReply(id);
  if (!existing) return null;
  const merged = { ...existing, ...patch };
  db.prepare(
    "UPDATE attendant_replies SET status = ?, reply = ?, outboxId = ?, sentAt = ?, reason = ? WHERE id = ?"
  ).run(merged.status, merged.reply, merged.outboxId, merged.sentAt, merged.reason, id);
  return merged;
}

export function listReplies(clientId: string, limit = 50): AttendantReply[] {
  return db
    .prepare("SELECT * FROM attendant_replies WHERE clientId = ? ORDER BY createdAt DESC LIMIT ?")
    .all(clientId, limit) as AttendantReply[];
}

// Respostas automáticas já enviadas hoje (UTC) para este contato — o limite
// diário do modo automático.
export function countAutoRepliesToday(clientId: string, contactAddress: string, nowDate = new Date()): number {
  const dayStart = new Date(Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), nowDate.getUTCDate())).toISOString();
  const row = db
    .prepare(
      "SELECT COUNT(*) AS c FROM attendant_replies WHERE clientId = ? AND contactAddress = ? AND mode = 'auto' AND status IN ('sent','handoff') AND createdAt >= ?"
    )
    .get(clientId, contactAddress, dayStart) as { c: number };
  return row.c;
}

export function attendantStats(clientId: string): { drafts: number; sentToday: number; handoffs: number } {
  const dayStart = new Date().toISOString().slice(0, 10);
  const count = (sql: string, ...params: unknown[]) => (db.prepare(sql).get(...params) as { c: number }).c;
  return {
    drafts: count("SELECT COUNT(*) c FROM attendant_replies WHERE clientId = ? AND status = 'draft'", clientId),
    sentToday: count("SELECT COUNT(*) c FROM attendant_replies WHERE clientId = ? AND status = 'sent' AND createdAt >= ?", clientId, dayStart),
    handoffs: count("SELECT COUNT(*) c FROM attendant_replies WHERE clientId = ? AND status = 'handoff'", clientId),
  };
}
