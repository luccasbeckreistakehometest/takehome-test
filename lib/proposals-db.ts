import { randomBytes, randomUUID } from "crypto";
import { addColumnIfMissing, createClient, db, getClient, tenantColumn } from "./db";
import { scopeWhere, type TenantScope } from "./tenancy-rules";
import { createUser, randomPassword } from "./auth";
import { getProspect, updateProspect } from "./marketplace-db";
import { notifyAgency } from "./notify";
import {
  canAccept,
  proposalState,
  type ProposalContent,
  type ProposalState,
  type ProposalStatus,
} from "./proposal-rules";

// Proposta pública em 5 minutos: gerada a partir de um prospect, aberta por
// token (sem login), expira, e o "Aceitar" cria o cliente + login do portal
// e avisa a agência.

export type Proposal = {
  id: string;
  agencyId: string;
  token: string;
  prospectId: string | null;
  clientId: string | null;
  prospectName: string;
  segment: string;
  lang: "pt-BR" | "en";
  currency: string;
  content: ProposalContent;
  status: ProposalStatus;
  expiresAt: string;
  viewedAt: string | null;
  acceptedAt: string | null;
  acceptedPackage: string;
  acceptedBy: string;
  acceptedContact: string;
  createdAt: string;
};

db.exec(`
  CREATE TABLE IF NOT EXISTS proposals (
    id TEXT PRIMARY KEY,
    token TEXT NOT NULL UNIQUE,
    prospectId TEXT,
    clientId TEXT,
    prospectName TEXT NOT NULL,
    segment TEXT NOT NULL DEFAULT '',
    lang TEXT NOT NULL DEFAULT 'pt-BR',
    currency TEXT NOT NULL DEFAULT 'BRL',
    content TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'sent',
    expiresAt TEXT NOT NULL,
    viewedAt TEXT,
    acceptedAt TEXT,
    acceptedPackage TEXT NOT NULL DEFAULT '',
    acceptedBy TEXT NOT NULL DEFAULT '',
    acceptedContact TEXT NOT NULL DEFAULT '',
    createdAt TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_proposals_prospect ON proposals(prospectId, createdAt);
`);
tenantColumn("proposals");
// Reserva do aceite (dois cliques/aceites ao mesmo tempo: só um cria a marca).
addColumnIfMissing("proposals", "claimedAt", "TEXT");

type Row = Omit<Proposal, "content"> & { content: string; claimedAt?: string | null };
const toProposal = (raw: Row): Proposal => {
  const row = { ...raw };
  delete row.claimedAt; // reserva interna do aceite, não sai na API
  return toProposalFields(row);
};
const toProposalFields = (row: Row): Proposal => ({
  ...row,
  lang: row.lang === "en" ? "en" : "pt-BR",
  content: JSON.parse(row.content) as ProposalContent,
});
const now = () => new Date().toISOString();

export function createProposal(input: {
  agencyId: string;
  prospectId: string | null;
  prospectName: string;
  segment: string;
  lang: "pt-BR" | "en";
  currency: string;
  content: ProposalContent;
  expiresAt: string;
}): Proposal {
  const proposal: Proposal = {
    id: randomUUID(),
    agencyId: input.agencyId,
    token: randomBytes(12).toString("hex"),
    prospectId: input.prospectId,
    clientId: null,
    prospectName: input.prospectName,
    segment: input.segment,
    lang: input.lang,
    currency: input.currency,
    content: input.content,
    status: "sent",
    expiresAt: input.expiresAt,
    viewedAt: null,
    acceptedAt: null,
    acceptedPackage: "",
    acceptedBy: "",
    acceptedContact: "",
    createdAt: now(),
  };
  db.prepare(
    `INSERT INTO proposals (id, agencyId, token, prospectId, clientId, prospectName, segment, lang, currency, content, status, expiresAt, viewedAt, acceptedAt, acceptedPackage, acceptedBy, acceptedContact, createdAt)
     VALUES (@id, @agencyId, @token, @prospectId, @clientId, @prospectName, @segment, @lang, @currency, @content, @status, @expiresAt, @viewedAt, @acceptedAt, @acceptedPackage, @acceptedBy, @acceptedContact, @createdAt)`
  ).run({ ...proposal, content: JSON.stringify(proposal.content) });
  return proposal;
}

export function getProposalByToken(token: string): Proposal | null {
  const row = db.prepare("SELECT * FROM proposals WHERE token = ?").get(token) as Row | undefined;
  return row ? toProposal(row) : null;
}

export function listProposalsForProspect(prospectId: string): (Proposal & { state: ProposalState })[] {
  return (
    db.prepare("SELECT * FROM proposals WHERE prospectId = ? ORDER BY createdAt DESC").all(prospectId) as Row[]
  ).map((row) => {
    const p = toProposal(row);
    return { ...p, state: proposalState(p) };
  });
}

