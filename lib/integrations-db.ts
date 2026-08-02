import { randomUUID } from "crypto";
import { db } from "./db";

// Integrações & vendas — propositalmente GENÉRICO para qualquer indústria:
// e-commerce de produto, serviço, SaaS, agência, imobiliária... Nada de tipo
// de produto hardcoded. "Vendas" é receita + unidades/negócios num período,
// com origem livre (marketplace, loja própria, contratos, reservas...).

export type ConnectorPlatform =
  | "ga4" // Google Analytics 4 (tráfego/conversões)
  | "meta_ads" // Meta Marketing (Facebook/Instagram Ads)
  | "google_ads"
  | "tiktok_ads"
  | "sales_api"; // API de vendas/marketplace genérica (webhook/pull)

export type ConnectionStatus = "disconnected" | "connected" | "error";

export type ClientConnection = {
  id: string;
  clientId: string;
  platform: ConnectorPlatform;
  accountId: string; // property id / ad account id / loja id
  accessToken: string; // token de acesso (nunca volta ao cliente)
  // OAuth: com refreshToken + clientId/secret, o sync renova o accessToken
  // automaticamente (resolve o token do GA4/Google que expira em ~1h).
  refreshToken: string;
  oauthClientId: string;
  oauthClientSecret: string;
  status: ConnectionStatus;
  lastSyncAt: string | null;
  lastError: string;
  createdAt: string;
};

// Snapshot de métricas puxadas de uma plataforma para um período.
export type MetricSnapshot = {
  id: string;
  clientId: string;
  platform: ConnectorPlatform;
  periodStart: string;
  periodEnd: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  createdAt: string;
};

// Venda genérica: serve produto (unidades) e serviço (negócios/contratos).
export type SaleEntry = {
  id: string;
  clientId: string;
  source: string; // "Shopify", "Mercado Livre", "contratos", "reservas"...
  kind: "product" | "service";
  periodStart: string;
  periodEnd: string;
  revenue: number;
  units: number; // unidades vendidas OU nº de negócios/serviços fechados
  currency: string;
  note: string;
  createdAt: string;
};

db.exec(`
  CREATE TABLE IF NOT EXISTS client_connections (
    id TEXT PRIMARY KEY,
    clientId TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    accountId TEXT NOT NULL DEFAULT '',
    accessToken TEXT NOT NULL DEFAULT '',
    refreshToken TEXT NOT NULL DEFAULT '',
    oauthClientId TEXT NOT NULL DEFAULT '',
    oauthClientSecret TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'disconnected',
    lastSyncAt TEXT,
    lastError TEXT NOT NULL DEFAULT '',
    createdAt TEXT NOT NULL,
    UNIQUE (clientId, platform)
  );
  CREATE TABLE IF NOT EXISTS metric_snapshots (
    id TEXT PRIMARY KEY,
    clientId TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    periodStart TEXT NOT NULL,
    periodEnd TEXT NOT NULL,
    spend REAL NOT NULL DEFAULT 0,
    impressions REAL NOT NULL DEFAULT 0,
    clicks REAL NOT NULL DEFAULT 0,
    conversions REAL NOT NULL DEFAULT 0,
    revenue REAL NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sales_entries (
    id TEXT PRIMARY KEY,
    clientId TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    source TEXT NOT NULL DEFAULT '',
    kind TEXT NOT NULL DEFAULT 'product',
    periodStart TEXT NOT NULL DEFAULT '',
    periodEnd TEXT NOT NULL DEFAULT '',
    revenue REAL NOT NULL DEFAULT 0,
    units REAL NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'BRL',
    note TEXT NOT NULL DEFAULT '',
    createdAt TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_sales_client ON sales_entries(clientId, periodStart);
`);

// Migração leve para bancos criados antes dos campos OAuth
{
  const cols = (
    db.prepare("PRAGMA table_info(client_connections)").all() as { name: string }[]
  ).map((c) => c.name);
  for (const col of ["refreshToken", "oauthClientId", "oauthClientSecret"]) {
    if (!cols.includes(col)) {
      db.exec(`ALTER TABLE client_connections ADD COLUMN ${col} TEXT NOT NULL DEFAULT ''`);
    }
  }
}

const now = () => new Date().toISOString();

// ---------- Conexões ----------
export function listConnections(clientId: string): ClientConnection[] {
  return db
    .prepare("SELECT * FROM client_connections WHERE clientId = ? ORDER BY platform")
    .all(clientId) as ClientConnection[];
}

export function getConnection(
  clientId: string,
  platform: ConnectorPlatform
): ClientConnection | undefined {
  return db
    .prepare("SELECT * FROM client_connections WHERE clientId = ? AND platform = ?")
    .get(clientId, platform) as ClientConnection | undefined;
}

