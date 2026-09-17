import { randomBytes, randomUUID } from "crypto";
import { db, getClient, tenantColumn } from "./db";
import { getScheduledPost } from "./marketplace-db";
import {
  CODE_RE,
  newCode,
  normalizeBioSlug,
  RESERVED_BIO_SLUGS,
  sanitizeButtons,
  utmFor,
  type BioButton,
  type Utm,
} from "./links-rules";

// Links curtos com UTM automático (/l/código) e a página "link na bio" de cada
// cliente (/b/slug). Só destinos guardados redirecionam: nada de redirect aberto.

export type ShortLink = {
  code: string;
  agencyId: string;
  clientId: string;
  postId: string | null;
  destUrl: string;
  utm: Utm;
  label: string;
  createdAt: string;
  archivedAt: string | null;
};

export type BioPage = {
  clientId: string;
  slug: string;
  title: string;
  bio: string;
  buttons: BioButton[];
  published: boolean;
  indexable: boolean;
  updatedAt: string;
};

db.exec(`
  CREATE TABLE IF NOT EXISTS short_links (
    code TEXT PRIMARY KEY,
    clientId TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    postId TEXT,
    destUrl TEXT NOT NULL,
    utmJson TEXT NOT NULL DEFAULT '{}',
    label TEXT NOT NULL DEFAULT '',
    createdAt TEXT NOT NULL,
    archivedAt TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_short_links_client ON short_links(clientId, createdAt);
  CREATE INDEX IF NOT EXISTS idx_short_links_post ON short_links(postId);
  CREATE TABLE IF NOT EXISTS link_clicks (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    clientId TEXT NOT NULL,
    ts TEXT NOT NULL,
    visitorHash TEXT NOT NULL DEFAULT '',
    device TEXT NOT NULL DEFAULT '',
    referrerHost TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS idx_link_clicks_code ON link_clicks(code, ts);
  CREATE INDEX IF NOT EXISTS idx_link_clicks_client ON link_clicks(clientId, ts);
  CREATE TABLE IF NOT EXISTS bio_pages (
    clientId TEXT PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL DEFAULT '',
    bio TEXT NOT NULL DEFAULT '',
    buttonsJson TEXT NOT NULL DEFAULT '[]',
    published INTEGER NOT NULL DEFAULT 0,
    indexable INTEGER NOT NULL DEFAULT 0,
    updatedAt TEXT NOT NULL
  );
`);
tenantColumn("short_links");
tenantColumn("link_clicks");
tenantColumn("bio_pages");

type LinkRow = Omit<ShortLink, "utm" | "agencyId"> & { utmJson: string; agencyId: string | null };
const toLink = (row: LinkRow): ShortLink => {
  let utm: Utm = {};
  try {
    utm = JSON.parse(row.utmJson);
  } catch {
    utm = {};
  }
  const { utmJson: _u, ...rest } = row;
  void _u;
  return { ...rest, agencyId: row.agencyId ?? "", utm };
};

export function getLink(code: string): ShortLink | null {
  if (!CODE_RE.test(code)) return null;
  const row = db.prepare("SELECT * FROM short_links WHERE code = ?").get(code) as LinkRow | undefined;
  return row ? toLink(row) : null;
}

export function linkForPost(postId: string): ShortLink | null {
  const row = db.prepare("SELECT * FROM short_links WHERE postId = ? AND archivedAt IS NULL ORDER BY createdAt DESC LIMIT 1").get(postId) as LinkRow | undefined;
  return row ? toLink(row) : null;
}

// Cria (ou reaproveita, para o mesmo post e destino) um link rastreável.
export function createLink(input: { clientId: string; destUrl: string; label?: string; postId?: string | null; channel?: string | null; campaign?: string | null }): ShortLink {
  if (input.postId) {
    const existing = linkForPost(input.postId);
    if (existing && existing.destUrl === input.destUrl) return existing;
  }
  const post = input.postId ? getScheduledPost(input.postId) : null;
  const utm = utmFor({
    channel: input.channel ?? post?.channel ?? null,
    campaign: input.campaign ?? post?.campaignId ?? null,
    postId: input.postId ?? null,
    month: new Date().toISOString().slice(0, 7),
  });
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newCode((n) => randomBytes(n));
    const inserted = db
      .prepare(
        `INSERT OR IGNORE INTO short_links (code, agencyId, clientId, postId, destUrl, utmJson, label, createdAt)
         VALUES (?, (SELECT agencyId FROM clients WHERE id = ?), ?, ?, ?, ?, ?, ?)`
      )
      .run(code, input.clientId, input.clientId, input.postId ?? null, input.destUrl, JSON.stringify(utm), (input.label ?? "").slice(0, 80), new Date().toISOString());
    if (inserted.changes > 0) return getLink(code)!;
  }
  throw new Error("Não foi possível criar o link");
}

