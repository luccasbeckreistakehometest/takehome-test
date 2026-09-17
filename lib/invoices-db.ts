import { randomBytes, randomUUID } from "crypto";
import { db, getClient, listClients, tenantColumn } from "./db";
import { getKv, setKv } from "./kv-settings";
import { kvKeyFor, scopeWhere, type TenantScope, ALL_AGENCIES } from "./tenancy-rules";
import { getAgency } from "./agencies";
import { notifyAgency } from "./notify";
import { logActivity } from "./marketplace-db";
import { markExtrasInvoiced, unbilledApprovedExtras } from "./scope-db";
import { buildPixPayload, validatePixKey } from "./pix";
import {
  brazilToday,
  buildDraftItems,
  DEFAULT_INVOICE_SETTINGS,
  dueDateFor,
  invoiceState,
  invoiceTotal,
  isDraftDay,
  sanitizeInvoiceSettings,
  settingsReady,
  type InvoiceItem,
  type InvoiceSettings,
  type InvoiceState,
  type InvoiceStatus,
} from "./invoice-rules";

// Faturas do fee mensal de cada cliente, pagas por Pix direto na conta da
// agência (BR Code estático gerado aqui). A confirmação do pagamento é da
// agência: a Marqa não vê o extrato.

export type ClientInvoice = {
  id: string;
  agencyId: string;
  clientId: string;
  month: string;
  items: InvoiceItem[];
  total: number;
  dueDate: string;
  status: InvoiceStatus;
  token: string;
  pixPayload: string;
  sentAt: string | null;
  paidClaimedAt: string | null;
  paidAt: string | null;
  paidMarkedBy: "" | "client" | "agency";
  createdAt: string;
};

db.exec(`
  CREATE TABLE IF NOT EXISTS client_invoices (
    id TEXT PRIMARY KEY,
    clientId TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    month TEXT NOT NULL,
    itemsJson TEXT NOT NULL DEFAULT '[]',
    total REAL NOT NULL DEFAULT 0,
    dueDate TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    token TEXT NOT NULL UNIQUE,
    pixPayload TEXT NOT NULL DEFAULT '',
    sentAt TEXT,
    paidClaimedAt TEXT,
    paidAt TEXT,
    paidMarkedBy TEXT NOT NULL DEFAULT '',
    createdAt TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_client_invoices_client ON client_invoices(clientId, month);
`);
tenantColumn("client_invoices");

const SETTINGS_KEY = "invoice_settings";
const nowIso = () => new Date().toISOString();

export function getInvoiceSettings(agencyId: string): InvoiceSettings {
  return sanitizeInvoiceSettings(getKv<InvoiceSettings>(kvKeyFor(SETTINGS_KEY, agencyId), DEFAULT_INVOICE_SETTINGS));
}

export function saveInvoiceSettings(agencyId: string, input: Partial<InvoiceSettings>): { ok: true; settings: InvoiceSettings } | { ok: false; error: string } {
  const next = sanitizeInvoiceSettings({ ...getInvoiceSettings(agencyId), ...input });
  if (next.pixKey) {
    const key = validatePixKey(next.pixKey);
    if (!key.ok) return { ok: false, error: key.error };
    next.pixKey = key.key;
  }
  return { ok: true, settings: setKv(kvKeyFor(SETTINGS_KEY, agencyId), next) };
}

type Row = Omit<ClientInvoice, "items" | "agencyId" | "paidMarkedBy"> & { itemsJson: string; agencyId: string | null; paidMarkedBy: string };
const toInvoice = (row: Row): ClientInvoice => {
  const { itemsJson, ...rest } = row;
  let items: InvoiceItem[] = [];
  try {
    items = JSON.parse(itemsJson);
  } catch {
    items = [];
  }
  return {
    ...rest,
    agencyId: row.agencyId ?? "",
    items,
    status: row.status,
    paidMarkedBy: row.paidMarkedBy === "client" || row.paidMarkedBy === "agency" ? row.paidMarkedBy : "",
  };
};

