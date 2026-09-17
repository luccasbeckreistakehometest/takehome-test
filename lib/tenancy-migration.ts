import type Database from "better-sqlite3";
import { randomUUID } from "crypto";
import { addColumn, createIndex, hasColumn, tableExists } from "./sqlite-migrate";
import { HOUSE_AGENCY_ID, TENANT_TABLES, slugBase, uniqueSlug } from "./tenancy-rules";

// Migração para multi-tenant (uma vez por banco, marcada em
// schema_migrations). Roda na abertura do banco (lib/db.ts), antes de qualquer
// consulta, dentro de BEGIN IMMEDIATE: workers paralelos do `next build`
// esperam o primeiro terminar e depois só leem a marca.
//
// O que faz:
//  1. cria `agencies` e a agência da casa (id "agency") com o nome/whitelabel
//     e a página pública que estavam nas configurações globais;
//  2. adiciona `agencyId` em toda tabela da agência que já existe e atribui
//     TODAS as linhas antigas à casa (com as exceções abaixo);
//  3. dono da casa = usuário `agencia` (ou a primeira conta de agência);
//  4. toda outra conta de agência que se auto-cadastrou no workspace
//     compartilhado ganha a PRÓPRIA agência, vazia. O que ela possa ter criado
//     no workspace da casa fica na casa (não dá para separar com segurança) e
//     entra no relatório gravado em schema_migrations.detail;
//  5. profissional auto-cadastrado (login com brandSource=platform) vira
//     freelancer do marketplace aberto (agencyId NULL); os demais são da casa;
//  6. `channel_connections` passa a ter chave (agencyId, channel).
//
// Tabelas criadas DEPOIS (banco novo) ganham a coluna pelo próprio módulo
// (tenantColumn em lib/db.ts) e nascem vazias — não há o que preencher.

export const TENANCY_MIGRATION_ID = "tenancy-v1";

type Db = Database.Database;

export type SeparatedAgency = {
  userId: string;
  username: string;
  agencyId: string;
  slug: string;
  // linhas que citam o usuário (prova de que ele mexeu no workspace da casa)
  evidence: Record<string, number>;
};

export type TenancyMigrationReport = {
  applied: boolean;
  houseOwner: string | null;
  separated: SeparatedAgency[];
  tables: Record<string, number>; // linhas atribuídas por tabela
};