export function updateLink(code: string, patch: { label?: string; archived?: boolean }): ShortLink | null {
  const link = getLink(code);
  if (!link) return null;
  db.prepare("UPDATE short_links SET label = ?, archivedAt = ? WHERE code = ?").run(
    patch.label === undefined ? link.label : patch.label.slice(0, 80),
    patch.archived === undefined ? link.archivedAt : patch.archived ? new Date().toISOString() : null,
    code
  );
  return getLink(code);
}

export function recordClick(link: ShortLink, input: { visitorHash: string; device: string; referrerHost: string }): void {
  db.prepare(
    "INSERT INTO link_clicks (id, agencyId, code, clientId, ts, visitorHash, device, referrerHost) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(randomUUID(), link.agencyId || null, link.code, link.clientId, new Date().toISOString(), input.visitorHash, input.device, input.referrerHost);
}

export type LinkWithStats = ShortLink & { clicks: number; clicks30: number; uniques30: number };

export function listLinks(clientId: string, opts: { includeArchived?: boolean; postId?: string } = {}): LinkWithStats[] {
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const rows = db
    .prepare(
      `SELECT l.*,
         (SELECT COUNT(*) FROM link_clicks c WHERE c.code = l.code) AS clicks,
         (SELECT COUNT(*) FROM link_clicks c WHERE c.code = l.code AND c.ts >= ?) AS clicks30,
         (SELECT COUNT(DISTINCT visitorHash) FROM link_clicks c WHERE c.code = l.code AND c.ts >= ?) AS uniques30
       FROM short_links l WHERE l.clientId = ? ${opts.includeArchived ? "" : "AND l.archivedAt IS NULL"} ${opts.postId ? "AND l.postId = ?" : ""}
       ORDER BY l.createdAt DESC LIMIT 200`
    )
    .all(since, since, clientId, ...(opts.postId ? [opts.postId] : [])) as (LinkRow & { clicks: number; clicks30: number; uniques30: number })[];
  return rows.map((row) => ({ ...toLink(row), clicks: row.clicks, clicks30: row.clicks30, uniques30: row.uniques30 }));
}

export function clicksByPost(clientId: string): Map<string, number> {
  const rows = db
    .prepare(
      `SELECT l.postId AS postId, COUNT(c.id) AS clicks FROM short_links l LEFT JOIN link_clicks c ON c.code = l.code
       WHERE l.clientId = ? AND l.postId IS NOT NULL GROUP BY l.postId`
    )
    .all(clientId) as { postId: string; clicks: number }[];
  return new Map(rows.map((r) => [r.postId, r.clicks]));
}

export function clientClicks(clientId: string, days = 30): { total: number; uniques: number; top: { code: string; label: string; clicks: number }[] } {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const totals = db
    .prepare("SELECT COUNT(*) AS total, COUNT(DISTINCT visitorHash) AS uniques FROM link_clicks WHERE clientId = ? AND ts >= ?")
    .get(clientId, since) as { total: number; uniques: number };
  const top = db
    .prepare(
      `SELECT c.code AS code, COALESCE(NULLIF(l.label, ''), l.destUrl) AS label, COUNT(*) AS clicks FROM link_clicks c
       JOIN short_links l ON l.code = c.code WHERE c.clientId = ? AND c.ts >= ? GROUP BY c.code ORDER BY clicks DESC LIMIT 5`
    )
    .all(clientId, since) as { code: string; label: string; clicks: number }[];
  return { ...totals, top };
}

// Cliques de um mês (relatório mensal): os links mais clicados.
export function monthTopLinks(clientId: string, month: string): { label: string; clicks: number }[] {
  return db
    .prepare(
      `SELECT COALESCE(NULLIF(l.label, ''), l.destUrl) AS label, COUNT(*) AS clicks FROM link_clicks c
       JOIN short_links l ON l.code = c.code WHERE c.clientId = ? AND substr(c.ts, 1, 7) = ? GROUP BY c.code ORDER BY clicks DESC LIMIT 5`
    )
    .all(clientId, month) as { label: string; clicks: number }[];
}

// ---------- Link na bio ----------
type BioRow = Omit<BioPage, "buttons" | "published" | "indexable"> & { buttonsJson: string; published: number; indexable: number };
const toBio = (row: BioRow): BioPage => {
  let buttons: BioButton[] = [];
  try {
    buttons = JSON.parse(row.buttonsJson);
  } catch {
    buttons = [];
  }
  return { clientId: row.clientId, slug: row.slug, title: row.title, bio: row.bio, buttons, published: row.published === 1, indexable: row.indexable === 1, updatedAt: row.updatedAt };
};

export function getBio(clientId: string): BioPage | null {
  const row = db.prepare("SELECT * FROM bio_pages WHERE clientId = ?").get(clientId) as BioRow | undefined;
  return row ? toBio(row) : null;
}

export function getBioBySlug(slug: string): BioPage | null {
  const value = normalizeBioSlug(slug);
  if (!value) return null;
  const row = db.prepare("SELECT * FROM bio_pages WHERE slug = ?").get(value) as BioRow | undefined;
  return row ? toBio(row) : null;
}

export function suggestBioSlug(clientId: string): string {
  const client = getClient(clientId);
  const base = normalizeBioSlug(client?.name ?? "") || "marca";
  let candidate = base;
  for (let i = 2; i < 200; i++) {
    const taken = db.prepare("SELECT clientId FROM bio_pages WHERE slug = ?").get(candidate) as { clientId: string } | undefined;
    if ((!taken || taken.clientId === clientId) && !RESERVED_BIO_SLUGS.has(candidate)) return candidate;
    candidate = `${base}-${i}`;
  }
  return `${base}-${randomBytes(3).toString("hex")}`;
}

export function saveBio(
  clientId: string,
  input: { slug?: string; title?: string; bio?: string; buttons?: unknown; published?: boolean; indexable?: boolean }
): { ok: true; bio: BioPage } | { ok: false; error: string } {
  const current = getBio(clientId);
  const slug = normalizeBioSlug(input.slug ?? current?.slug ?? suggestBioSlug(clientId));
  if (!slug || slug.length < 3) return { ok: false, error: "Escolha um endereço com pelo menos 3 letras." };
  if (RESERVED_BIO_SLUGS.has(slug)) return { ok: false, error: "Este endereço é reservado. Escolha outro." };
  const taken = db.prepare("SELECT clientId FROM bio_pages WHERE slug = ?").get(slug) as { clientId: string } | undefined;
  if (taken && taken.clientId !== clientId) return { ok: false, error: "Este endereço já está em uso. Escolha outro." };
  const known = new Set(listLinks(clientId).map((l) => l.code));
  const buttons = input.buttons === undefined ? (current?.buttons ?? []) : sanitizeButtons(input.buttons, known);
  db.prepare(
    `INSERT INTO bio_pages (clientId, agencyId, slug, title, bio, buttonsJson, published, indexable, updatedAt)
     VALUES (@clientId, (SELECT agencyId FROM clients WHERE id = @clientId), @slug, @title, @bio, @buttons, @published, @indexable, @at)
     ON CONFLICT(clientId) DO UPDATE SET slug = @slug, title = @title, bio = @bio, buttonsJson = @buttons,
       published = @published, indexable = @indexable, updatedAt = @at`
  ).run({
    clientId,
    slug,
    title: (input.title ?? current?.title ?? getClient(clientId)?.name ?? "").trim().slice(0, 80),
    bio: (input.bio ?? current?.bio ?? "").trim().slice(0, 280),
    buttons: JSON.stringify(buttons),
    published: (input.published ?? current?.published ?? false) ? 1 : 0,
    indexable: (input.indexable ?? current?.indexable ?? false) ? 1 : 0,
    at: new Date().toISOString(),
  });
  return { ok: true, bio: getBio(clientId)! };
}

// Posts publicados mais recentes do cliente com imagem e link (grade da bio).
export function bioGrid(clientId: string, limit = 9): { postId: string; title: string; imageId: string | null; code: string | null }[] {
  const rows = db
    .prepare(
      `SELECT p.id, p.title, p.deliverableId, (SELECT code FROM short_links l WHERE l.postId = p.id AND l.archivedAt IS NULL ORDER BY l.createdAt DESC LIMIT 1) AS code
       FROM scheduled_posts p WHERE p.clientId = ? AND p.status = 'published' ORDER BY COALESCE(p.publishedAt, p.scheduledFor) DESC LIMIT ?`
    )
    .all(clientId, limit * 3) as { id: string; title: string; deliverableId: string | null; code: string | null }[];
  return rows
    .filter((r) => r.deliverableId || r.code)
    .slice(0, limit)
    .map((r) => ({ postId: r.id, title: r.title, imageId: r.deliverableId, code: r.code }));
}

// Visão da agência: clientes com links/bio e cliques em 30 dias.
export function agencyLinksOverview(agencyId: string | null): { clientId: string; clientName: string; links: number; clicks30: number; bioSlug: string | null; bioPublished: boolean }[] {
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const where = agencyId ? "WHERE c.agencyId = ?" : "";
  return (
    db
      .prepare(
        `SELECT c.id AS clientId, c.name AS clientName,
           (SELECT COUNT(*) FROM short_links l WHERE l.clientId = c.id AND l.archivedAt IS NULL) AS links,
           (SELECT COUNT(*) FROM link_clicks k WHERE k.clientId = c.id AND k.ts >= ?) AS clicks30,
           b.slug AS bioSlug, COALESCE(b.published, 0) AS bioPublished
         FROM clients c LEFT JOIN bio_pages b ON b.clientId = c.id ${where}
         ORDER BY clicks30 DESC, c.name ASC LIMIT 200`
      )
      .all(since, ...(agencyId ? [agencyId] : [])) as { clientId: string; clientName: string; links: number; clicks30: number; bioSlug: string | null; bioPublished: number }[]
  ).map((r) => ({ ...r, bioPublished: r.bioPublished === 1 }));
}
