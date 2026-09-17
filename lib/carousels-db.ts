import { randomUUID } from "crypto";
import { db, getClient, listGenerations, tenantColumn } from "./db";
import { listClientAssets } from "./marketplace-db";
import { getAgency } from "./agencies";
import {
  CAROUSEL_TEMPLATES,
  pickPalette,
  sanitizeContent,
  type CarouselContent,
  type CarouselTemplate,
  type Palette,
} from "./carousel-rules";

// Carrosséis por cliente: roteiro (slides) + modelo visual. As imagens são
// renderizadas sob demanda e guardadas em disco por hash (lib/carousel-render).

export type Carousel = {
  id: string;
  agencyId: string;
  clientId: string;
  postId: string | null;
  topic: string;
  goal: string;
  template: CarouselTemplate;
  content: CarouselContent;
  source: "ai" | "manual" | "demo";
  createdAt: string;
  updatedAt: string;
};

db.exec(`
  CREATE TABLE IF NOT EXISTS carousels (
    id TEXT PRIMARY KEY,
    clientId TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    postId TEXT,
    topic TEXT NOT NULL DEFAULT '',
    goal TEXT NOT NULL DEFAULT '',
    template TEXT NOT NULL DEFAULT 'editorial',
    contentJson TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'manual',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_carousels_client ON carousels(clientId, createdAt);
`);
tenantColumn("carousels");

type Row = Omit<Carousel, "content" | "template" | "agencyId" | "source"> & { contentJson: string; template: string; agencyId: string | null; source: string };

const toCarousel = (row: Row): Carousel => {
  let content: CarouselContent;
  try {
    content = sanitizeContent(JSON.parse(row.contentJson));
  } catch {
    content = sanitizeContent({});
  }
  const { contentJson: _c, ...rest } = row;
  void _c;
  return {
    ...rest,
    agencyId: row.agencyId ?? "",
    template: (CAROUSEL_TEMPLATES as readonly string[]).includes(row.template) ? (row.template as CarouselTemplate) : "editorial",
    source: row.source === "ai" || row.source === "demo" ? row.source : "manual",
    content,
  };
};

const nowIso = () => new Date().toISOString();

export function createCarousel(input: {
  clientId: string;
  postId?: string | null;
  topic: string;
  goal: string;
  template: CarouselTemplate;
  content: CarouselContent;
  source: Carousel["source"];
}): Carousel {
  const id = randomUUID();
  const at = nowIso();
  db.prepare(
    `INSERT INTO carousels (id, agencyId, clientId, postId, topic, goal, template, contentJson, source, createdAt, updatedAt)
     VALUES (?, (SELECT agencyId FROM clients WHERE id = ?), ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, input.clientId, input.clientId, input.postId ?? null, input.topic.slice(0, 300), input.goal.slice(0, 300), input.template, JSON.stringify(sanitizeContent(input.content)), input.source, at, at);
  return getCarousel(id)!;
}

export function getCarousel(id: string): Carousel | null {
  const row = db.prepare("SELECT * FROM carousels WHERE id = ?").get(id) as Row | undefined;
  return row ? toCarousel(row) : null;
}

export function listCarousels(clientId: string, limit = 30): Carousel[] {
  return (db.prepare("SELECT * FROM carousels WHERE clientId = ? ORDER BY createdAt DESC LIMIT ?").all(clientId, limit) as Row[]).map(toCarousel);
}

export function updateCarousel(id: string, patch: { template?: CarouselTemplate; content?: CarouselContent; postId?: string | null }): Carousel | null {
  const current = getCarousel(id);
  if (!current) return null;
  const next = {
    template: patch.template ?? current.template,
    content: patch.content ? sanitizeContent(patch.content) : current.content,
    postId: patch.postId === undefined ? current.postId : patch.postId,
  };
  db.prepare("UPDATE carousels SET template = ?, contentJson = ?, postId = ?, updatedAt = ? WHERE id = ?").run(
    next.template,
    JSON.stringify(next.content),
    next.postId,
    nowIso(),
    id
  );
  return getCarousel(id);
}

export function deleteCarousel(id: string): boolean {
  return db.prepare("DELETE FROM carousels WHERE id = ?").run(id).changes > 0;
}

export type CarouselBrand = { name: string; palette: Palette; logo: { id: string; ext: string; mime: string } | null };

// Identidade do cliente para os slides: paleta da identidade visual gerada
// (ou do briefing), senão a cor da agência; logo enviado em Arquivos da marca.
export function carouselBrand(clientId: string): CarouselBrand | null {
  const client = getClient(clientId);
  if (!client) return null;
  const identity = listGenerations(clientId, "visual_identity")[0];
  let hexes: string[] = [];
  if (identity) {
    try {
      const parsed = JSON.parse(identity.content) as { palette?: { hex?: string }[] };
      hexes = (parsed.palette ?? []).map((p) => String(p.hex ?? ""));
    } catch {
      hexes = [];
    }
  }
  const agency = getAgency(client.agencyId);
  const palette = pickPalette({ identityHexes: hexes, brandColors: client.brandColors, fallback: agency?.accentColor ?? "#f76b15" });
  // o renderizador (Satori) só lê PNG e JPEG: logo em WebP/SVG fica de fora
  // e o slide usa a inicial da marca
  const images = listClientAssets(clientId).filter((a) => /^image\/(png|jpeg)$/.test(a.mime));
  const logo = images.find((a) => /logo|marca/i.test(a.title)) ?? images.find((a) => a.kind === "brand") ?? null;
  return { name: client.name, palette, logo: logo ? { id: logo.id, ext: logo.ext, mime: logo.mime } : null };
}
