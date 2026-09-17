import { randomUUID } from "crypto";
import { addColumnIfMissing, db } from "./db";
import { viewAccount } from "./billing-db";
import { getPlan, isPaidPlan } from "./plans";
import { ensureHouseAgency } from "./tenancy-migration";
import { currentAiContext } from "./ai-spend";
import {
  DEFAULT_AGENCY_PAGE,
  normalizeSlug,
  sanitizeAgencyPage,
  type AgencyPageConfig,
} from "./agency-page-rules";
import { HOUSE_AGENCY_ID, RESERVED_SLUGS, uniqueSlug } from "./tenancy-rules";

// Agências (tenants): identidade, whitelabel, página pública e conta de
// billing de cada uma. Configurações da PLATAFORMA (chaves de IA, teto de
// qualidade, flags) continuam em lib/settings.ts, só para o admin.

export type Agency = {
  id: string;
  name: string;
  slug: string;
  ownerUserId: string | null;
  billingAccountId: string; // accountId da carteira (accountType "agency")
  tagline: string;
  accentColor: string;
  logoMime: string;
  houseStyle: string;
  createdAt: string;
};

export type AgencyBranding = Pick<Agency, "name" | "tagline" | "accentColor" | "houseStyle">;

type Row = Agency & { pageConfig: string; pageIndexable?: number | null };

// Moderação da página pública: agência nova publica, mas fica fora do Google
// (noindex, fora do sitemap) até o admin liberar ou ela ter plano pago.
// A casa é sempre indexável.
addColumnIfMissing("agencies", "pageIndexable", "INTEGER NOT NULL DEFAULT 0");

const DEFAULT_TAGLINE = "sua marca, acelerada por IA";
const DEFAULT_ACCENT = "#f76b15";

function toAgency(row: Row): Agency {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    ownerUserId: row.ownerUserId ?? null,
    billingAccountId: row.billingAccountId || row.id,
    tagline: row.tagline ?? "",
    accentColor: row.accentColor || DEFAULT_ACCENT,
    logoMime: row.logoMime ?? "",
    houseStyle: row.houseStyle ?? "",
    createdAt: row.createdAt,
  };
}

// A casa sempre existe (a migração cria; isto cobre um banco mexido à mão).
export function ensureHouse(): Agency {
  const existing = getAgency(HOUSE_AGENCY_ID);
  if (existing) return existing;
  db.transaction(() => ensureHouseAgency(db)).immediate();
  return getAgency(HOUSE_AGENCY_ID)!;
}

export function getAgency(id: string | null | undefined): Agency | null {
  if (!id) return null;
  const row = db.prepare("SELECT * FROM agencies WHERE id = ?").get(id) as Row | undefined;
  return row ? toAgency(row) : null;
}

export function getAgencyBySlug(slug: string): Agency | null {
  const value = normalizeSlug(slug);
  if (!value) return null;
  const row = db.prepare("SELECT * FROM agencies WHERE slug = ?").get(value) as Row | undefined;
  return row ? toAgency(row) : null;
}

export type AgencyListRow = Agency & { users: number; clients: number; ownerUsername: string | null };

export function listAgencies(): AgencyListRow[] {
  const rows = db
    .prepare(
      `SELECT a.*, u.username AS ownerUsername,
         (SELECT COUNT(*) FROM users x WHERE x.agencyId = a.id AND x.role = 'agency') AS users,
         (SELECT COUNT(*) FROM clients c WHERE c.agencyId = a.id) AS clients
       FROM agencies a LEFT JOIN users u ON u.id = a.ownerUserId
       ORDER BY CASE WHEN a.id = ? THEN 0 ELSE 1 END, a.createdAt ASC`
    )
    .all(HOUSE_AGENCY_ID) as (Row & { ownerUsername: string | null; users: number; clients: number })[];
  return rows.map((r) => ({ ...toAgency(r), ownerUsername: r.ownerUsername ?? null, users: r.users, clients: r.clients }));
}

function slugTaken(slug: string, exceptId?: string): boolean {
  const row = db.prepare("SELECT id FROM agencies WHERE slug = ?").get(slug) as { id: string } | undefined;
  return Boolean(row && row.id !== exceptId);
}

