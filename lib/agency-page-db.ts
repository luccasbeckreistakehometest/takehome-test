import { randomUUID } from "crypto";
import { addColumnIfMissing, db } from "./db";
import { getKv, setKv } from "./kv-settings";
// Garante que deliverables/clients/client_assets/prospects existem antes das
// migrações abaixo (os módulos criam as tabelas ao serem importados).
import { createProspect } from "./marketplace-db";
import { createContact } from "./messaging-db";
import { getSettings } from "./settings";
import { notifyAgency } from "./notify";
import {
  DEFAULT_AGENCY_PAGE,
  leadToProspectFields,
  normalizeSlug,
  sanitizeAgencyPage,
  type AgencyPageConfig,
  type Lead,
} from "./agency-page-rules";

// Página pública da agência (/a/[slug]): configuração em chave/valor, peças
// marcadas "mostrar no portfólio", clientes que consentiram aparecer e os
// leads que chegaram pelo formulário.

const PAGE_KEY = "agency_page";

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

const now = () => new Date().toISOString();

export function getAgencyPage(): AgencyPageConfig {
  return sanitizeAgencyPage(getKv<AgencyPageConfig>(PAGE_KEY, DEFAULT_AGENCY_PAGE));
}

// Slug em branco cai no nome da agência, para a página nunca ficar sem endereço.
export function saveAgencyPage(input: Partial<AgencyPageConfig>): AgencyPageConfig {
  const next = sanitizeAgencyPage(input, getAgencyPage());
  if (!next.slug) next.slug = normalizeSlug(getSettings().agencyName) || "agencia";
  return setKv(PAGE_KEY, next);
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
  WHERE d.kind = 'delivery' AND d.mime LIKE 'image/%'`;

// Candidatas ao portfólio: toda entrega em imagem (a agência escolhe).
export function listPortfolioCandidates(): PortfolioItem[] {
  return (db.prepare(`${PORTFOLIO_SQL} ORDER BY d.createdAt DESC LIMIT 200`).all() as PortfolioRow[]).map((r) => ({
    ...r,
    public: r.public === 1,
  }));
}

export function listPublicWork(): PortfolioItem[] {
  return (db.prepare(`${PORTFOLIO_SQL} AND d.public = 1 ORDER BY d.createdAt DESC LIMIT 24`).all() as PortfolioRow[]).map((r) => ({
    ...r,
    public: true,
  }));
}

export function setPublicDeliverables(ids: string[]): void {
  const tx = db.transaction((list: string[]) => {
    db.prepare("UPDATE deliverables SET public = 0").run();
    const mark = db.prepare("UPDATE deliverables SET public = 1 WHERE id = ? AND kind = 'delivery' AND mime LIKE 'image/%'");
    for (const id of list) mark.run(id);
  });
  tx(ids);
}

export function getPublicDeliverable(id: string): { id: string; mime: string; title: string } | null {
  const row = db
    .prepare("SELECT id, mime, title FROM deliverables WHERE id = ? AND public = 1 AND kind = 'delivery' AND mime LIKE 'image/%'")
    .get(id) as { id: string; mime: string; title: string } | undefined;
  return row ?? null;
}

export type ShowcaseClient = { id: string; name: string; industry: string; showcase: boolean; hasLogo: boolean };

function logoAsset(clientId: string): { id: string; ext: string; mime: string } | null {
  const row = db
    .prepare("SELECT id, ext, mime FROM client_assets WHERE clientId = ? AND kind = 'brand' AND mime LIKE 'image/%' ORDER BY createdAt DESC LIMIT 1")
    .get(clientId) as { id: string; ext: string; mime: string } | undefined;
  return row ?? null;
}

export function listShowcaseCandidates(): ShowcaseClient[] {
  const rows = db.prepare("SELECT id, name, industry, showcase FROM clients ORDER BY name ASC").all() as {
    id: string;
    name: string;
    industry: string;
    showcase: number;
  }[];
  return rows.map((r) => ({ id: r.id, name: r.name, industry: r.industry, showcase: r.showcase === 1, hasLogo: Boolean(logoAsset(r.id)) }));
}

export function listShowcaseClients(): ShowcaseClient[] {
  return listShowcaseCandidates().filter((c) => c.showcase);
}

export function setShowcaseClients(ids: string[]): void {
  const tx = db.transaction((list: string[]) => {
    db.prepare("UPDATE clients SET showcase = 0").run();
    const mark = db.prepare("UPDATE clients SET showcase = 1 WHERE id = ?");
    for (const id of list) mark.run(id);
  });
  tx(ids);
}

// Logo público de um cliente: só com consentimento (showcase) e só imagem de
// identidade visual enviada nos arquivos da marca.
export function getShowcaseLogo(clientId: string): { id: string; ext: string; mime: string } | null {
  const row = db.prepare("SELECT showcase FROM clients WHERE id = ?").get(clientId) as { showcase: number } | undefined;
  if (!row || row.showcase !== 1) return null;
  return logoAsset(clientId);
}

export type LeadRecord = Lead & {
  id: string;
  slug: string;
  ip: string;
  prospectId: string | null;
  contactId: string | null;
  createdAt: string;
};

// Lead do formulário → prospect (mesma lista da prospecção) + contato de
// WhatsApp + aviso para a agência (sino e fila de WhatsApp quando houver canal).
export function createLeadFromPage(input: { slug: string; lead: Lead; ip: string }): LeadRecord {
  const fields = leadToProspectFields(input.lead);
  const prospect = createProspect({
    searchQuery: "pagina-publica",
    name: input.lead.name,
    segment: "",
    location: "",
    website: "",
    instagram: "",
    ...fields,
  });
  const contact = createContact({
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
    slug: input.slug,
    ip: input.ip,
    prospectId: prospect.id,
    contactId: contact.id,
    createdAt: now(),
  };
  db.prepare(
    `INSERT INTO leads (id, slug, name, whatsapp, need, budgetBand, ip, prospectId, contactId, createdAt)
     VALUES (@id, @slug, @name, @whatsapp, @need, @budgetBand, @ip, @prospectId, @contactId, @createdAt)`
  ).run(record);
  notifyAgency({
    text: `📥 Novo lead pela página pública: ${input.lead.name} — ${input.lead.need.slice(0, 80)}`,
    href: "/prospecting",
    whatsappBody: `📥 Novo lead pela sua página: ${input.lead.name} (WhatsApp +${input.lead.whatsapp}).\nPrecisa de: ${input.lead.need.slice(0, 200)}\nVerba: ${fields.marketingMaturity.replace(/^[^:]+: /, "")}`,
  });
  return record;
}

export function listLeads(limit = 50): LeadRecord[] {
  return db.prepare("SELECT * FROM leads ORDER BY createdAt DESC LIMIT ?").all(limit) as LeadRecord[];
}

export function countLeads(): number {
  return (db.prepare("SELECT COUNT(*) AS c FROM leads").get() as { c: number }).c;
}
