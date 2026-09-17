import { randomBytes, randomUUID } from "crypto";
import { db, getClient, tenantColumn } from "./db";
import {
  getDeliverable,
  getProject,
  getScheduledPost,
  listClientProjects,
  listClientScheduledPosts,
  listDeliverables,
  setPostClientApproval,
} from "./marketplace-db";
import { decideDeliverable, recordEvent } from "./approvals-db";
import { notifyAgency } from "./notify";
import { getAgency } from "./agencies";
import { agencyLogoUrl } from "./branding";
import {
  alreadyDecided,
  linkCovers,
  linkExpiry,
  linkState,
  normalizeItems,
  postStatusAfter,
  type ApprovalLinkItem,
  type ApprovalLinkState,
  type ApprovalLinkStatus,
  type DecisionInput,
} from "./approval-link-rules";

// Aprovação por link, sem login: a agência escolhe posts do calendário e
// entregas, gera um link e manda no WhatsApp. O cliente abre no celular e
// aprova ou pede ajuste item por item.

export type ApprovalLink = {
  id: string;
  agencyId: string;
  token: string;
  clientId: string;
  createdBy: string;
  items: ApprovalLinkItem[];
  status: ApprovalLinkStatus;
  expiresAt: string;
  viewCount: number;
  lastViewedAt: string | null;
  createdAt: string;
};

db.exec(`
  CREATE TABLE IF NOT EXISTS approval_links (
    id TEXT PRIMARY KEY,
    token TEXT NOT NULL UNIQUE,
    clientId TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    createdBy TEXT NOT NULL DEFAULT '',
    itemsJson TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'open',
    expiresAt TEXT NOT NULL,
    viewCount INTEGER NOT NULL DEFAULT 0,
    lastViewedAt TEXT,
    createdAt TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_approval_links_client ON approval_links(clientId, createdAt);
`);
tenantColumn("approval_links");

type Row = Omit<ApprovalLink, "items" | "agencyId"> & { itemsJson: string; agencyId: string | null };
const toLink = (row: Row): ApprovalLink => {
  let items: ApprovalLinkItem[] = [];
  try {
    items = normalizeItems(JSON.parse(row.itemsJson));
  } catch {
    items = [];
  }
  const { itemsJson: _drop, ...rest } = row;
  void _drop;
  return { ...rest, agencyId: row.agencyId ?? "", items, status: row.status === "closed" ? "closed" : "open" };
};

// Item pode entrar no link? Post da marca ainda não publicado/cancelado;
// entrega da marca (não referência).
function itemBelongs(clientId: string, item: ApprovalLinkItem): boolean {
  if (item.kind === "post") {
    const post = getScheduledPost(item.id);
    return Boolean(post && post.clientId === clientId && (post.status === "draft" || post.status === "scheduled"));
  }
  const deliverable = getDeliverable(item.id);
  if (!deliverable || deliverable.kind === "reference") return false;
  const project = getProject(deliverable.projectId);
  return Boolean(project && project.clientId === clientId);
}

export function createApprovalLink(input: {
  clientId: string;
  createdBy: string;
  items: ApprovalLinkItem[];
  days?: number;
}): { ok: true; link: ApprovalLink } | { ok: false; error: string } {
  const items = normalizeItems(input.items);
  if (items.length === 0) return { ok: false, error: "Escolha pelo menos um post ou entrega." };
  if (!items.every((item) => itemBelongs(input.clientId, item))) {
    return { ok: false, error: "Algum item não é deste cliente ou já foi publicado." };
  }
  const id = randomUUID();
  const token = randomBytes(32).toString("base64url");
  const createdAt = new Date().toISOString();
  db.transaction(() => {
    db.prepare(
      `INSERT INTO approval_links (id, agencyId, token, clientId, createdBy, itemsJson, status, expiresAt, createdAt)
       VALUES (?, (SELECT agencyId FROM clients WHERE id = ?), ?, ?, ?, ?, 'open', ?, ?)`
    ).run(id, input.clientId, token, input.clientId, input.createdBy, JSON.stringify(items), linkExpiry(input.days), createdAt);
    // posts entram como "aguardando aprovação"
    for (const item of items) {
      if (item.kind !== "post") continue;
      const post = getScheduledPost(item.id)!;
      if (post.clientApproval === "approved") continue;
      setPostClientApproval(post.id, { status: post.status, clientApproval: "pending", note: post.clientApprovalNote ?? "", by: "" });
    }
  }).immediate();
  return { ok: true, link: getApprovalLink(id)! };
}

export function getApprovalLink(id: string): ApprovalLink | null {
  const row = db.prepare("SELECT * FROM approval_links WHERE id = ?").get(id) as Row | undefined;
  return row ? toLink(row) : null;
}

