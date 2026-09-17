import { randomUUID } from "crypto";
import { addColumnIfMissing, db, tenantColumn } from "./db";
import { CHANNEL_CONNECTIONS_SCHEMA } from "./tenancy-migration";
import { scopeWhere, type TenantScope } from "./tenancy-rules";

// Central de mensagens: contatos, listas de transmissão, fila de envio
// (outbox) e conexões por canal. WhatsApp e Instagram, via API oficial ou
// via a sessão própria do usuário (worker Playwright que drena a fila).

export type MessageChannel = "whatsapp" | "instagram";
export type SendMode = "api" | "session"; // API oficial | sessão logada (Playwright)
export type OutboxStatus = "queued" | "scheduled" | "sending" | "sent" | "failed";

export type Contact = {
  id: string;
  agencyId: string;
  name: string;
  phone: string; // E.164 sem "+", ex 5522999999999
  instagram: string; // @handle ou user id
  clientId: string | null; // vínculo opcional a uma conta
  tags: string;
  notes: string;
  createdAt: string;
};

export type BroadcastList = {
  id: string;
  agencyId: string;
  name: string;
  channel: MessageChannel;
  contactIds: string[];
  createdAt: string;
};

export type OutboxMessage = {
  id: string;
  agencyId: string;
  channel: MessageChannel;
  mode: SendMode;
  contactId: string | null;
  listId: string | null;
  // conta do cliente em nome de quem a mensagem sai (atendente por cliente):
  // com número próprio configurado, o envio usa as credenciais dele
  clientId: string | null;
  toAddress: string; // telefone ou handle resolvido no momento do enfileiramento
  body: string;
  status: OutboxStatus;
  scheduledFor: string | null;
  sentAt: string | null;
  error: string;
  createdAt: string;
};

export type ChannelConnection = {
  agencyId: string;
  channel: MessageChannel;
  mode: SendMode;
  // API: token/phoneNumberId (WhatsApp Cloud) ou pageToken/igId (Instagram)
  apiToken: string;
  apiAccountId: string;
  // Sessão: status do login manual feito pelo worker
  sessionReady: boolean;
  updatedAt: string;
};

db.exec(`
  CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    instagram TEXT NOT NULL DEFAULT '',
    clientId TEXT,
    tags TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    createdAt TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS broadcast_lists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    channel TEXT NOT NULL,
    contactIds TEXT NOT NULL DEFAULT '[]',
    createdAt TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS message_outbox (
    id TEXT PRIMARY KEY,
    channel TEXT NOT NULL,
    mode TEXT NOT NULL,
    contactId TEXT,
    listId TEXT,
    toAddress TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    scheduledFor TEXT,
    sentAt TEXT,
    error TEXT NOT NULL DEFAULT '',
    createdAt TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_outbox_status ON message_outbox(status, scheduledFor);
  CREATE TABLE IF NOT EXISTS inbound_messages (
    id TEXT PRIMARY KEY,
    channel TEXT NOT NULL,
    fromAddress TEXT NOT NULL DEFAULT '',
    fromName TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    receivedAt TEXT NOT NULL,
    readAt TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_inbound_received ON inbound_messages(receivedAt DESC);
`);

