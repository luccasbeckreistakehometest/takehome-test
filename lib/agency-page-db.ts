import { randomUUID } from "crypto";
import { addColumnIfMissing, db, tenantColumn } from "./db";
// Garante que deliverables/clients/client_assets/prospects existem antes das
// migrações abaixo (os módulos criam as tabelas ao serem importados).
import { createProspect } from "./marketplace-db";
import { createContact } from "./messaging-db";
import { notifyAgency } from "./notify";
import { leadToProspectFields, type AgencyPageConfig, type Lead } from "./agency-page-rules";
import { getAgency, getAgencyBySlug, getAgencyPageConfig, saveAgencyPageConfig, type SavePageResult } from "./agencies";
import { scopeWhere, type TenantScope } from "./tenancy-rules";

// Página pública de CADA agência (/a/[slug]): configuração na linha da
// agência, peças marcadas "mostrar no portfólio" (só da agência), clientes que
// consentiram aparecer e os leads que chegaram pelo formulário.

addColumnIfMissing("deliverables", "public", "INTEGER NOT NULL DEFAULT 0");
addColumnIfMissing("clients", "showcase", "INTEGER NOT NULL DEFAULT 0");
db.exec(`
  CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL,
    name TEXT NOT NULL,
    whatsapp TEXT NOT NULL,
    need TEXT NOT NULL DEFAULT '',
    budgetBand TEXT NOT NULL DEFAULT '',
    ip TEXT NOT NULL DEFAULT '',
    prospectId TEXT,
    contactId TEXT,
    createdAt TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(createdAt DESC);
`);
tenantColumn("leads");

const now = () => new Date().toISOString();

export function getAgencyPage(agencyId: string): AgencyPageConfig {
  return getAgencyPageConfig(agencyId);
}

// Slug em branco cai no endereço atual da agência; slug de outra agência é recusado.
export function saveAgencyPage(agencyId: string, input: Partial<AgencyPageConfig>): SavePageResult {
  return saveAgencyPageConfig(agencyId, input);
}

// Página publicada pelo endereço público (null = não existe ou despublicada).
export function findPublishedPage(slug: string): { agencyId: string; config: AgencyPageConfig } | null {
  const agency = getAgencyBySlug(slug);
  if (!agency) return null;
  const config = getAgencyPageConfig(agency.id);
  if (!config.published || config.slug !== agency.slug) return null;
  return { agencyId: agency.id, config };
}

export type PortfolioItem = {
  id: string;
  title: string;
  mime: string;
  projectTitle: string;
  clientId: string;
  clientName: string;
  approvalStatus: string;
  public: boolean;
  createdAt: string;
};

type PortfolioRow = Omit<PortfolioItem, "public"> & { public: number };

const PORTFOLIO_SQL = `
  SELECT d.id, d.title, d.mime, d.approvalStatus, d.public, d.createdAt,
         p.title AS projectTitle, c.id AS clientId, c.name AS clientName
  FROM deliverables d
  JOIN projects p ON p.id = d.projectId
  JOIN clients c ON c.id = p.clientId
  WHERE d.kind = 'delivery' AND d.mime LIKE 'image/%' AND d.agencyId = ?`;

// Candidatas ao portfólio: toda entrega em imagem da agência (ela escolhe).
export function listPortfolioCandidates(agencyId: string): PortfolioItem[] {
  return (db.prepare(`${PORTFOLIO_SQL} ORDER BY d.createdAt DESC LIMIT 200`).all(agencyId) as PortfolioRow[]).map((r) => ({
    ...r,
    public: r.public === 1,
  }));
}

export function listPublicWork(agencyId: string): PortfolioItem[] {
  return (db.prepare(`${PORTFOLIO_SQL} AND d.public = 1 ORDER BY d.createdAt DESC LIMIT 24`).all(agencyId) as PortfolioRow[]).map((r) => ({
    ...r,
    public: true,
  }));
}

// Marca/desmarca só entregas da própria agência (id de outra é ignorado).
export function setPublicDeliverables(agencyId: string, ids: string[]): void {
  const tx = db.transaction((list: string[]) => {
    db.prepare("UPDATE deliverables SET public = 0 WHERE agencyId = ?").run(agencyId);
    const mark = db.prepare(
      "UPDATE deliverables SET public = 1 WHERE id = ? AND agencyId = ? AND kind = 'delivery' AND mime LIKE 'image/%'"
    );
    for (const id of list) mark.run(id, agencyId);
  });
  tx(ids);
}

export function getPublicDeliverable(agencyId: string, id: string): { id: string; mime: string; title: string } | null {
  const row = db
    .prepare(
      "SELECT id, mime, title FROM deliverables WHERE id = ? AND agencyId = ? AND public = 1 AND kind = 'delivery' AND mime LIKE 'image/%'"
    )
    .get(id, agencyId) as { id: string; mime: string; title: string } | undefined;
  return row ?? null;
}

