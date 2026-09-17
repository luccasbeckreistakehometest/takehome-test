import { randomUUID } from "crypto";
import { addColumnIfMissing, db, getClient, tenantColumn } from "./db";
import { cachedScopeGuess } from "./scope-ai";
import { createProject, listClientProjects, listClientScheduledPosts, listClientMeetings, logActivity } from "./marketplace-db";
import { notifyAgency } from "./notify";
import {
  classificationOf,
  consumption,
  DONE_PROJECT_STATUSES,
  guessItem,
  packageUsage,
  previousMonth,
  quotaCheck,
  sanitizePackage,
  type ClientPackage,
  type Consumption,
  type UsageRow,
} from "./scope-rules";

// Pacote do cliente + pedidos fora do escopo. O pacote diz o que o fee
// cobre por mês; cada pedido do portal é conferido contra o que sobrou e,
// se passar, só vira demanda depois que o cliente aprova o valor do extra.

export type ScopeRequestStatus = "pending_client" | "approved" | "declined" | "converted" | "waived";

export type ScopeRequest = {
  id: string;
  agencyId: string;
  clientId: string;
  text: string;
  itemKey: string;
  itemLabel: string;
  qty: number;
  inPackage: boolean;
  extraPrice: number;
  status: ScopeRequestStatus;
  classifiedBy: "ai" | "manual" | "rules";
  aiReasoning: string;
  // item que o sistema sugeriu; o cliente escolheu outro com sugestão
  // confiável → a agência confere (pode cobrar como extra)
  suggestedKey: string;
  needsReview: boolean;
  projectId: string | null;
  invoiceId: string | null;
  createdAt: string;
  decidedAt: string | null;
};

