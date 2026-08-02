import { randomUUID } from "crypto";
import { db } from "./db";

// Central de mensagens: contatos, listas de transmissão, fila de envio
// (outbox) e conexões por canal. WhatsApp e Instagram, via API oficial ou
// via a sessão própria do usuário (worker Playwright que drena a fila).

export type MessageChannel = "whatsapp" | "instagram";
export type SendMode = "api" | "session"; // API oficial | sessão logada (Playwright)
export type OutboxStatus = "queued" | "scheduled" | "sending" | "sent" | "failed";

export type Contact = {
  id: string;
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
  name: string;
  channel: MessageChannel;
  contactIds: string[];
  createdAt: string;
};

export type OutboxMessage = {
  id: string;
  channel: MessageChannel;
  mode: SendMode;
  contactId: string | null;
  listId: string | null;
  toAddress: string; // telefone ou handle resolvido no momento do enfileiramento
  body: string;
  status: OutboxStatus;
  scheduledFor: string | null;
  sentAt: string | null;
  error: string;
  createdAt: string;
};

export type ChannelConnection = {
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
  CREATE TABLE IF NOT EXISTS channel_connections (
    channel TEXT NOT NULL,
    mode TEXT NOT NULL,
    apiToken TEXT NOT NULL DEFAULT '',
    apiAccountId TEXT NOT NULL DEFAULT '',
    sessionReady INTEGER NOT NULL DEFAULT 0,
    updatedAt TEXT NOT NULL,
    PRIMARY KEY (channel)
  );
`);

const now = () => new Date().toISOString();

// ---------- Contatos ----------
export function listContacts(clientId?: string): Contact[] {
  const rows = clientId
    ? (db
        .prepare("SELECT * FROM contacts WHERE clientId = ? ORDER BY name ASC")
        .all(clientId) as Contact[])
    : (db.prepare("SELECT * FROM contacts ORDER BY name ASC").all() as Contact[]);
  return rows;
}

export function createContact(
  input: Omit<Contact, "id" | "createdAt">
): Contact {
  const contact: Contact = { ...input, id: randomUUID(), createdAt: now() };
  db.prepare(
    `INSERT INTO contacts (id, name, phone, instagram, clientId, tags, notes, createdAt)
     VALUES (@id, @name, @phone, @instagram, @clientId, @tags, @notes, @createdAt)`
  ).run(contact);
  return contact;
}

export function deleteContact(id: string): void {
  db.prepare("DELETE FROM contacts WHERE id = ?").run(id);
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

export function listBroadcastLists(): BroadcastList[] {
  return (
    db.prepare("SELECT * FROM broadcast_lists ORDER BY createdAt DESC").all() as ListRow[]
  ).map(toList);
}

export function getBroadcastList(id: string): BroadcastList | undefined {
  const row = db.prepare("SELECT * FROM broadcast_lists WHERE id = ?").get(id) as
    | ListRow
    | undefined;
  return row ? toList(row) : undefined;
}

export function createBroadcastList(input: {
  name: string;
  channel: MessageChannel;
  contactIds: string[];
}): BroadcastList {
  const list: BroadcastList = { ...input, id: randomUUID(), createdAt: now() };
  db.prepare(
    "INSERT INTO broadcast_lists (id, name, channel, contactIds, createdAt) VALUES (?, ?, ?, ?, ?)"
  ).run(list.id, list.name, list.channel, JSON.stringify(list.contactIds), list.createdAt);
  return list;
}

export function deleteBroadcastList(id: string): void {
  db.prepare("DELETE FROM broadcast_lists WHERE id = ?").run(id);
}

// ---------- Outbox (fila de envio) ----------
export function listOutbox(limit = 100): OutboxMessage[] {
  return db
    .prepare("SELECT * FROM message_outbox ORDER BY createdAt DESC LIMIT ?")
    .all(limit) as OutboxMessage[];
}

function insertOutbox(
  msg: Omit<OutboxMessage, "id" | "createdAt" | "sentAt" | "error"> &
    Partial<Pick<OutboxMessage, "sentAt" | "error">>
): OutboxMessage {
  const full: OutboxMessage = {
    ...msg,
    id: randomUUID(),
    sentAt: msg.sentAt ?? null,
    error: msg.error ?? "",
    createdAt: now(),
  };
  db.prepare(
    `INSERT INTO message_outbox (id, channel, mode, contactId, listId, toAddress, body, status, scheduledFor, sentAt, error, createdAt)
     VALUES (@id, @channel, @mode, @contactId, @listId, @toAddress, @body, @status, @scheduledFor, @sentAt, @error, @createdAt)`
  ).run(full);
  return full;
}

// Enfileira uma mensagem individual ou uma transmissão (expande a lista em N
// mensagens, uma por contato, resolvendo o endereço de cada um no canal).
export function enqueueMessages(input: {
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
    if (!contact) continue;
    const toAddress = input.channel === "whatsapp" ? contact.phone : contact.instagram;
    if (!toAddress) continue; // contato sem endereço para o canal escolhido
    // Personalização simples: {nome} vira o primeiro nome do contato
    const body = input.body.replace(/\{nome\}/gi, contact.name.split(" ")[0] ?? contact.name);
    created.push(
      insertOutbox({
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
export function dueOutbox(channel?: MessageChannel): OutboxMessage[] {
  const nowIso = now();
  const rows = db
    .prepare(
      `SELECT * FROM message_outbox
       WHERE (status = 'queued' OR (status = 'scheduled' AND scheduledFor <= ?))
       ${channel ? "AND channel = ?" : ""}
       ORDER BY createdAt ASC`
    )
    .all(...(channel ? [nowIso, channel] : [nowIso])) as OutboxMessage[];
  return rows;
}

// ---------- Conexões por canal ----------
export function listConnections(): ChannelConnection[] {
  const rows = db.prepare("SELECT * FROM channel_connections").all() as (Omit<
    ChannelConnection,
    "sessionReady"
  > & { sessionReady: number })[];
  return rows.map((r) => ({ ...r, sessionReady: r.sessionReady === 1 }));
}

export function getConnection(channel: MessageChannel): ChannelConnection | undefined {
  const row = db
    .prepare("SELECT * FROM channel_connections WHERE channel = ?")
    .get(channel) as
    | (Omit<ChannelConnection, "sessionReady"> & { sessionReady: number })
    | undefined;
  return row ? { ...row, sessionReady: row.sessionReady === 1 } : undefined;
}

export function saveConnection(input: {
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
    `INSERT INTO channel_connections (channel, mode, apiToken, apiAccountId, sessionReady, updatedAt)
     VALUES (@channel, @mode, @apiToken, @apiAccountId, @sessionReady, @updatedAt)
     ON CONFLICT(channel) DO UPDATE SET mode=@mode, apiToken=@apiToken, apiAccountId=@apiAccountId,
       sessionReady=@sessionReady, updatedAt=@updatedAt`
  ).run({ ...conn, sessionReady: conn.sessionReady ? 1 : 0 });
  return conn;
}