export function ensureAgencySchema(db: Db): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS agencies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      ownerUserId TEXT,
      billingAccountId TEXT NOT NULL,
      tagline TEXT NOT NULL DEFAULT '',
      accentColor TEXT NOT NULL DEFAULT '#f76b15',
      logoMime TEXT NOT NULL DEFAULT '',
      houseStyle TEXT NOT NULL DEFAULT '',
      pageConfig TEXT NOT NULL DEFAULT '{}',
      createdAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      appliedAt TEXT NOT NULL,
      detail TEXT NOT NULL DEFAULT ''
    );
  `);
}

const CONNECTIONS_SQL = `
  CREATE TABLE IF NOT EXISTS channel_connections (
    agencyId TEXT NOT NULL,
    channel TEXT NOT NULL,
    mode TEXT NOT NULL,
    apiToken TEXT NOT NULL DEFAULT '',
    apiAccountId TEXT NOT NULL DEFAULT '',
    sessionReady INTEGER NOT NULL DEFAULT 0,
    updatedAt TEXT NOT NULL,
    PRIMARY KEY (agencyId, channel)
  );`;

export const CHANNEL_CONNECTIONS_SCHEMA = CONNECTIONS_SQL;

// Chave antiga (só channel) → (agencyId, channel). Idempotente pelo formato.
function rebuildChannelConnections(db: Db): void {
  if (!tableExists(db, "channel_connections")) return;
  if (hasColumn(db, "channel_connections", "agencyId")) return;
  db.exec(`
    ALTER TABLE channel_connections RENAME TO channel_connections_legacy;
    ${CONNECTIONS_SQL}
    INSERT INTO channel_connections (agencyId, channel, mode, apiToken, apiAccountId, sessionReady, updatedAt)
      SELECT '${HOUSE_AGENCY_ID}', channel, mode, apiToken, apiAccountId, sessionReady, updatedAt FROM channel_connections_legacy;
    DROP TABLE channel_connections_legacy;
  `);
}

function readJson<T>(value: string | undefined | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

type LegacySettings = { agencyName?: string; tagline?: string; accentColor?: string; logoMime?: string; houseStyle?: string };

function legacyBranding(db: Db): LegacySettings {
  if (!tableExists(db, "settings")) return {};
  return (db.prepare("SELECT * FROM settings WHERE id = 1").get() as LegacySettings | undefined) ?? {};
}

function legacyPage(db: Db): { raw: string; slug: string } {
  if (!tableExists(db, "app_settings")) return { raw: "{}", slug: "" };
  const row = db.prepare("SELECT value FROM app_settings WHERE key = 'agency_page'").get() as { value: string } | undefined;
  const parsed = readJson<{ slug?: string }>(row?.value);
  return { raw: row?.value && parsed ? row.value : "{}", slug: typeof parsed?.slug === "string" ? parsed.slug : "" };
}

function slugTaken(db: Db, slug: string): boolean {
  return Boolean(db.prepare("SELECT 1 FROM agencies WHERE slug = ?").get(slug));
}

// Cria a casa se faltar (banco novo ou antigo). Nunca sobrescreve.
export function ensureHouseAgency(db: Db, now = new Date().toISOString()): void {
  ensureAgencySchema(db);
  if (db.prepare("SELECT 1 FROM agencies WHERE id = ?").get(HOUSE_AGENCY_ID)) return;
  const brand = legacyBranding(db);
  const page = legacyPage(db);
  const name = (brand.agencyName ?? "").trim() || "Marqa";
  const wanted = slugBase(page.slug) || slugBase(name) || "agencia";
  const slug = slugTaken(db, wanted) ? uniqueSlug(wanted, (s) => slugTaken(db, s)) : wanted;
  db.prepare(
    `INSERT OR IGNORE INTO agencies (id, name, slug, ownerUserId, billingAccountId, tagline, accentColor, logoMime, houseStyle, pageConfig, createdAt)
     VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    HOUSE_AGENCY_ID,
    name,
    slug,
    HOUSE_AGENCY_ID,
    brand.tagline ?? "sua marca, acelerada por IA",
    brand.accentColor || "#f76b15",
    brand.logoMime ?? "",
    brand.houseStyle ?? "",
    page.raw,
    now
  );
}

type UserRow = { id: string; username: string; role: string; refId: string | null; brandSource: string | null; name: string; createdAt: string };

function acceptedAgencyInvite(db: Db, userId: string): boolean {
  if (!tableExists(db, "invites")) return false;
  return Boolean(db.prepare("SELECT 1 FROM invites WHERE role = 'agency' AND usedByRefId = ?").get(userId));
}

// Linhas que citam o usuário em tabelas com userId (menos as de conta/acesso).
function evidenceFor(db: Db, userId: string): Record<string, number> {
  const out: Record<string, number> = {};
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[];
  for (const { name } of tables) {
    if (["users", "auth_events", "onboarding", "contact_messages"].includes(name)) continue;
    if (!hasColumn(db, name, "userId")) continue;
    const c = (db.prepare(`SELECT COUNT(*) AS c FROM ${name} WHERE userId = ?`).get(userId) as { c: number }).c;
    if (c > 0) out[name] = c;
  }
  if (tableExists(db, "ai_usage") && hasColumn(db, "ai_usage", "userId")) {
    const actions = db
      .prepare("SELECT action, COUNT(*) AS c FROM ai_usage WHERE userId = ? GROUP BY action")
      .all(userId) as { action: string; c: number }[];
    for (const a of actions) out[`ai_usage.${a.action || "?"}`] = a.c;
  }
  return out;
}