export function listRecentProposals(scope: TenantScope, limit = 50): (Proposal & { state: ProposalState })[] {
  const where = scopeWhere(scope);
  return (
    db.prepare(`SELECT * FROM proposals WHERE ${where.sql} ORDER BY createdAt DESC LIMIT ?`).all(...where.params, limit) as Row[]
  ).map((row) => {
    const p = toProposal(row);
    return { ...p, state: proposalState(p) };
  });
}

// Primeira abertura pelo prospect: sent → viewed (a agência vê que foi lida).
export function markProposalViewed(id: string): void {
  db.prepare("UPDATE proposals SET status = 'viewed', viewedAt = ? WHERE id = ? AND status = 'sent'").run(now(), id);
}

export type AcceptResult =
  | { ok: true; clientId: string; login: { username: string; password: string } | null; portalUrl: string }
  | { ok: false; reason: "not_found" | "accepted" | "expired" | "unknown_package" };

// Aceite público: cria o cliente (ou reaproveita o já convertido), o login do
// portal, marca o prospect como convertido e avisa a agência.
export async function acceptProposal(input: {
  token: string;
  packageName: string;
  name: string;
  contact: string;
}): Promise<AcceptResult> {
  const proposal = getProposalByToken(input.token);
  if (!proposal) return { ok: false, reason: "not_found" };
  const check = canAccept(proposal, input.packageName);
  if (!check.ok) return { ok: false, reason: check.reason };
  // Reserva atômica antes de qualquer await: um aceite só por proposta.
  const claimAt = now();
  const claimed =
    db
      .prepare(
        `UPDATE proposals SET claimedAt = @at WHERE id = @id AND status != 'accepted'
         AND (claimedAt IS NULL OR claimedAt < @stale)`
      )
      .run({ at: claimAt, id: proposal.id, stale: new Date(Date.now() - 2 * 60 * 1000).toISOString() }).changes === 1;
  if (!claimed) return { ok: false, reason: "accepted" };
  try {
    return await finishAccept(proposal, input);
  } catch (error) {
    db.prepare("UPDATE proposals SET claimedAt = NULL WHERE id = ? AND status != 'accepted'").run(proposal.id);
    throw error;
  }
}

async function finishAccept(
  proposal: Proposal,
  input: { token: string; packageName: string; name: string; contact: string }
): Promise<AcceptResult> {

  // A marca nasce na agência da proposta (nunca em outra).
  const prospectRow = proposal.prospectId ? getProspect(proposal.prospectId) : null;
  const prospect = prospectRow && prospectRow.agencyId === proposal.agencyId ? prospectRow : null;
  let clientId = prospect?.clientId ?? null;
  let login: { username: string; password: string } | null = null;
  if (!clientId || getClient(clientId)?.agencyId !== proposal.agencyId) {
    const client = createClient({
      name: proposal.prospectName,
      industry: proposal.segment,
      description: "",
      audience: "",
      tone: "",
      goals: "",
      budget: `${input.packageName}`,
      channels: [],
      differentials: "",
      competitors: "",
      brandColors: "",
      website: prospect?.website ?? "",
      instagram: prospect?.instagram ?? "",
      notes: `Origem: proposta pública aceita em ${now().slice(0, 10)} (pacote ${input.packageName}). Contato: ${input.name} · ${input.contact}.${prospect ? ` Maturidade: ${prospect.marketingMaturity}.` : ""}`,
      capabilities: "",
      language: proposal.lang,
      source: "agency",
      country: "Brasil",
      selfServe: false,
    }, proposal.agencyId);
    clientId = client.id;
    const password = randomPassword();
    const created = await createUser({
      password,
      role: "client",
      refId: client.id,
      agencyId: proposal.agencyId,
      name: client.name,
      mustChangePassword: true,
    });
    login = { username: created.username, password };
  }
  if (prospect) updateProspect(prospect.id, { status: "converted", clientId });
  db.prepare(
    "UPDATE proposals SET status = 'accepted', acceptedAt = ?, acceptedPackage = ?, acceptedBy = ?, acceptedContact = ?, clientId = ? WHERE id = ?"
  ).run(now(), input.packageName, input.name.slice(0, 120), input.contact.slice(0, 160), clientId, proposal.id);

  const base = (process.env.APP_URL ?? "").replace(/\/$/, "");
  notifyAgency({
    agencyId: proposal.agencyId,
    text: `🎉 ${proposal.prospectName} aceitou a proposta (${input.packageName}) — cliente criado`,
    href: `/clients/${clientId}`,
    clientId,
    whatsappBody: `🎉 ${proposal.prospectName} aceitou a proposta "${input.packageName}". Contato: ${input.name} · ${input.contact}.\nAbrir: ${base}/clients/${clientId}`,
  });
  return { ok: true, clientId, login, portalUrl: `/portal/client/${clientId}` };
}