// Agência nova (cadastro público): workspace vazio, página despublicada.
export function createAgency(input: { name: string; ownerUserId: string | null }): Agency {
  const id = randomUUID();
  const name = input.name.trim().slice(0, 80) || "Minha agência";
  const now = new Date().toISOString();
  db.transaction(() => {
    const slug = uniqueSlug(name, (s) => slugTaken(s));
    db.prepare(
      `INSERT INTO agencies (id, name, slug, ownerUserId, billingAccountId, tagline, accentColor, logoMime, houseStyle, pageConfig, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, '', '', '{}', ?)`
    ).run(id, name, slug, input.ownerUserId, id, DEFAULT_TAGLINE, DEFAULT_ACCENT, now);
  }).immediate();
  return getAgency(id)!;
}

export function setAgencyOwner(agencyId: string, userId: string): void {
  db.prepare("UPDATE agencies SET ownerUserId = ? WHERE id = ?").run(userId, agencyId);
}

export function updateAgencyBranding(agencyId: string, input: AgencyBranding): Agency | null {
  const result = db
    .prepare("UPDATE agencies SET name = ?, tagline = ?, accentColor = ?, houseStyle = ? WHERE id = ?")
    .run(input.name.trim().slice(0, 80), input.tagline, input.accentColor, input.houseStyle, agencyId);
  return result.changes > 0 ? getAgency(agencyId) : null;
}

export function setAgencyLogoMime(agencyId: string, mime: string): void {
  db.prepare("UPDATE agencies SET logoMime = ? WHERE id = ?").run(mime, agencyId);
}

// ---------- Página pública (/a/[slug]) ----------

export function getAgencyPageConfig(agencyId: string): AgencyPageConfig {
  const row = db.prepare("SELECT slug, pageConfig FROM agencies WHERE id = ?").get(agencyId) as
    | { slug: string; pageConfig: string }
    | undefined;
  if (!row) return { ...DEFAULT_AGENCY_PAGE };
  let stored: Partial<AgencyPageConfig> = {};
  try {
    stored = JSON.parse(row.pageConfig || "{}") as Partial<AgencyPageConfig>;
  } catch {
    stored = {};
  }
  // O endereço oficial é o slug da agência (único entre agências).
  return sanitizeAgencyPage({ ...DEFAULT_AGENCY_PAGE, ...stored, slug: row.slug });
}

export type SavePageResult = { ok: true; config: AgencyPageConfig } | { ok: false; error: string };

export function saveAgencyPageConfig(agencyId: string, input: Partial<AgencyPageConfig>): SavePageResult {
  const agency = getAgency(agencyId);
  if (!agency) return { ok: false, error: "Agência não encontrada." };
  const current = getAgencyPageConfig(agencyId);
  const next = sanitizeAgencyPage(input, current);
  if (!next.slug) next.slug = agency.slug || normalizeSlug(agency.name) || "agencia";
  if (next.slug !== agency.slug) {
    if (next.slug.length < 3 || RESERVED_SLUGS.has(next.slug)) {
      return { ok: false, error: "Esse endereço não está disponível. Escolha outro." };
    }
    if (slugTaken(next.slug, agencyId)) {
      return { ok: false, error: "Esse endereço já é de outra agência. Escolha outro." };
    }
  }
  try {
    db.prepare("UPDATE agencies SET slug = ?, pageConfig = ? WHERE id = ?").run(next.slug, JSON.stringify(next), agencyId);
  } catch (error) {
    if (error instanceof Error && /UNIQUE/i.test(error.message)) {
      return { ok: false, error: "Esse endereço já é de outra agência. Escolha outro." };
    }
    throw error;
  }
  return { ok: true, config: next };
}

export function agencyPageIndexable(agencyId: string): boolean {
  if (agencyId === HOUSE_AGENCY_ID) return true;
  const row = db.prepare("SELECT pageIndexable FROM agencies WHERE id = ?").get(agencyId) as { pageIndexable: number } | undefined;
  if (!row) return false;
  if (row.pageIndexable === 1) return true;
  // leitura pura (sem recarga/expiração gravadas): serve para GET
  return isPaidPlan(getPlan(viewAccount("agency", agencyId).subscription.planId));
}

// Liberação manual do admin (true) ou volta para a regra padrão (false).
export function setAgencyPageIndexable(agencyId: string, on: boolean): boolean {
  return db.prepare("UPDATE agencies SET pageIndexable = ? WHERE id = ?").run(on ? 1 : 0, agencyId).changes > 0;
}