export function upsertConnection(input: {
  clientId: string;
  platform: ConnectorPlatform;
  accountId: string;
  accessToken: string;
  refreshToken?: string;
  oauthClientId?: string;
  oauthClientSecret?: string;
}): ClientConnection {
  const existing = getConnection(input.clientId, input.platform);
  const token = input.accessToken || existing?.accessToken || "";
  // Campos OAuth: em branco = mantém o valor anterior
  const refreshToken = input.refreshToken || existing?.refreshToken || "";
  const oauthClientId = input.oauthClientId || existing?.oauthClientId || "";
  const oauthClientSecret = input.oauthClientSecret || existing?.oauthClientSecret || "";
  const status: ConnectionStatus = token || refreshToken ? "connected" : "disconnected";
  if (existing) {
    db.prepare(
      `UPDATE client_connections SET accountId = ?, accessToken = ?, refreshToken = ?,
       oauthClientId = ?, oauthClientSecret = ?, status = ?, lastError = '' WHERE id = ?`
    ).run(input.accountId, token, refreshToken, oauthClientId, oauthClientSecret, status, existing.id);
    return {
      ...existing,
      accountId: input.accountId,
      accessToken: token,
      refreshToken,
      oauthClientId,
      oauthClientSecret,
      status,
      lastError: "",
    };
  }
  const conn: ClientConnection = {
    id: randomUUID(),
    clientId: input.clientId,
    platform: input.platform,
    accountId: input.accountId,
    accessToken: token,
    refreshToken,
    oauthClientId,
    oauthClientSecret,
    status,
    lastSyncAt: null,
    lastError: "",
    createdAt: now(),
  };
  db.prepare(
    `INSERT INTO client_connections (id, clientId, platform, accountId, accessToken, refreshToken, oauthClientId, oauthClientSecret, status, lastSyncAt, lastError, createdAt)
     VALUES (@id, @clientId, @platform, @accountId, @accessToken, @refreshToken, @oauthClientId, @oauthClientSecret, @status, @lastSyncAt, @lastError, @createdAt)`
  ).run(conn);
  return conn;
}

// Atualiza só o access token (usado pelo refresh de OAuth no sync).
export function updateAccessToken(id: string, accessToken: string): void {
  db.prepare("UPDATE client_connections SET accessToken = ? WHERE id = ?").run(accessToken, id);
}

export function markSync(
  id: string,
  status: ConnectionStatus,
  error = ""
): void {
  db.prepare(
    "UPDATE client_connections SET status = ?, lastError = ?, lastSyncAt = ? WHERE id = ?"
  ).run(status, error, now(), id);
}

export function deleteConnection(clientId: string, platform: ConnectorPlatform): void {
  db.prepare("DELETE FROM client_connections WHERE clientId = ? AND platform = ?").run(
    clientId,
    platform
  );
}

// ---------- Snapshots de métricas ----------
export function saveSnapshot(input: Omit<MetricSnapshot, "id" | "createdAt">): MetricSnapshot {
  const snap: MetricSnapshot = { ...input, id: randomUUID(), createdAt: now() };
  db.prepare(
    `INSERT INTO metric_snapshots (id, clientId, platform, periodStart, periodEnd, spend, impressions, clicks, conversions, revenue, createdAt)
     VALUES (@id, @clientId, @platform, @periodStart, @periodEnd, @spend, @impressions, @clicks, @conversions, @revenue, @createdAt)`
  ).run(snap);
  return snap;
}

export function latestSnapshots(clientId: string): MetricSnapshot[] {
  return db
    .prepare(
      `SELECT * FROM metric_snapshots WHERE clientId = ?
       AND id IN (SELECT id FROM metric_snapshots ms WHERE ms.clientId = ? GROUP BY platform HAVING MAX(createdAt))
       ORDER BY platform`
    )
    .all(clientId, clientId) as MetricSnapshot[];
}

// ---------- Vendas (genérico) ----------
export function listSales(clientId: string): SaleEntry[] {
  return db
    .prepare("SELECT * FROM sales_entries WHERE clientId = ? ORDER BY periodStart DESC, createdAt DESC")
    .all(clientId) as SaleEntry[];
}

export function createSale(input: Omit<SaleEntry, "id" | "createdAt">): SaleEntry {
  const sale: SaleEntry = { ...input, id: randomUUID(), createdAt: now() };
  db.prepare(
    `INSERT INTO sales_entries (id, clientId, source, kind, periodStart, periodEnd, revenue, units, currency, note, createdAt)
     VALUES (@id, @clientId, @source, @kind, @periodStart, @periodEnd, @revenue, @units, @currency, @note, @createdAt)`
  ).run(sale);
  return sale;
}

export function deleteSale(id: string): void {
  db.prepare("DELETE FROM sales_entries WHERE id = ?").run(id);
}

export type SalesTotals = {
  revenue: number;
  units: number;
  entries: number;
  currency: string;
  byKind: { product: number; service: number };
};

export function salesTotals(clientId: string): SalesTotals {
  const rows = listSales(clientId);
  const totals: SalesTotals = {
    revenue: 0,
    units: 0,
    entries: rows.length,
    currency: rows[0]?.currency || "BRL",
    byKind: { product: 0, service: 0 },
  };
  for (const row of rows) {
    totals.revenue += row.revenue;
    totals.units += row.units;
    totals.byKind[row.kind] += row.revenue;
  }
  return totals;
}

// Total de vendas agregado da carteira inteira — para os Insights da agência.
export function agencySalesTotal(): { revenue: number; clientsWithSales: number } {
  const row = db
    .prepare(
      "SELECT COALESCE(SUM(revenue),0) as revenue, COUNT(DISTINCT clientId) as clients FROM sales_entries"
    )
    .get() as { revenue: number; clients: number };
  return { revenue: row.revenue, clientsWithSales: row.clients };
}