export type ShowcaseClient = { id: string; name: string; industry: string; showcase: boolean; hasLogo: boolean };

function logoAsset(clientId: string): { id: string; ext: string; mime: string } | null {
  const row = db
    .prepare("SELECT id, ext, mime FROM client_assets WHERE clientId = ? AND kind = 'brand' AND mime LIKE 'image/%' ORDER BY createdAt DESC LIMIT 1")
    .get(clientId) as { id: string; ext: string; mime: string } | undefined;
  return row ?? null;
}

export function listShowcaseCandidates(agencyId: string): ShowcaseClient[] {
  const rows = db.prepare("SELECT id, name, industry, showcase FROM clients WHERE agencyId = ? ORDER BY name ASC").all(agencyId) as {
    id: string;
    name: string;
    industry: string;
    showcase: number;
  }[];
  return rows.map((r) => ({ id: r.id, name: r.name, industry: r.industry, showcase: r.showcase === 1, hasLogo: Boolean(logoAsset(r.id)) }));
}

export function listShowcaseClients(agencyId: string): ShowcaseClient[] {
  return listShowcaseCandidates(agencyId).filter((c) => c.showcase);
}

export function setShowcaseClients(agencyId: string, ids: string[]): void {
  const tx = db.transaction((list: string[]) => {
    db.prepare("UPDATE clients SET showcase = 0 WHERE agencyId = ?").run(agencyId);
    const mark = db.prepare("UPDATE clients SET showcase = 1 WHERE id = ? AND agencyId = ?");
    for (const id of list) mark.run(id, agencyId);
  });
  tx(ids);
}

// Logo público de um cliente: só com consentimento (showcase) e só imagem de
// identidade visual enviada nos arquivos da marca.
export function getShowcaseLogo(agencyId: string, clientId: string): { id: string; ext: string; mime: string } | null {
  const row = db.prepare("SELECT showcase FROM clients WHERE id = ? AND agencyId = ?").get(clientId, agencyId) as { showcase: number } | undefined;
  if (!row || row.showcase !== 1) return null;
  return logoAsset(clientId);
}

export type LeadRecord = Lead & {
  id: string;
  agencyId: string;
  slug: string;
  ip: string;
  prospectId: string | null;
  contactId: string | null;
  createdAt: string;
};

// Lead do formulário → prospect (mesma lista da prospecção) + contato de
// WhatsApp + aviso para a agência (sino e fila de WhatsApp quando houver canal).
export function createLeadFromPage(input: { agencyId: string; slug: string; lead: Lead; ip: string }): LeadRecord {
  const fields = leadToProspectFields(input.lead);
  const prospect = createProspect({
    searchQuery: "pagina-publica",
    name: input.lead.name,
    segment: "",
    location: "",
    website: "",
    instagram: "",
    ...fields,
  }, input.agencyId);
  const contact = createContact({
    agencyId: input.agencyId,
    name: input.lead.name,
    phone: input.lead.whatsapp,
    instagram: "",
    clientId: null,
    tags: "lead",
    notes: input.lead.need,
  });
  const record: LeadRecord = {
    ...input.lead,
    id: randomUUID(),
    agencyId: input.agencyId,
    slug: input.slug,
    ip: input.ip,
    prospectId: prospect.id,
    contactId: contact.id,
    createdAt: now(),
  };
  db.prepare(
    `INSERT INTO leads (id, agencyId, slug, name, whatsapp, need, budgetBand, ip, prospectId, contactId, createdAt)
     VALUES (@id, @agencyId, @slug, @name, @whatsapp, @need, @budgetBand, @ip, @prospectId, @contactId, @createdAt)`
  ).run(record);
  notifyAgency({
    agencyId: input.agencyId,
    text: `📥 Novo lead pela página pública: ${input.lead.name} — ${input.lead.need.slice(0, 80)}`,
    href: "/prospecting",
    whatsappBody: `📥 Novo lead pela sua página: ${input.lead.name} (WhatsApp +${input.lead.whatsapp}).\nPrecisa de: ${input.lead.need.slice(0, 200)}\nVerba: ${fields.marketingMaturity.replace(/^[^:]+: /, "")}`,
  });
  return record;
}

export function listLeads(scope: TenantScope, limit = 50): LeadRecord[] {
  const where = scopeWhere(scope);
  return db.prepare(`SELECT * FROM leads WHERE ${where.sql} ORDER BY createdAt DESC LIMIT ?`).all(...where.params, limit) as LeadRecord[];
}

export function countLeads(scope: TenantScope): number {
  const where = scopeWhere(scope);
  return (db.prepare(`SELECT COUNT(*) AS c FROM leads WHERE ${where.sql}`).get(...where.params) as { c: number }).c;
}

export function agencyForPage(agencyId: string) {
  return getAgency(agencyId);
}
