// Links rastreáveis e link na bio (puro): validação de destino, UTM, robôs,
// aparelho e a leitura de cliques por formato e horário.

import { hourBucket, postClock } from "./learnings-rules";

export const CODE_RE = /^[A-Za-z0-9]{7}$/;
const ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function newCode(random: (n: number) => Uint8Array): string {
  const bytes = random(7);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

// Endereço de rede interna, IP cru ou host sem ponto: não é destino de
// campanha e serve para varrer a rede de dentro.
function privateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || !host.includes(".")) return true;
  if (host.includes(":")) return true; // IPv6 cru
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!v4) return false;
  const [a, b] = v4.slice(1).map(Number);
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
}

// Só http(s), com host público, sem credenciais embutidas e sem apontar para
// a própria Marqa (link curto não vira corrente de redirecionamento).
export function validateDestUrl(raw: string, ownHost?: string | null): { ok: true; url: string } | { ok: false; error: string } {
  const value = (raw ?? "").trim();
  if (!value || value.length > 2000) return { ok: false, error: "Informe um endereço válido (http ou https)." };
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, error: "Informe um endereço válido (http ou https)." };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return { ok: false, error: "Só aceitamos endereços http ou https." };
  if (!url.hostname || url.username || url.password) return { ok: false, error: "Informe um endereço válido (http ou https)." };
  if (privateHost(url.hostname)) return { ok: false, error: "Esse endereço não é público. Use o site que você quer divulgar." };
  const own = (ownHost ?? "").trim().toLowerCase();
  if (own && url.hostname.toLowerCase() === own) return { ok: false, error: "O link curto precisa apontar para fora da Marqa." };
  return { ok: true, url: url.toString() };
}

export type Utm = { utm_source?: string; utm_medium?: string; utm_campaign?: string; utm_content?: string };

const slug = (v: string) =>
  v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

export function utmFor(input: { channel?: string | null; campaign?: string | null; postId?: string | null; month?: string }): Utm {
  const source = slug(input.channel || "") || "link-na-bio";
  return {
    utm_source: source,
    utm_medium: "social",
    utm_campaign: slug(input.campaign || "") || (input.month ? `marqa-${input.month}` : "marqa"),
    ...(input.postId ? { utm_content: input.postId } : {}),
  };
}

// Junta os UTM ao destino sem apagar nada que já estava lá.
export function mergeUtm(dest: string, utm: Utm): string {
  const url = new URL(dest);
  for (const [key, value] of Object.entries(utm)) {
    if (value && !url.searchParams.has(key)) url.searchParams.set(key, value);
  }
  return url.toString();
}

const BOT_RE = /bot|crawl|spider|slurp|headless|facebookexternalhit|embedly|preview|monitor|curl|wget|python-requests|go-http-client|httpclient|axios|node-fetch|lighthouse/i;
// testMode (só no e2e): o navegador de teste é "HeadlessChrome" e o cliente
// HTTP é o do Playwright; robôs declarados continuam fora.
export function isBot(userAgent: string | null | undefined, opts: { testMode?: boolean } = {}): boolean {
  const ua = (userAgent ?? "").trim();
  if (!ua) return true;
  if (opts.testMode && /^(curl\/|playwright\/)|headlesschrome/i.test(ua) && !/bot|crawl|spider/i.test(ua)) return false;
  return BOT_RE.test(ua);
}

export function deviceOf(userAgent: string | null | undefined): "mobile" | "desktop" {
  return /mobi|android|iphone|ipad/i.test(userAgent ?? "") ? "mobile" : "desktop";
}

export function referrerHost(referrer: string | null | undefined): string {
  if (!referrer) return "";
  try {
    return new URL(referrer).hostname.replace(/^www\./, "").slice(0, 80);
  } catch {
    return "";
  }
}

export function normalizeBioSlug(raw: string): string {
  return slug(raw).slice(0, 32);
}

export const RESERVED_BIO_SLUGS = new Set(["admin", "api", "marqa", "login", "app", "b", "l"]);

export type BioButton = { code: string; label: string };
export function sanitizeButtons(input: unknown, knownCodes: Set<string>): BioButton[] {
  const list = Array.isArray(input) ? input : [];
  const seen = new Set<string>();
  const out: BioButton[] = [];
  for (const entry of list) {
    const code = String((entry as BioButton)?.code ?? "");
    if (!knownCodes.has(code) || seen.has(code)) continue;
    seen.add(code);
    out.push({ code, label: String((entry as BioButton)?.label ?? "").trim().slice(0, 60) });
    if (out.length >= 8) break;
  }
  return out;
}

export type ClickRow = { key: string; posts: number; clicks: number; avg: number };

// Cliques por formato e por faixa de horário (posts publicados com link).
export function clickLearnings(
  posts: { id: string; format?: string; scheduledFor: string; status: string }[],
  clicksByPost: Map<string, number>
): { byFormat: ClickRow[]; byHour: ClickRow[]; totalClicks: number; postsWithLinks: number } {
  const tracked = posts.filter((p) => p.status === "published" && clicksByPost.has(p.id));
  const group = (keyOf: (p: (typeof tracked)[number]) => string): ClickRow[] => {
    const map = new Map<string, { posts: number; clicks: number }>();
    for (const post of tracked) {
      const key = keyOf(post);
      const row = map.get(key) ?? { posts: 0, clicks: 0 };
      row.posts += 1;
      row.clicks += clicksByPost.get(post.id) ?? 0;
      map.set(key, row);
    }
    return [...map.entries()]
      .map(([key, row]) => ({ key, ...row, avg: Math.round((row.clicks / row.posts) * 10) / 10 }))
      .sort((a, b) => b.avg - a.avg);
  };
  return {
    byFormat: group((p) => p.format || "Feed"),
    byHour: group((p) => hourBucket(postClock(p.scheduledFor).hour)),
    totalClicks: tracked.reduce((sum, p) => sum + (clicksByPost.get(p.id) ?? 0), 0),
    postsWithLinks: tracked.length,
  };
}