function fill(db: Db, table: string, sql: string, ...params: unknown[]): number {
  if (!tableExists(db, table)) return 0;
  return db.prepare(sql).run(...params).changes;
}

function newAgencyFor(db: Db, user: UserRow, now: string): { id: string; slug: string } {
  const id = randomUUID();
  const slug = uniqueSlug(user.name || user.username, (s) => slugTaken(db, s));
  db.prepare(
    `INSERT INTO agencies (id, name, slug, ownerUserId, billingAccountId, tagline, accentColor, logoMime, houseStyle, pageConfig, createdAt)
     VALUES (?, ?, ?, ?, ?, '', '#f76b15', '', '', '{}', ?)`
  ).run(id, (user.name || user.username).slice(0, 80), slug, user.id, id, now);
  return { id, slug };
}

function applyTenancy(db: Db, now: string): TenancyMigrationReport {
  const report: TenancyMigrationReport = { applied: true, houseOwner: null, separated: [], tables: {} };
  ensureHouseAgency(db, now);
  rebuildChannelConnections(db);
  for (const table of Object.keys(TENANT_TABLES)) addColumn(db, table, "agencyId", "TEXT");

  // ---- Contas de agência: dono da casa, time da casa, agências separadas ----
  const users = tableExists(db, "users")
    ? (db.prepare("SELECT id, username, role, refId, brandSource, name, createdAt FROM users ORDER BY createdAt ASC").all() as UserRow[])
    : [];
  const agencyUsers = users.filter((u) => u.role === "agency");
  const owner = agencyUsers.find((u) => u.username === "agencia") ?? agencyUsers[0] ?? null;
  if (owner) {
    db.prepare("UPDATE agencies SET ownerUserId = COALESCE(ownerUserId, ?) WHERE id = ?").run(owner.id, HOUSE_AGENCY_ID);
    report.houseOwner = owner.username;
  }
  for (const user of agencyUsers) {
    const selfRegistered = user.brandSource === "platform" && !acceptedAgencyInvite(db, user.id);
    if (user.id === owner?.id || !selfRegistered) {
      db.prepare("UPDATE users SET agencyId = ? WHERE id = ?").run(HOUSE_AGENCY_ID, user.id);
      continue;
    }
    const agency = newAgencyFor(db, user, now);
    db.prepare("UPDATE users SET agencyId = ? WHERE id = ?").run(agency.id, user.id);
    report.separated.push({ userId: user.id, username: user.username, agencyId: agency.id, slug: agency.slug, evidence: evidenceFor(db, user.id) });
  }

  // ---- Profissionais: auto-cadastrado = marketplace aberto; resto = casa ----
  report.tables.professionals = fill(
    db,
    "professionals",
    `UPDATE professionals SET agencyId = CASE WHEN EXISTS (
       SELECT 1 FROM users u WHERE u.refId = professionals.id AND u.role = 'professional' AND u.brandSource = 'platform'
     ) THEN NULL ELSE ? END WHERE agencyId IS NULL`,
    HOUSE_AGENCY_ID
  );
  report.tables.professional_assets = fill(
    db,
    "professional_assets",
    `UPDATE professional_assets SET agencyId = (SELECT p.agencyId FROM professionals p WHERE p.id = professional_assets.professionalId) WHERE agencyId IS NULL`
  );

  // ---- Tabelas simples: tudo da casa ----
  for (const [table, rule] of Object.entries(TENANT_TABLES)) {
    if (rule !== "house") continue;
    report.tables[table] = fill(db, table, `UPDATE ${table} SET agencyId = ? WHERE agencyId IS NULL`, HOUSE_AGENCY_ID);
  }
  report.tables.applications = fill(
    db,
    "applications",
    `UPDATE applications SET agencyId = COALESCE((SELECT p.agencyId FROM projects p WHERE p.id = applications.projectId), ?) WHERE agencyId IS NULL`,
    HOUSE_AGENCY_ID
  );
  report.tables.idea_batches = fill(
    db,
    "idea_batches",
    `UPDATE idea_batches SET agencyId = CASE
       WHEN audience = 'professional' THEN (SELECT p.agencyId FROM professionals p WHERE p.id = idea_batches.targetId)
       ELSE ? END WHERE agencyId IS NULL`,
    HOUSE_AGENCY_ID
  );

  // ---- Usuários restantes: marca → agência da marca; profissional → do perfil ----
  report.tables.users = fill(
    db,
    "users",
    `UPDATE users SET agencyId = CASE
       WHEN role = 'client' THEN COALESCE((SELECT c.agencyId FROM clients c WHERE c.id = users.refId), ?)
       WHEN role = 'professional' THEN (SELECT p.agencyId FROM professionals p WHERE p.id = users.refId)
       ELSE NULL END
     WHERE agencyId IS NULL AND role IN ('client', 'professional')`,
    HOUSE_AGENCY_ID
  );
  for (const table of ["onboarding", "voice_briefings"]) {
    report.tables[table] = fill(
      db,
      table,
      `UPDATE ${table} SET agencyId = (SELECT u.agencyId FROM users u WHERE u.id = ${table}.userId) WHERE agencyId IS NULL`
    );
  }

  // ---- Billing: agência da conta ----
  const accountAgency = `CASE
      WHEN accountType = 'agency' THEN accountId
      WHEN accountType = 'client' THEN COALESCE((SELECT c.agencyId FROM clients c WHERE c.id = T.accountId), '${HOUSE_AGENCY_ID}')
      WHEN accountType = 'professional' THEN (SELECT p.agencyId FROM professionals p WHERE p.id = T.accountId)
      ELSE NULL END`;
  for (const table of ["wallets", "subscriptions", "billing_transactions", "mp_payments", "ai_usage", "ai_errors"]) {
    if (!tableExists(db, table) || !hasColumn(db, table, "accountType")) continue;
    report.tables[table] = fill(
      db,
      table,
      `UPDATE ${table} AS T SET agencyId = ${accountAgency} WHERE agencyId IS NULL`
    );
  }
  return report;
}

