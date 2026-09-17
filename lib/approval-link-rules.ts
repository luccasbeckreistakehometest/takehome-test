// Aprovação por link (puro, sem banco): estado do link, itens que ele cobre,
// validação da decisão e o texto pronto para mandar no WhatsApp.

export type ApprovalLinkItemKind = "post" | "deliverable";
export type ApprovalLinkItem = { kind: ApprovalLinkItemKind; id: string };
export type ApprovalLinkStatus = "open" | "closed";
export type ApprovalLinkState = "open" | "expired" | "closed";
export type LinkDecision = "approved" | "changes_requested";

export const LINK_DEFAULT_DAYS = 14;
export const LINK_MAX_DAYS = 60;
export const LINK_MAX_ITEMS = 30;
export const NOTE_MIN = 3;
export const NOTE_MAX = 1000;
export const APPROVER_MAX = 80;

// Token: 32 bytes em base64url (43 caracteres).
export function isApprovalToken(value: string | null | undefined): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
}

export function linkState(link: { status: ApprovalLinkStatus; expiresAt: string }, now: Date = new Date()): ApprovalLinkState {
  if (link.status === "closed") return "closed";
  return link.expiresAt <= now.toISOString() ? "expired" : "open";
}

export function linkExpiry(days: number | undefined, now: Date = new Date()): string {
  const n = Math.max(1, Math.min(LINK_MAX_DAYS, Math.floor(days ?? LINK_DEFAULT_DAYS)));
  return new Date(now.getTime() + n * 86_400_000).toISOString();
}

// Remove repetidos e itens malformados; corta no máximo permitido.
export function normalizeItems(items: ApprovalLinkItem[]): ApprovalLinkItem[] {
  const seen = new Set<string>();
  const out: ApprovalLinkItem[] = [];
  for (const item of items) {
    if (!item || (item.kind !== "post" && item.kind !== "deliverable") || typeof item.id !== "string" || !item.id) continue;
    const key = `${item.kind}:${item.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ kind: item.kind, id: item.id });
    if (out.length >= LINK_MAX_ITEMS) break;
  }
  return out;
}

export function linkCovers(items: ApprovalLinkItem[], kind: ApprovalLinkItemKind, id: string): boolean {
  return items.some((item) => item.kind === kind && item.id === id);
}

export type DecisionInput = { decision: LinkDecision; note: string; approver: string };

// "Pedir ajuste" exige um comentário; o nome de quem aprova é opcional.
export function validateDecision(raw: { decision?: unknown; note?: unknown; approver?: unknown }):
  | { ok: true; value: DecisionInput }
  | { ok: false; error: string } {
  const decision = raw.decision;
  if (decision !== "approved" && decision !== "changes_requested") return { ok: false, error: "Escolha aprovar ou pedir ajuste." };
  const note = typeof raw.note === "string" ? raw.note.trim() : "";
  const approver = typeof raw.approver === "string" ? raw.approver.trim().replace(/\s+/g, " ").slice(0, APPROVER_MAX) : "";
  if (note.length > NOTE_MAX) return { ok: false, error: `O comentário pode ter até ${NOTE_MAX} caracteres.` };
  if (decision === "changes_requested" && note.length < NOTE_MIN) {
    return { ok: false, error: "Conte o que precisa mudar para a agência ajustar." };
  }
  return { ok: true, value: { decision, note, approver } };
}

// Post: aprovar tira do rascunho e entra na agenda; pedir ajuste volta (ou
// fica) em rascunho — nada sai sem o cliente concordar com a versão nova.
export function postStatusAfter(current: string, decision: LinkDecision): string {
  if (current === "published" || current === "canceled") return current;
  return decision === "approved" ? "scheduled" : "draft";
}

// Item já decidido não muda de novo pelo link (repetir "Aprovar" é inócuo).
export function alreadyDecided(clientApproval: string, decision: LinkDecision): boolean {
  return clientApproval === "approved" && decision === "approved";
}

export function shareText(input: { clientName: string; agencyName: string; url: string; count: number; lang?: "pt-BR" | "en" }): string {
  if (input.lang === "en") {
    const what = input.count === 1 ? "1 item" : `${input.count} items`;
    return `Hi! ${input.agencyName} here. There ${input.count === 1 ? "is" : "are"} ${what} from ${input.clientName} waiting for your approval. Open the link, take a look and tap Approve (no password needed): ${input.url}`;
  }
  const what = input.count === 1 ? "1 peça" : `${input.count} peças`;
  return `Oi! Aqui é da ${input.agencyName}. Separamos ${what} de ${input.clientName} para você aprovar. É só abrir o link, olhar e tocar em Aprovar — não precisa de senha: ${input.url}`;
}

export function whatsappShareUrl(text: string, phone?: string | null): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

// Aguardando há mais de `hours` (lembrete na Hoje).
export function isStale(createdAt: string, hours: number, now: Date = new Date()): boolean {
  return now.getTime() - new Date(createdAt).getTime() >= hours * 3_600_000;
}