export function getInvoice(id: string): ClientInvoice | null {
  const row = db.prepare("SELECT * FROM client_invoices WHERE id = ?").get(id) as Row | undefined;
  return row ? toInvoice(row) : null;
}

export function getInvoiceByToken(token: string): ClientInvoice | null {
  const row = db.prepare("SELECT * FROM client_invoices WHERE token = ?").get(token) as Row | undefined;
  return row ? toInvoice(row) : null;
}

export type InvoiceWithState = ClientInvoice & { state: InvoiceState; clientName: string };

export function listInvoices(filter: { scope: TenantScope; clientId?: string; month?: string; limit?: number }): InvoiceWithState[] {
  const where = scopeWhere(filter.scope, "i.agencyId");
  const clauses = [where.sql];
  const params: (string | number)[] = [...where.params];
  if (filter.clientId) {
    clauses.push("i.clientId = ?");
    params.push(filter.clientId);
  }
  if (filter.month) {
    clauses.push("i.month = ?");
    params.push(filter.month);
  }
  params.push(Math.min(500, filter.limit ?? 200));
  const today = brazilToday();
  return (
    db
      .prepare(
        `SELECT i.*, c.name AS clientName FROM client_invoices i JOIN clients c ON c.id = i.clientId
         WHERE ${clauses.join(" AND ")} ORDER BY i.month DESC, i.createdAt DESC LIMIT ?`
      )
      .all(...params) as (Row & { clientName: string })[]
  ).map((row) => {
    const invoice = toInvoice(row);
    return { ...invoice, clientName: row.clientName, state: invoiceState(invoice, today) };
  });
}

// Rascunho do mês de um cliente (idempotente: um rascunho/fatura aberta por mês).
export function createDraftInvoice(clientId: string, month: string, manual: { label: string; amount: number }[] = []): ClientInvoice | { error: string } {
  const client = getClient(clientId);
  if (!client) return { error: "Cliente não encontrado" };
  const existing = db
    .prepare("SELECT * FROM client_invoices WHERE clientId = ? AND month = ? AND status != 'void' ORDER BY createdAt DESC LIMIT 1")
    .get(clientId, month) as Row | undefined;
  if (existing) return toInvoice(existing);
  const fee = (db.prepare("SELECT monthlyFee FROM clients WHERE id = ?").get(clientId) as { monthlyFee?: number } | undefined)?.monthlyFee ?? 0;
  const extras = unbilledApprovedExtras(clientId, month);
  const draft = buildDraftItems({ month, monthlyFee: Number(fee) || 0, extras, manual });
  if (draft.items.length === 0) return { error: "Sem fee nem extras neste mês. Defina o fee do cliente em Horas & margem ou adicione uma linha." };
  const settings = getInvoiceSettings(client.agencyId);
  const id = randomUUID();
  db.transaction(() => {
    db.prepare(
      `INSERT INTO client_invoices (id, agencyId, clientId, month, itemsJson, total, dueDate, status, token, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`
    ).run(id, client.agencyId, clientId, month, JSON.stringify(draft.items), draft.total, dueDateFor(month, settings.dueDay), randomBytes(24).toString("base64url"), nowIso());
    markExtrasInvoiced(extras.map((e) => e.id), id);
  }).immediate();
  return getInvoice(id)!;
}

export function updateDraftInvoice(id: string, patch: { items?: InvoiceItem[]; dueDate?: string }): ClientInvoice | { error: string } {
  const invoice = getInvoice(id);
  if (!invoice) return { error: "Fatura não encontrada" };
  if (invoice.status !== "draft") return { error: "Só dá para editar a fatura antes de enviar." };
  const items = (patch.items ?? invoice.items)
    .filter((i) => i.label.trim() && Number(i.amount) > 0)
    .map((i) => ({ ...i, label: i.label.trim().slice(0, 120), amount: Math.round(Number(i.amount) * 100) / 100 }));
  if (items.length === 0) return { error: "A fatura precisa de pelo menos uma linha." };
  const dueDate = patch.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(patch.dueDate) ? patch.dueDate : invoice.dueDate;
  db.prepare("UPDATE client_invoices SET itemsJson = ?, total = ?, dueDate = ? WHERE id = ?").run(JSON.stringify(items), invoiceTotal(items), dueDate, id);
  return getInvoice(id)!;
}