db.exec(`
  CREATE TABLE IF NOT EXISTS client_packages (
    clientId TEXT PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
    itemsJson TEXT NOT NULL DEFAULT '[]',
    rolloverUnused INTEGER NOT NULL DEFAULT 0,
    updatedAt TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS scope_requests (
    id TEXT PRIMARY KEY,
    clientId TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    itemKey TEXT NOT NULL DEFAULT '',
    itemLabel TEXT NOT NULL DEFAULT '',
    qty INTEGER NOT NULL DEFAULT 1,
    inPackage INTEGER NOT NULL DEFAULT 1,
    extraPrice REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'converted',
    classifiedBy TEXT NOT NULL DEFAULT 'manual',
    aiReasoning TEXT NOT NULL DEFAULT '',
    projectId TEXT,
    invoiceId TEXT,
    createdAt TEXT NOT NULL,
    decidedAt TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_scope_requests_client ON scope_requests(clientId, createdAt);
`);
tenantColumn("client_packages");
tenantColumn("scope_requests");
addColumnIfMissing("scope_requests", "suggestedKey", "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing("scope_requests", "needsReview", "INTEGER NOT NULL DEFAULT 0");

const nowIso = () => new Date().toISOString();
export const currentMonth = (now: Date = new Date()) => now.toISOString().slice(0, 7);

export function getPackage(clientId: string): ClientPackage | null {
  const row = db.prepare("SELECT itemsJson, rolloverUnused FROM client_packages WHERE clientId = ?").get(clientId) as
    | { itemsJson: string; rolloverUnused: number }
    | undefined;
  if (!row) return null;
  try {
    return sanitizePackage({ items: JSON.parse(row.itemsJson), rolloverUnused: row.rolloverUnused === 1 });
  } catch {
    return null;
  }
}

export function savePackage(clientId: string, input: { items?: unknown; rolloverUnused?: unknown }): ClientPackage {
  const pkg = sanitizePackage(input);
  db.prepare(
    `INSERT INTO client_packages (clientId, agencyId, itemsJson, rolloverUnused, updatedAt)
     VALUES (?, (SELECT agencyId FROM clients WHERE id = ?), ?, ?, ?)
     ON CONFLICT(clientId) DO UPDATE SET itemsJson = excluded.itemsJson, rolloverUnused = excluded.rolloverUnused, updatedAt = excluded.updatedAt`
  ).run(clientId, clientId, JSON.stringify(pkg.items), pkg.rolloverUnused ? 1 : 0, nowIso());
  return pkg;
}

export function deletePackage(clientId: string): void {
  db.prepare("DELETE FROM client_packages WHERE clientId = ?").run(clientId);
}

function monthConsumption(clientId: string, month: string, pkg: ClientPackage): Consumption {
  // a tabela nasce com o módulo do relatório mensal (pode ainda não existir)
  const hasReports = Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'monthly_reports'").get());
  const reports = hasReports
    ? (db.prepare("SELECT createdAt FROM monthly_reports WHERE clientId = ?").all(clientId) as { createdAt: string }[])
    : [];
  // demanda aberta por um pedido de post/reel/... não conta como "demanda"
  // (a peça conta quando entra no calendário)
  const unitOf = new Map(pkg.items.map((i) => [i.key, i.unit]));
  const notDemand = new Set(
    (db.prepare("SELECT projectId, itemKey FROM scope_requests WHERE clientId = ? AND projectId IS NOT NULL").all(clientId) as {
      projectId: string;
      itemKey: string;
    }[])
      .filter((r) => unitOf.has(r.itemKey) && unitOf.get(r.itemKey) !== "demanda")
      .map((r) => r.projectId)
  );
  // pedido dentro do pacote reserva a cota enquanto a demanda está aberta
  // (a peça pronta passa a contar pelo calendário/reuniões/relatórios);
  // "demanda" já conta pelo próprio projeto
  const reserved = (
    db
      .prepare(
        `SELECT sr.itemKey, sr.qty, sr.createdAt FROM scope_requests sr
         LEFT JOIN projects p ON p.id = sr.projectId
         WHERE sr.clientId = ? AND sr.status = 'converted' AND sr.inPackage = 1
           AND p.id IS NOT NULL AND p.status NOT IN (${[...DONE_PROJECT_STATUSES].map(() => "?").join(",")})`
      )
      .all(clientId, ...DONE_PROJECT_STATUSES) as { itemKey: string; qty: number; createdAt: string }[]
  )
    .filter((r) => unitOf.has(r.itemKey) && unitOf.get(r.itemKey) !== "demanda")
    .map((r) => ({ unit: unitOf.get(r.itemKey)!, qty: r.qty, createdAt: r.createdAt }));
  return consumption(month, {
    reserved,
    posts: listClientScheduledPosts(clientId).map((p) => ({ format: p.format, scheduledFor: p.scheduledFor, status: p.status })),
    projects: listClientProjects(clientId)
      .filter((p) => !notDemand.has(p.id))
      .map((p) => ({ createdAt: p.createdAt })),
    meetings: listClientMeetings(clientId).map((m) => ({ scheduledAt: m.scheduledAt })),
    reports: reports.map((r) => ({ month: r.createdAt.slice(0, 7) })),
  });
}

export function clientPackageUsage(clientId: string, month = currentMonth()): { month: string; package: ClientPackage | null; usage: UsageRow[] } {
  const pkg = getPackage(clientId);
  if (!pkg) return { month, package: null, usage: [] };
  const previous = pkg.rolloverUnused ? monthConsumption(clientId, previousMonth(month), pkg) : undefined;
  return { month, package: pkg, usage: packageUsage(pkg, monthConsumption(clientId, month, pkg), previous) };
}

type Row = Omit<ScopeRequest, "inPackage" | "agencyId" | "needsReview"> & { inPackage: number; agencyId: string | null; needsReview: number };
const toRequest = (row: Row): ScopeRequest => ({
  ...row,
  agencyId: row.agencyId ?? "",
  inPackage: row.inPackage === 1,
  suggestedKey: row.suggestedKey ?? "",
  needsReview: row.needsReview === 1,
});

export function getScopeRequest(id: string): ScopeRequest | null {
  const row = db.prepare("SELECT * FROM scope_requests WHERE id = ?").get(id) as Row | undefined;
  return row ? toRequest(row) : null;
}

export function listScopeRequests(clientId: string, limit = 30): ScopeRequest[] {
  return (db.prepare("SELECT * FROM scope_requests WHERE clientId = ? ORDER BY createdAt DESC LIMIT ?").all(clientId, limit) as Row[]).map(toRequest);
}

function demandFor(request: Pick<ScopeRequest, "clientId" | "text" | "itemLabel" | "qty" | "inPackage" | "extraPrice">): string {
  const extra = request.inPackage ? "dentro do pacote" : `extra aprovado pelo cliente: R$ ${request.extraPrice.toFixed(2)}`;
  const project = createProject({
    clientId: request.clientId,
    title: `Solicitação do cliente: ${request.text.slice(0, 60)}`,
    brief: `Solicitação enviada pelo cliente no portal (${request.qty}× ${request.itemLabel || "item"}, ${extra}):\n\n${request.text}`,
    skillsNeeded: [],
    location: "",
    budget: request.inPackage ? "" : `R$ ${request.extraPrice.toFixed(2)}`,
    deadline: "",
    mode: "internal",
  });
  return project.id;
}

export type ScopeCreateResult = { request: ScopeRequest; needsApproval: boolean };

// Registra o pedido. Sem pacote, ou dentro do que sobrou: vira demanda na
// hora (e reserva a cota). Passou do pacote: fica esperando o cliente
// aprovar o valor. A classificação guardada é a do servidor (IA em cache ou
// palavras-chave), nunca a que o navegador diz.
export function createScopeRequest(input: {
  clientId: string;
  text: string;
  itemKey: string;
  qty: number;
}): ScopeCreateResult | { error: string } {
  const client = getClient(input.clientId);
  if (!client) return { error: "Cliente não encontrado" };
  const { package: pkg, usage } = clientPackageUsage(input.clientId);
  const row = usage.find((u) => u.key === input.itemKey);
  if (pkg && pkg.items.length > 0 && !row) return { error: "Escolha um item do pacote." };
  const qty = Math.max(1, Math.min(50, Math.floor(input.qty || 1)));
  const verdict = row ? quotaCheck(row, qty) : { inPackage: true, extraQty: 0, extraTotal: 0 };
  const classification =
    pkg && row
      ? classificationOf({ chosenKey: row.key, ai: cachedScopeGuess(input.text, pkg), rules: guessItem(input.text, pkg) })
      : { classifiedBy: "manual" as const, aiReasoning: "", suggestedKey: "", needsReview: false };
  const request: ScopeRequest = {
    id: randomUUID(),
    agencyId: client.agencyId,
    clientId: client.id,
    text: input.text.trim().slice(0, 2000),
    itemKey: row?.key ?? "",
    itemLabel: row?.label ?? "",
    qty,
    inPackage: verdict.inPackage,
    extraPrice: verdict.extraTotal,
    status: verdict.inPackage ? "converted" : "pending_client",
    classifiedBy: classification.classifiedBy,
    aiReasoning: classification.aiReasoning,
    suggestedKey: classification.suggestedKey,
    // só pedido que já virou demanda dentro do pacote precisa de conferência
    needsReview: classification.needsReview && verdict.inPackage,
    projectId: null,
    invoiceId: null,
    createdAt: nowIso(),
    decidedAt: null,
  };
  db.transaction(() => {
    if (request.inPackage) {
      request.projectId = demandFor(request);
      request.decidedAt = request.createdAt;
    }
    db.prepare(
      `INSERT INTO scope_requests (id, agencyId, clientId, text, itemKey, itemLabel, qty, inPackage, extraPrice, status, classifiedBy, aiReasoning, suggestedKey, needsReview, projectId, invoiceId, createdAt, decidedAt)
       VALUES (@id, @agencyId, @clientId, @text, @itemKey, @itemLabel, @qty, @inPackage, @extraPrice, @status, @classifiedBy, @aiReasoning, @suggestedKey, @needsReview, @projectId, @invoiceId, @createdAt, @decidedAt)`
    ).run({ ...request, inPackage: request.inPackage ? 1 : 0, needsReview: request.needsReview ? 1 : 0 });
  }).immediate();
  notifyAgency({
    agencyId: client.agencyId,
    clientId: client.id,
    href: `/clients/${client.id}?tab=package`,
    text: request.inPackage
      ? `📋 ${client.name} pediu: ${request.text.slice(0, 100)} (dentro do pacote${request.needsReview ? " — o cliente escolheu outro item do que o sugerido, confira" : ""})`
      : `💰 ${client.name} pediu algo fora do pacote (+R$ ${request.extraPrice.toFixed(2)}): ${request.text.slice(0, 80)} — aguardando o cliente aprovar o valor`,
  });
  return { request: getScopeRequest(request.id)!, needsApproval: !request.inPackage };
}

// O cliente decide o extra (aprovar → vira demanda e entra na fatura do mês).
// A agência pode dispensar a cobrança (vira demanda sem valor) ou cancelar.
// Reclassificar (agência): pedido que entrou "dentro do pacote" mas não é
// do pacote vira extra com o valor que a agência definir e espera o cliente.
// A demanda já criada continua (a agência segura a produção se quiser).
export function chargeAsExtra(id: string, price: number): ScopeRequest | { error: string; status: number } {
  const request = getScopeRequest(id);
  if (!request) return { error: "Pedido não encontrado", status: 404 };
  if (request.status !== "converted" || !request.inPackage) return { error: "Só pedidos dentro do pacote podem virar extra.", status: 409 };
  const value = Math.round(Math.max(0, Math.min(100_000, Number(price) || 0)) * 100) / 100;
  if (value <= 0) return { error: "Informe o valor do extra.", status: 400 };
  const client = getClient(request.clientId);
  if (!client) return { error: "Pedido não encontrado", status: 404 };
  const changed = db
    .prepare("UPDATE scope_requests SET status = 'pending_client', inPackage = 0, extraPrice = ?, needsReview = 0, decidedAt = NULL WHERE id = ? AND status = 'converted'")
    .run(value, id).changes;
  if (changed === 0) return { error: "Este pedido já foi decidido.", status: 409 };
  logActivity({
    audience: "client",
    clientId: client.id,
    text: `A agência avisou que "${request.text.slice(0, 60)}" fica fora do pacote: extra de R$ ${value.toFixed(2)} para você aprovar`,
    href: `/portal/client/${client.id}`,
  });
  return getScopeRequest(id)!;
}

export function decideScopeRequest(
  id: string,
  decision: "approved" | "declined" | "waived",
  actor: "client" | "agency"
): ScopeRequest | { error: string; status: number } {
  const request = getScopeRequest(id);
  if (!request) return { error: "Pedido não encontrado", status: 404 };
  if (request.status !== "pending_client") return { error: "Este pedido já foi decidido.", status: 409 };
  if (actor === "client" && decision === "waived") return { error: "Ação inválida", status: 400 };
  const client = getClient(request.clientId);
  if (!client) return { error: "Pedido não encontrado", status: 404 };
  const at = nowIso();
  db.transaction(() => {
    // reserva atômica: só um clique decide
    const claimed = db
      .prepare("UPDATE scope_requests SET status = ?, decidedAt = ? WHERE id = ? AND status = 'pending_client'")
      .run(decision, at, id).changes;
    if (claimed === 0) return;
    if (decision === "declined") return;
    const waived = decision === "waived";
    // reclassificado pela agência: a demanda já existe
    const projectId = request.projectId ?? demandFor({ ...request, inPackage: waived, extraPrice: waived ? 0 : request.extraPrice });
    db.prepare("UPDATE scope_requests SET projectId = ?, extraPrice = ? WHERE id = ?").run(projectId, waived ? 0 : request.extraPrice, id);
  }).immediate();
  const updated = getScopeRequest(id)!;
  if (decision === "approved") {
    notifyAgency({
      agencyId: client.agencyId,
      clientId: client.id,
      href: `/clients/${client.id}?tab=package`,
      text: `✅ ${client.name} aprovou o extra de R$ ${updated.extraPrice.toFixed(2)}: ${updated.text.slice(0, 80)} — entra na fatura do mês`,
      whatsappBody: `${client.name} aprovou um extra de R$ ${updated.extraPrice.toFixed(2)}: ${updated.text.slice(0, 200)}`,
    });
  } else if (decision === "declined" && actor === "client") {
    notifyAgency({
      agencyId: client.agencyId,
      clientId: client.id,
      href: `/clients/${client.id}?tab=package`,
      text: request.projectId
        ? `${client.name} não aprovou o extra de "${updated.text.slice(0, 60)}". A demanda aberta continua no painel: cancele se não for fazer.`
        : `${client.name} desistiu do extra: ${updated.text.slice(0, 80)}`,
    });
  } else {
    logActivity({
      audience: "client",
      clientId: client.id,
      text: decision === "waived" ? `A agência incluiu sem custo: ${updated.text.slice(0, 80)}` : `A agência cancelou o pedido: ${updated.text.slice(0, 80)}`,
      href: `/portal/client/${client.id}`,
    });
  }
  return updated;
}

// Extras aprovados (a cobrar) de um cliente num mês, ainda sem fatura.
export function unbilledApprovedExtras(clientId: string, month: string): ScopeRequest[] {
  return (
    db
      .prepare(
        "SELECT * FROM scope_requests WHERE clientId = ? AND status = 'approved' AND extraPrice > 0 AND invoiceId IS NULL AND substr(decidedAt, 1, 7) <= ? ORDER BY decidedAt"
      )
      .all(clientId, month) as Row[]
  ).map(toRequest);
}

export function markExtrasInvoiced(ids: string[], invoiceId: string): void {
  const stmt = db.prepare("UPDATE scope_requests SET invoiceId = ? WHERE id = ? AND invoiceId IS NULL");
  for (const id of ids) stmt.run(invoiceId, id);
}

// Hoje: soma dos extras aprovados no mês pela agência.
export function approvedExtrasTotal(agencyId: string | null, month = currentMonth()): { total: number; count: number } {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(extraPrice),0) AS total, COUNT(*) AS count FROM scope_requests
       WHERE status = 'approved' AND substr(decidedAt, 1, 7) = ? ${agencyId ? "AND agencyId = ?" : ""}`
    )
    .get(month, ...(agencyId ? [agencyId] : [])) as { total: number; count: number };
  return row;
}

export function pendingScopeCount(agencyId: string | null): number {
  const row = db
    .prepare(`SELECT COUNT(*) AS c FROM scope_requests WHERE status = 'pending_client' ${agencyId ? "AND agencyId = ?" : ""}`)
    .get(...(agencyId ? [agencyId] : [])) as { c: number };
  return row.c;
}