export function getApprovalLinkByToken(token: string): ApprovalLink | null {
  const row = db.prepare("SELECT * FROM approval_links WHERE token = ?").get(token) as Row | undefined;
  return row ? toLink(row) : null;
}

export function listApprovalLinks(clientId: string, limit = 20): (ApprovalLink & { state: ApprovalLinkState; pending: number })[] {
  const rows = db
    .prepare("SELECT * FROM approval_links WHERE clientId = ? ORDER BY createdAt DESC LIMIT ?")
    .all(clientId, limit) as Row[];
  return rows.map(toLink).map((link) => ({ ...link, state: linkState(link), pending: pendingCount(link) }));
}

export function closeApprovalLink(id: string): void {
  db.prepare("UPDATE approval_links SET status = 'closed' WHERE id = ?").run(id);
}

export function markLinkViewed(id: string): void {
  db.prepare("UPDATE approval_links SET viewCount = viewCount + 1, lastViewedAt = ? WHERE id = ?").run(new Date().toISOString(), id);
}

export type LinkPostView = {
  kind: "post";
  id: string;
  title: string;
  channel: string;
  format: string;
  caption: string;
  hashtags: string[];
  scheduledFor: string;
  hasImage: boolean;
  imageId: string | null;
  decision: "" | "pending" | "approved" | "changes_requested";
  note: string;
};
export type LinkDeliverableView = {
  kind: "deliverable";
  id: string;
  title: string;
  projectTitle: string;
  hasImage: boolean;
  imageId: string | null;
  decision: "" | "pending" | "approved" | "changes_requested";
  note: string;
};
export type LinkItemView = LinkPostView | LinkDeliverableView;

function itemView(item: ApprovalLinkItem): LinkItemView | null {
  if (item.kind === "post") {
    const post = getScheduledPost(item.id);
    if (!post) return null;
    const imageId = post.deliverableId && getDeliverable(post.deliverableId)?.mime.startsWith("image/") ? post.deliverableId : null;
    return {
      kind: "post",
      id: post.id,
      title: post.title,
      channel: post.channel,
      format: post.format,
      caption: post.caption,
      hashtags: post.hashtags,
      scheduledFor: post.scheduledFor,
      hasImage: Boolean(imageId),
      imageId,
      decision: (post.clientApproval ?? "") as LinkPostView["decision"],
      note: post.clientApprovalNote ?? "",
    };
  }
  const deliverable = getDeliverable(item.id);
  if (!deliverable) return null;
  const project = getProject(deliverable.projectId);
  const status = deliverable.approvalStatus;
  return {
    kind: "deliverable",
    id: deliverable.id,
    title: deliverable.title,
    projectTitle: project?.title ?? "",
    hasImage: deliverable.mime.startsWith("image/"),
    imageId: deliverable.mime.startsWith("image/") ? deliverable.id : null,
    decision: status === "approved" || status === "changes_requested" ? status : "pending",
    note: deliverable.approvalNote ?? "",
  };
}

function pendingCount(link: ApprovalLink): number {
  return link.items
    .map(itemView)
    .filter((v): v is LinkItemView => Boolean(v))
    .filter((v) => v.decision !== "approved").length;
}

// Tudo o que a página pública precisa (marca da agência, nome do cliente,
// itens com a decisão atual). null = token inexistente.
export function linkPageData(token: string) {
  const link = getApprovalLinkByToken(token);
  if (!link) return null;
  const client = getClient(link.clientId);
  const agency = getAgency(link.agencyId);
  if (!client || !agency) return null;
  return {
    link,
    state: linkState(link),
    clientName: client.name,
    lang: client.language,
    agency: { name: agency.name, tagline: agency.tagline, accentColor: agency.accentColor, logoUrl: agencyLogoUrl(agency) },
    items: link.items.map(itemView).filter((v): v is LinkItemView => Boolean(v)),
  };
}

// Arquivo que o link pode mostrar: a imagem de um post ou de uma entrega do link.
export function linkFile(token: string, fileId: string): { id: string; mime: string } | null {
  const link = getApprovalLinkByToken(token);
  if (!link || linkState(link) !== "open") return null;
  for (const item of link.items) {
    const view = itemView(item);
    if (view?.imageId === fileId) {
      const deliverable = getDeliverable(fileId);
      return deliverable ? { id: deliverable.id, mime: deliverable.mime } : null;
    }
  }
  return null;
}

export type LinkDecisionOutcome =
  | { ok: true; item: LinkItemView; alreadyDecided: boolean }
  | { ok: false; status: 404 | 410; error: string };