// Migração leve: atendente por cliente — mensagens recebidas e enviadas
// sabem a qual conta pertencem (roteadas pelo phone_number_id do WhatsApp).
addColumnIfMissing("inbound_messages", "clientId", "TEXT");
addColumnIfMissing("inbound_messages", "phoneNumberId", "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing("message_outbox", "clientId", "TEXT");
// Conexões por agência: chave (agencyId, channel). Banco antigo é convertido
// pela migração de tenancy (lib/tenancy-migration.ts).
db.exec(CHANNEL_CONNECTIONS_SCHEMA);
for (const table of ["contacts", "broadcast_lists", "message_outbox", "inbound_messages"]) tenantColumn(table);

const now = () => new Date().toISOString();

// ---------- Contatos ----------
export function listContacts(scope: TenantScope, clientId?: string): Contact[] {
  const where = scopeWhere(scope);
  const byClient = clientId ? "AND clientId = ?" : "";
  return db
    .prepare(`SELECT * FROM contacts WHERE ${where.sql} ${byClient} ORDER BY name ASC`)
    .all(...where.params, ...(clientId ? [clientId] : [])) as Contact[];
}

export function createContact(input: Omit<Contact, "id" | "createdAt">): Contact {
  if (!input.agencyId) throw new Error("createContact: agência obrigatória");
  const contact: Contact = { ...input, id: randomUUID(), createdAt: now() };
  db.prepare(
    `INSERT INTO contacts (id, agencyId, name, phone, instagram, clientId, tags, notes, createdAt)
     VALUES (@id, @agencyId, @name, @phone, @instagram, @clientId, @tags, @notes, @createdAt)`
  ).run(contact);
  return contact;
}

// Apaga só dentro do escopo (id de outra agência = nada acontece).
export function deleteContact(scope: TenantScope, id: string): boolean {
  const where = scopeWhere(scope);
  return db.prepare(`DELETE FROM contacts WHERE id = ? AND ${where.sql}`).run(id, ...where.params).changes > 0;
}

export function getContact(id: string): Contact | undefined {
  return db.prepare("SELECT * FROM contacts WHERE id = ?").get(id) as
    | Contact
    | undefined;
}

// ---------- Listas de transmissão ----------
type ListRow = Omit<BroadcastList, "contactIds"> & { contactIds: string };

function toList(row: ListRow): BroadcastList {
  return { ...row, contactIds: JSON.parse(row.contactIds) };
}

export function listBroadcastLists(scope: TenantScope): BroadcastList[] {
  const where = scopeWhere(scope);
  return (
    db.prepare(`SELECT * FROM broadcast_lists WHERE ${where.sql} ORDER BY createdAt DESC`).all(...where.params) as ListRow[]
  ).map(toList);
}

export function getBroadcastList(id: string): BroadcastList | undefined {
  const row = db.prepare("SELECT * FROM broadcast_lists WHERE id = ?").get(id) as
    | ListRow
    | undefined;
  return row ? toList(row) : undefined;
}

// Só entram contatos da mesma agência.
export function createBroadcastList(input: {
  agencyId: string;
  name: string;
  channel: MessageChannel;
  contactIds: string[];
}): BroadcastList {
  const own = input.contactIds.filter((id) => getContact(id)?.agencyId === input.agencyId);
  const list: BroadcastList = { ...input, contactIds: own, id: randomUUID(), createdAt: now() };
  db.prepare(
    "INSERT INTO broadcast_lists (id, agencyId, name, channel, contactIds, createdAt) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(list.id, list.agencyId, list.name, list.channel, JSON.stringify(list.contactIds), list.createdAt);
  return list;
}

export function deleteBroadcastList(scope: TenantScope, id: string): boolean {
  const where = scopeWhere(scope);
  return db.prepare(`DELETE FROM broadcast_lists WHERE id = ? AND ${where.sql}`).run(id, ...where.params).changes > 0;
}

// ---------- Outbox (fila de envio) ----------
export function listOutbox(scope: TenantScope, limit = 100): OutboxMessage[] {
  const where = scopeWhere(scope);
  return db
    .prepare(`SELECT * FROM message_outbox WHERE ${where.sql} ORDER BY createdAt DESC LIMIT ?`)
    .all(...where.params, limit) as OutboxMessage[];
}

function insertOutbox(
  msg: Omit<OutboxMessage, "id" | "createdAt" | "sentAt" | "error" | "clientId"> &
    Partial<Pick<OutboxMessage, "sentAt" | "error" | "clientId">>
): OutboxMessage {
  const full: OutboxMessage = {
    ...msg,
    clientId: msg.clientId ?? null,
    id: randomUUID(),
    sentAt: msg.sentAt ?? null,
    error: msg.error ?? "",
    createdAt: now(),
  };
  db.prepare(
    `INSERT INTO message_outbox (id, agencyId, channel, mode, contactId, listId, clientId, toAddress, body, status, scheduledFor, sentAt, error, createdAt)
     VALUES (@id, @agencyId, @channel, @mode, @contactId, @listId, @clientId, @toAddress, @body, @status, @scheduledFor, @sentAt, @error, @createdAt)`
  ).run(full);
  return full;
}

// Enfileira uma mensagem individual ou uma transmissão (expande a lista em N
// mensagens, uma por contato, resolvendo o endereço de cada um no canal).
export function enqueueMessages(input: {
  agencyId: string;
  channel: MessageChannel;
  mode: SendMode;
  body: string;
  contactIds: string[];
  listId?: string | null;
  scheduledFor?: string | null;
}): OutboxMessage[] {
  const status: OutboxStatus = input.scheduledFor ? "scheduled" : "queued";
  const created: OutboxMessage[] = [];
  for (const contactId of input.contactIds) {
    const contact = getContact(contactId);
    if (!contact || contact.agencyId !== input.agencyId) continue; // contato de outra agência: ignora
    const toAddress = input.channel === "whatsapp" ? contact.phone : contact.instagram;
    if (!toAddress) continue; // contato sem endereço para o canal escolhido
    // Personalização simples: {nome} vira o primeiro nome do contato
    const body = input.body.replace(/\{nome\}/gi, contact.name.split(" ")[0] ?? contact.name);
    created.push(
      insertOutbox({
        agencyId: input.agencyId,
        channel: input.channel,
        mode: input.mode,
        contactId,
        listId: input.listId ?? null,
        toAddress,
        body,
        status,
        scheduledFor: input.scheduledFor ?? null,
      })
    );
  }
  return created;
}

// Enfileira UMA mensagem por endereço cru (sem exigir contato cadastrado).
// Usado pelo teste de conexão da UI.
export function enqueueDirect(input: {
  agencyId: string;
  channel: MessageChannel;
  mode: SendMode;
  toAddress: string;
  body: string;
  clientId?: string | null;
}): OutboxMessage {
  return insertOutbox({
    agencyId: input.agencyId,
    channel: input.channel,
    mode: input.mode,
    contactId: null,
    listId: null,
    clientId: input.clientId ?? null,
    toAddress: input.toAddress,
    body: input.body,
    status: "queued",
    scheduledFor: null,
  });
}

export function updateOutboxStatus(
  id: string,
  status: OutboxStatus,
  error = ""
): void {
  db.prepare(
    "UPDATE message_outbox SET status = ?, error = ?, sentAt = ? WHERE id = ?"
  ).run(status, error, status === "sent" ? now() : null, id);
}

// Mensagens prontas para envio agora (fila + agendadas cujo horário chegou).
// Sem agencyId = todas (o scheduler); com agencyId = só as da agência.
export function dueOutbox(channel?: MessageChannel, agencyId?: string): OutboxMessage[] {
  const nowIso = now();
  const rows = db
    .prepare(
      `SELECT * FROM message_outbox
       WHERE (status = 'queued' OR (status = 'scheduled' AND scheduledFor <= ?))
       ${channel ? "AND channel = ?" : ""}
       ${agencyId ? "AND agencyId = ?" : ""}
       ORDER BY createdAt ASC`
    )
    .all(nowIso, ...(channel ? [channel] : []), ...(agencyId ? [agencyId] : [])) as OutboxMessage[];
  return rows;
}

// ---------- Conexões por canal ----------
export function listConnections(agencyId: string): ChannelConnection[] {
  const rows = db.prepare("SELECT * FROM channel_connections WHERE agencyId = ?").all(agencyId) as (Omit<
    ChannelConnection,
    "sessionReady"
  > & { sessionReady: number })[];
  return rows.map((r) => ({ ...r, sessionReady: r.sessionReady === 1 }));
}

export function getConnection(agencyId: string, channel: MessageChannel): ChannelConnection | undefined {
  const row = db
    .prepare("SELECT * FROM channel_connections WHERE agencyId = ? AND channel = ?")
    .get(agencyId, channel) as
    | (Omit<ChannelConnection, "sessionReady"> & { sessionReady: number })
    | undefined;
  return row ? { ...row, sessionReady: row.sessionReady === 1 } : undefined;
}

// ---------- Mensagens recebidas (inbound via webhook) ----------
export type InboundMessage = {
  id: string;
  agencyId: string | null;
  channel: MessageChannel;
  fromAddress: string;
  fromName: string;
  body: string;
  // conta do cliente dona do número que recebeu (atendente por cliente);
  // null = número da agência
  clientId: string | null;
  phoneNumberId: string;
  receivedAt: string;
  readAt: string | null;
};

// agencyId: dona do número que recebeu (roteado pelo phone_number_id).
// null = número desconhecido (fica só para o admin).
export function saveInbound(input: {
  agencyId: string | null;
  channel: MessageChannel;
  fromAddress: string;
  fromName?: string;
  body: string;
  clientId?: string | null;
  phoneNumberId?: string;
}): InboundMessage {
  const msg: InboundMessage = {
    id: randomUUID(),
    agencyId: input.agencyId,
    channel: input.channel,
    fromAddress: input.fromAddress,
    fromName: input.fromName ?? "",
    body: input.body,
    clientId: input.clientId ?? null,
    phoneNumberId: input.phoneNumberId ?? "",
    receivedAt: now(),
    readAt: null,
  };
  db.prepare(
    `INSERT INTO inbound_messages (id, agencyId, channel, fromAddress, fromName, body, clientId, phoneNumberId, receivedAt, readAt)
     VALUES (@id, @agencyId, @channel, @fromAddress, @fromName, @body, @clientId, @phoneNumberId, @receivedAt, @readAt)`
  ).run(msg);
  return msg;
}

export function getInbound(id: string): InboundMessage | undefined {
  return db.prepare("SELECT * FROM inbound_messages WHERE id = ?").get(id) as InboundMessage | undefined;
}

export type InboundWithClient = InboundMessage & { clientName: string | null };

export function listInbound(scope: TenantScope, limit = 100, clientId?: string): InboundWithClient[] {
  const tenant = scopeWhere(scope, "m.agencyId");
  const byClient = clientId ? "AND m.clientId = ?" : "";
  return db
    .prepare(
      `SELECT m.*, c.name AS clientName FROM inbound_messages m
       LEFT JOIN clients c ON c.id = m.clientId
       WHERE ${tenant.sql} ${byClient}
       ORDER BY m.receivedAt DESC LIMIT ?`
    )
    .all(...tenant.params, ...(clientId ? [clientId] : []), limit) as InboundWithClient[];
}

// Histórico curto da conversa com um contato (para a IA responder no contexto).
export function listInboundFrom(clientId: string, fromAddress: string, limit = 6): InboundMessage[] {
  return db
    .prepare(
      "SELECT * FROM inbound_messages WHERE clientId = ? AND fromAddress = ? ORDER BY receivedAt DESC LIMIT ?"
    )
    .all(clientId, fromAddress, limit) as InboundMessage[];
}

export function markInboundRead(scope: TenantScope): void {
  const where = scopeWhere(scope);
  db.prepare(`UPDATE inbound_messages SET readAt = ? WHERE readAt IS NULL AND ${where.sql}`).run(now(), ...where.params);
}

// Agência dona de um número de WhatsApp/conta do Instagram conectado. Id em
// mais de uma agência (dado antigo, antes da checagem de posse) = ninguém:
// a mensagem fica sem agência (só o admin vê) em vez de ir para a errada.
export function findAgencyByAccountId(channel: MessageChannel, accountId: string): string | null {
  if (!accountId) return null;
  const rows = db
    .prepare("SELECT DISTINCT agencyId FROM channel_connections WHERE channel = ? AND apiAccountId = ? AND apiAccountId != '' LIMIT 2")
    .all(channel, accountId) as { agencyId: string }[];
  return rows.length === 1 ? rows[0].agencyId : null;
}

export function saveConnection(input: {
  agencyId: string;
  channel: MessageChannel;
  mode: SendMode;
  apiToken: string;
  apiAccountId: string;
  sessionReady?: boolean;
}): ChannelConnection {
  const conn: ChannelConnection = {
    ...input,
    sessionReady: input.sessionReady ?? false,
    updatedAt: now(),
  };
  db.prepare(
    `INSERT INTO channel_connections (agencyId, channel, mode, apiToken, apiAccountId, sessionReady, updatedAt)
     VALUES (@agencyId, @channel, @mode, @apiToken, @apiAccountId, @sessionReady, @updatedAt)
     ON CONFLICT(agencyId, channel) DO UPDATE SET mode=@mode, apiToken=@apiToken, apiAccountId=@apiAccountId,
       sessionReady=@sessionReady, updatedAt=@updatedAt`
  ).run({ ...conn, sessionReady: conn.sessionReady ? 1 : 0 });
  return conn;
}
