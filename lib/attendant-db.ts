import { randomUUID } from "crypto";
import { db } from "./db";
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
    `INSERT INTO attendants (clientId, mode, phoneNumberId, apiToken, hoursStart, hoursEnd, days, timezone, maxAutoPerContactPerDay, minConfidence, instructions, handoffMessage, updatedAt)
     VALUES (@clientId, @mode, @phoneNumberId, @apiToken, @hoursStart, @hoursEnd, @days, @timezone, @maxAutoPerContactPerDay, @minConfidence, @instructions, @handoffMessage, @updatedAt)
     ON CONFLICT(clientId) DO UPDATE SET mode=@mode, phoneNumberId=@phoneNumberId, apiToken=@apiToken, hoursStart=@hoursStart, hoursEnd=@hoursEnd,
       days=@days, timezone=@timezone, maxAutoPerContactPerDay=@maxAutoPerContactPerDay, minConfidence=@minConfidence, instructions=@instructions,
       handoffMessage=@handoffMessage, updatedAt=@updatedAt`
  ).run({ ...cfg, clientId, days: JSON.stringify(cfg.days), updatedAt: now() });
  return cfg;
}

// Roteia uma mensagem recebida pelo phone_number_id do número (WhatsApp Cloud).
export function findClientByPhoneNumberId(phoneNumberId: string): string | null {
  if (!phoneNumberId) return null;
  const row = db
    .prepare("SELECT clientId FROM attendants WHERE phoneNumberId = ? AND phoneNumberId != ''")
    .get(phoneNumberId) as { clientId: string } | undefined;
  return row?.clientId ?? null;
}

export function logReply(input: Omit<AttendantReply, "id" | "createdAt">): AttendantReply {
  const reply: AttendantReply = { ...input, id: randomUUID(), createdAt: now() };
  db.prepare(
    `INSERT INTO attendant_replies (id, clientId, inboundId, contactAddress, contactName, inboundBody, mode, status, reply, intent, confidence, reason, outboxId, createdAt, sentAt)
     VALUES (@id, @clientId, @inboundId, @contactAddress, @contactName, @inboundBody, @mode, @status, @reply, @intent, @confidence, @reason, @outboxId, @createdAt, @sentAt)`
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