// Enviar: congela o Pix (valor + identificador) com a chave atual.
export function sendInvoice(id: string): ClientInvoice | { error: string; status: number } {
  const invoice = getInvoice(id);
  if (!invoice) return { error: "Fatura não encontrada", status: 404 };
  if (invoice.status === "void" || invoice.status === "paid") return { error: "Esta fatura já foi encerrada.", status: 409 };
  const settings = getInvoiceSettings(invoice.agencyId);
  if (!settingsReady(settings)) return { error: "Cadastre sua chave Pix em Configurações → Recebimentos.", status: 409 };
  const pixPayload = buildPixPayload({
    key: settings.pixKey,
    name: settings.beneficiaryName,
    city: settings.city,
    amount: invoice.total,
    txid: `MQ${invoice.month.replace("-", "")}${invoice.id.replace(/-/g, "").slice(0, 12)}`,
  });
  db.prepare("UPDATE client_invoices SET status = CASE WHEN status = 'draft' THEN 'sent' ELSE status END, pixPayload = ?, sentAt = COALESCE(sentAt, ?) WHERE id = ?").run(
    pixPayload,
    nowIso(),
    id
  );
  logActivity({ audience: "client", clientId: invoice.clientId, text: `Nova fatura de ${invoice.month} disponível`, href: `/fatura/${invoice.token}` });
  return getInvoice(id)!;
}

// "Já paguei" (cliente, pela página pública): a agência confere e confirma.
export function claimInvoicePaid(token: string): ClientInvoice | { error: string; status: number } {
  const invoice = getInvoiceByToken(token);
  if (!invoice || invoice.status === "draft") return { error: "Fatura não encontrada", status: 404 };
  if (invoice.status === "void") return { error: "Esta fatura foi cancelada.", status: 410 };
  if (invoice.status === "paid" || invoice.status === "paid_claimed") return invoice;
  const changed = db
    .prepare("UPDATE client_invoices SET status = 'paid_claimed', paidClaimedAt = ?, paidMarkedBy = 'client' WHERE id = ? AND status = 'sent'")
    .run(nowIso(), invoice.id).changes;
  if (changed > 0) {
    const client = getClient(invoice.clientId);
    notifyAgency({
      agencyId: invoice.agencyId,
      clientId: invoice.clientId,
      href: "/invoices",
      text: `💸 ${client?.name ?? "Cliente"} avisou que pagou a fatura de ${invoice.month} (R$ ${invoice.total.toFixed(2)}). Confira no banco e confirme.`,
      whatsappBody: `${client?.name ?? "Cliente"} avisou que pagou a fatura de ${invoice.month} (R$ ${invoice.total.toFixed(2)}). Confira no banco e confirme na Marqa.`,
    });
  }
  return getInvoiceByToken(token)!;
}

export function setInvoicePaid(id: string, paid: boolean): ClientInvoice | { error: string; status: number } {
  const invoice = getInvoice(id);
  if (!invoice) return { error: "Fatura não encontrada", status: 404 };
  if (invoice.status === "void" || invoice.status === "draft") return { error: "Envie a fatura antes de marcar o pagamento.", status: 409 };
  if (paid) {
    db.prepare("UPDATE client_invoices SET status = 'paid', paidAt = ?, paidMarkedBy = 'agency' WHERE id = ?").run(nowIso(), id);
    logActivity({ audience: "client", clientId: invoice.clientId, text: `Pagamento da fatura de ${invoice.month} confirmado. Obrigado!`, href: `/fatura/${invoice.token}` });
  } else {
    db.prepare("UPDATE client_invoices SET status = 'sent', paidAt = NULL, paidClaimedAt = NULL, paidMarkedBy = '' WHERE id = ?").run(id);
  }
  return getInvoice(id)!;
}