// Índices de agencyId (idempotente; roda sempre, é barato).
function ensureTenantIndexes(db: Db): void {
  for (const table of Object.keys(TENANT_TABLES)) {
    if (!tableExists(db, table) || !hasColumn(db, table, "agencyId")) continue;
    createIndex(db, `CREATE INDEX IF NOT EXISTS idx_${table}_agency ON ${table}(agencyId)`);
  }
}

export function migrateTenancy(db: Db, now: Date = new Date()): TenancyMigrationReport {
  const at = now.toISOString();
  const report = db
    .transaction((): TenancyMigrationReport => {
      ensureAgencySchema(db);
      const done = db.prepare("SELECT 1 FROM schema_migrations WHERE id = ?").get(TENANCY_MIGRATION_ID);
      if (done) {
        // Banco já migrado: só garante a casa (ex.: apagada à mão) e o formato das conexões.
        ensureHouseAgency(db, at);
        rebuildChannelConnections(db);
        return { applied: false, houseOwner: null, separated: [], tables: {} };
      }
      const applied = applyTenancy(db, at);
      db.prepare("INSERT INTO schema_migrations (id, appliedAt, detail) VALUES (?, ?, ?)").run(
        TENANCY_MIGRATION_ID,
        at,
        JSON.stringify({ houseOwner: applied.houseOwner, separated: applied.separated, tables: applied.tables })
      );
      return applied;
    })
    .immediate();
  ensureTenantIndexes(db);
  if (report.applied && report.separated.length > 0) {
    console.log(
      `[tenancy] agências separadas do workspace da casa: ${report.separated
        .map((s) => `${s.username} → ${s.slug} (${Object.keys(s.evidence).length ? JSON.stringify(s.evidence) : "sem dados próprios"})`)
        .join("; ")}`
    );
  }
  return report;
}