// Slugs das páginas publicadas que podem ir para o sitemap.
export function listPublishedAgencySlugs(): string[] {
  const rows = db.prepare("SELECT id FROM agencies ORDER BY createdAt ASC").all() as { id: string }[];
  return rows
    .filter((r) => agencyPageIndexable(r.id))
    .map((r) => getAgencyPageConfig(r.id))
    .filter((c) => c.published && c.slug)
    .map((c) => c.slug);
}

// ---------- Exclusão (dono sai e leva o workspace) ----------

// Apaga TODAS as linhas de uma agência (menos a casa). Os lançamentos
// financeiros ficam, anonimizados pelo chamador. Devolve os arquivos a apagar.
export function deleteAgencyWorkspace(agencyId: string): { files: { id: string; mime?: string; ext?: string }[] } {
  if (agencyId === HOUSE_AGENCY_ID) throw new Error("A agência da casa não pode ser apagada.");
  const files: { id: string; mime?: string; ext?: string }[] = [];
  const keep = new Set(["users", "billing_transactions", "mp_payments", "ai_usage", "ai_errors", "agencies"]);
  db.transaction(() => {
    const has = (table: string) => Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name = ?").get(table));
    if (has("deliverables")) files.push(...(db.prepare("SELECT id, mime FROM deliverables WHERE agencyId = ?").all(agencyId) as { id: string; mime: string }[]));
    if (has("client_assets")) files.push(...(db.prepare("SELECT id, ext FROM client_assets WHERE agencyId = ?").all(agencyId) as { id: string; ext: string }[]));
    const agency = getAgency(agencyId);
    if (agency?.logoMime) files.push({ id: `agency-logo-${agencyId}`, mime: agency.logoMime });
    // Profissional com login próprio continua existindo, agora no marketplace aberto.
    if (has("professionals")) {
      db.prepare(
        `UPDATE professionals SET agencyId = NULL WHERE agencyId = ? AND id IN (SELECT refId FROM users WHERE role = 'professional' AND refId IS NOT NULL)`
      ).run(agencyId);
      db.prepare("UPDATE professional_assets SET agencyId = NULL WHERE professionalId IN (SELECT id FROM professionals WHERE agencyId IS NULL)").run();
      // A carteira e o plano do freelancer vão com ele (não caem com a agência).
      for (const table of ["wallets", "subscriptions"]) {
        if (!has(table)) continue;
        db.prepare(
          `UPDATE ${table} SET agencyId = NULL WHERE accountType = 'professional' AND accountId IN (SELECT id FROM professionals WHERE agencyId IS NULL)`
        ).run();
      }
      db.prepare("UPDATE users SET agencyId = NULL WHERE agencyId = ? AND role = 'professional'").run(agencyId);
    }
    // Logins de marca da agência saem junto com as marcas.
    const brandUsers = db
      .prepare("SELECT id FROM users WHERE role = 'client' AND refId IN (SELECT id FROM clients WHERE agencyId = ?)")
      .all(agencyId) as { id: string }[];
    for (const u of brandUsers) db.prepare("DELETE FROM users WHERE id = ?").run(u.id);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[];
    // Filhos primeiro: as tabelas com clientId/projectId caem antes de clients/projects.
    const ordered = tables.map((t) => t.name).sort((a, b) => Number(a === "clients" || a === "projects") - Number(b === "clients" || b === "projects"));
    for (const table of ordered) {
      if (keep.has(table)) continue;
      const cols = (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name);
      if (!cols.includes("agencyId")) continue;
      db.prepare(`DELETE FROM ${table} WHERE agencyId = ?`).run(agencyId);
    }
    if (has("app_settings")) db.prepare("DELETE FROM app_settings WHERE key LIKE ?").run(`%:${agencyId}`);
    db.prepare("DELETE FROM agencies WHERE id = ?").run(agencyId);
  }).immediate();
  return { files };
}

// ---------- Agência nos prompts da IA ----------

// Nome e estilo da casa da agência em nome de quem a IA roda (contexto do
// metering). Sem contexto (admin/sistema) = agência da casa.
export function currentAgencyProfile(): { name: string; houseStyle: string } {
  const agency = getAgency(currentAiContext()?.agencyId ?? HOUSE_AGENCY_ID) ?? getAgency(HOUSE_AGENCY_ID);
  return { name: agency?.name ?? "", houseStyle: agency?.houseStyle ?? "" };
}