export function voidInvoice(id: string): ClientInvoice | { error: string; status: number } {
  const invoice = getInvoice(id);
  if (!invoice) return { error: "Fatura não encontrada", status: 404 };
  if (invoice.status === "paid") return { error: "Fatura paga não pode ser cancelada.", status: 409 };
  db.transaction(() => {
    db.prepare("UPDATE client_invoices SET status = 'void' WHERE id = ?").run(id);
    // extras voltam a ficar disponíveis para a próxima fatura
    db.prepare("UPDATE scope_requests SET invoiceId = NULL WHERE invoiceId = ?").run(id);
  }).immediate();
  return getInvoice(id)!;
}

export function invoicePageData(token: string) {
  const invoice = getInvoiceByToken(token);
  if (!invoice || invoice.status === "draft") return null;
  const client = getClient(invoice.clientId);
  const agency = getAgency(invoice.agencyId);
  if (!client || !agency) return null;
  const settings = getInvoiceSettings(invoice.agencyId);
  return {
    invoice,
    state: invoiceState(invoice, brazilToday()),
    clientName: client.name,
    lang: client.language,
    agency: { id: agency.id, name: agency.name, tagline: agency.tagline, accentColor: agency.accentColor, logoMime: agency.logoMime },
    beneficiary: settings.beneficiaryName,
    lateNote: settings.lateNote,
  };
}

// Dia 1: rascunho para cada cliente com fee (uma vez por dia, idempotente).
export function runMonthlyInvoiceDrafts(now: Date = new Date()): number {
  if (!isDraftDay(now)) return 0;
  const today = brazilToday(now);
  const marker = getKv<{ day: string }>("invoice_drafts_ran", { day: "" });
  if (marker.day === today) return 0;
  setKv("invoice_drafts_ran", { day: today });
  const month = today.slice(0, 7);
  let created = 0;
  for (const client of listClients(ALL_AGENCIES)) {
    const fee = (db.prepare("SELECT monthlyFee FROM clients WHERE id = ?").get(client.id) as { monthlyFee?: number } | undefined)?.monthlyFee ?? 0;
    if (!(Number(fee) > 0)) continue;
    const before = db.prepare("SELECT COUNT(*) AS c FROM client_invoices WHERE clientId = ? AND month = ? AND status != 'void'").get(client.id, month) as { c: number };
    if (before.c > 0) continue;
    const result = createDraftInvoice(client.id, month);
    if (!("error" in result)) created++;
  }
  return created;
}

// Hoje: a receber na semana e atrasadas.
export function receivablesSummary(scope: TenantScope, now: Date = new Date()) {
  const today = brazilToday(now);
  const weekEnd = brazilToday(new Date(now.getTime() + 7 * 86_400_000));
  const open = listInvoices({ scope, limit: 500 }).filter((i) => i.status === "sent" || i.status === "paid_claimed");
  return {
    today,
    dueSoon: open.filter((i) => i.dueDate >= today && i.dueDate <= weekEnd).map(summaryRow),
    overdue: open.filter((i) => i.state === "overdue").map(summaryRow),
    drafts: listInvoices({ scope, limit: 500 }).filter((i) => i.status === "draft").length,
    claimed: open.filter((i) => i.status === "paid_claimed").length,
  };
}

const summaryRow = (i: InvoiceWithState) => ({
  id: i.id,
  clientId: i.clientId,
  clientName: i.clientName,
  total: i.total,
  dueDate: i.dueDate,
  status: i.status,
  token: i.token,
});

// Receita recebida de verdade (faturas pagas) por cliente no mês.
export function paidInvoicesByClient(agencyId: string, month: string): Map<string, number> {
  const rows = db
    .prepare("SELECT clientId, SUM(total) AS total FROM client_invoices WHERE agencyId = ? AND month = ? AND status = 'paid' GROUP BY clientId")
    .all(agencyId, month) as { clientId: string; total: number }[];
  return new Map(rows.map((r) => [r.clientId, Number(r.total) || 0]));
}