export function decideViaLink(
  token: string,
  target: ApprovalLinkItem,
  input: DecisionInput
): LinkDecisionOutcome {
  const link = getApprovalLinkByToken(token);
  if (!link) return { ok: false, status: 404, error: "Link não encontrado." };
  if (linkState(link) !== "open") return { ok: false, status: 410, error: "Este link expirou. Peça um novo para a agência." };
  if (!linkCovers(link.items, target.kind, target.id)) return { ok: false, status: 404, error: "Item não encontrado neste link." };
  const client = getClient(link.clientId);
  if (!client) return { ok: false, status: 404, error: "Link não encontrado." };

  if (target.kind === "deliverable") {
    const deliverable = getDeliverable(target.id);
    if (!deliverable) return { ok: false, status: 404, error: "Item não encontrado neste link." };
    const repeat = deliverable.approvalStatus === "approved" && input.decision === "approved";
    const result = decideDeliverable({
      deliverableId: target.id,
      actor: "client",
      decision: input.decision,
      note: input.note,
      source: "link",
      approverName: input.approver,
    });
    if (!result) return { ok: false, status: 404, error: "Item não encontrado neste link." };
    return { ok: true, item: itemView(target)!, alreadyDecided: repeat || result.alreadyDecided };
  }

  const post = getScheduledPost(target.id);
  if (!post || post.clientId !== link.clientId) return { ok: false, status: 404, error: "Item não encontrado neste link." };
  if (alreadyDecided(post.clientApproval ?? "", input.decision)) {
    return { ok: true, item: itemView(target)!, alreadyDecided: true };
  }
  const nextStatus = postStatusAfter(post.status, input.decision);
  const who = input.approver ? `${input.approver} (${client.name})` : client.name;
  db.transaction(() => {
    setPostClientApproval(post.id, { status: nextStatus, clientApproval: input.decision, note: input.note, by: input.approver });
    recordEvent({
      deliverableId: "",
      projectId: "",
      clientId: client.id,
      actor: "client",
      decision: input.decision,
      note: input.note,
      actions: input.decision === "approved" ? [{ type: "activity", reason: "post_approved" }] : [{ type: "changes_requested" }],
      source: "link",
      approverName: input.approver,
      postId: post.id,
    });
  }).immediate();
  notifyAgency({
    agencyId: client.agencyId,
    clientId: client.id,
    href: "/calendar",
    text:
      input.decision === "approved"
        ? `✅ ${who} aprovou pelo link o post "${post.title}" — já está na agenda`
        : `↩ ${who} pediu ajuste pelo link no post "${post.title}": ${input.note.slice(0, 120)}`,
    whatsappBody:
      input.decision === "approved"
        ? `${who} aprovou o post "${post.title}" pelo link.`
        : `${who} pediu ajuste no post "${post.title}": ${input.note.slice(0, 300)}`,
  });
  return { ok: true, item: itemView(target)!, alreadyDecided: false };
}

// Candidatos para um link novo: posts ainda não publicados e entregas de imagem
// ou arquivo que não estão aprovadas.
export function approvalCandidates(clientId: string) {
  const posts = listClientScheduledPosts(clientId)
    .filter((p) => (p.status === "draft" || p.status === "scheduled") && p.clientApproval !== "approved")
    .map((p) => ({ kind: "post" as const, id: p.id, title: p.title, detail: `${p.channel} · ${p.scheduledFor.slice(0, 10)}`, status: p.status }));
  const deliverables = listClientProjects(clientId).flatMap((project) =>
    listDeliverables(project.id)
      .filter((d) => d.kind !== "reference" && d.approvalStatus !== "approved")
      .map((d) => ({ kind: "deliverable" as const, id: d.id, title: d.title, detail: project.title, status: d.approvalStatus ?? "" }))
  );
  return { posts, deliverables };
}

// Hoje: links abertos há mais de `hours` com itens ainda sem resposta.
export function staleApprovalLinks(agencyId: string | null, hours = 48, now: Date = new Date()) {
  const cutoff = new Date(now.getTime() - hours * 3_600_000).toISOString();
  const rows = db
    .prepare(
      `SELECT l.*, c.name AS clientName FROM approval_links l JOIN clients c ON c.id = l.clientId
       WHERE l.status = 'open' AND l.expiresAt > ? AND l.createdAt <= ? ${agencyId ? "AND l.agencyId = ?" : ""}
       ORDER BY l.createdAt ASC LIMIT 20`
    )
    .all(now.toISOString(), cutoff, ...(agencyId ? [agencyId] : [])) as (Row & { clientName: string })[];
  return rows
    .map((row) => ({ link: toLink(row), clientName: row.clientName }))
    .map(({ link, clientName }) => ({ id: link.id, token: link.token, clientId: link.clientId, clientName, createdAt: link.createdAt, pending: pendingCount(link) }))
    .filter((row) => row.pending > 0);
}
