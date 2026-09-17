// Analytics próprio, sem cookie (puro): quais eventos existem, de que páginas,
// que público cada página representa e o funil de conversão.

export const EVENT_NAMES = [
  "view",
  "cta_click",
  "signup_started",
  "signup_completed",
  "first_value",
  "checkout_started",
  "payment_approved",
  "activation_step",
  "approval_link_opened",
  "invoice_opened",
  "bio_click",
] as const;
export type EventName = (typeof EVENT_NAMES)[number];

// Eventos que o navegador pode mandar (os demais só o servidor grava).
export const CLIENT_EVENTS: ReadonlySet<EventName> = new Set(["view", "cta_click", "signup_started", "activation_step"]);

export const FUNNEL_STEPS = ["view", "cta_click", "signup_started", "signup_completed", "first_value", "checkout_started", "payment_approved"] as const;
export type FunnelStep = (typeof FUNNEL_STEPS)[number];

export type Audience = "geral" | "agencia" | "marca" | "profissional";
export const AUDIENCES: Audience[] = ["geral", "agencia", "marca", "profissional"];

export const MAX_BODY_BYTES = 2048;
export const RETENTION_DAYS = 90;

const PUBLIC_PATHS = [/^\/$/, /^\/para-(agencias|marcas|profissionais)$/, /^\/criar-conta$/, /^\/login$/, /^\/pedir-acesso$/, /^\/(contato|contact)$/, /^\/plans$/, /^\/a\/[^/]+$/, /^\/b\/[^/]+$/, /^\/aprovar\/[^/]+$/, /^\/fatura\/[^/]+$/];

export function normalizePath(raw: unknown): string {
  const value = typeof raw === "string" ? raw : "";
  const path = value.split(/[?#]/)[0].slice(0, 200) || "/";
  return path.length > 1 ? path.replace(/\/+$/, "") : path;
}

export function trackablePath(path: string): boolean {
  return PUBLIC_PATHS.some((re) => re.test(path));
}

// Páginas com token viram um caminho genérico (o token não fica no banco).
export function storedPath(path: string): string {
  if (/^\/aprovar\//.test(path)) return "/aprovar/:token";
  if (/^\/fatura\//.test(path)) return "/fatura/:token";
  return path;
}

export function audienceFromPath(path: string, typeParam?: string | null): Audience {
  if (path === "/para-agencias") return "agencia";
  if (path === "/para-marcas") return "marca";
  if (path === "/para-profissionais") return "profissional";
  if (path === "/criar-conta" || path === "/plans") {
    if (typeParam === "agency") return "agencia";
    if (typeParam === "client") return "marca";
    if (typeParam === "professional") return "profissional";
  }
  return "geral";
}

export function audienceFromRole(role: string): Audience {
  if (role === "agency") return "agencia";
  if (role === "client") return "marca";
  if (role === "professional") return "profissional";
  return "geral";
}

export type Utm = { source: string; medium: string; campaign: string; content: string };
const clean = (v: unknown) =>
  (typeof v === "string" ? v : "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._\-+ ]/g, "")
    .slice(0, 60);

export function sanitizeUtm(input: unknown): Utm {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  return {
    source: clean(o.source ?? o.utm_source),
    medium: clean(o.medium ?? o.utm_medium),
    campaign: clean(o.campaign ?? o.utm_campaign),
    content: clean(o.content ?? o.utm_content),
  };
}

export type BeaconInput = { name: EventName; path: string; audience: Audience; utm: Utm; lang: string; referrerHost: string; meta: Record<string, string | number | boolean> };

export function parseBeacon(raw: string): { ok: true; value: BeaconInput } | { ok: false; status: 400 | 413; error: string } {
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) return { ok: false, status: 413, error: "too large" };
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return { ok: false, status: 400, error: "invalid json" };
  }
  if (!body || typeof body !== "object") return { ok: false, status: 400, error: "invalid body" };
  const name = body.name as EventName;
  if (!CLIENT_EVENTS.has(name)) return { ok: false, status: 400, error: "unknown event" };
  const path = normalizePath(body.path);
  if (!trackablePath(path)) return { ok: false, status: 400, error: "path not tracked" };
  const audience = AUDIENCES.includes(body.audience as Audience) ? (body.audience as Audience) : audienceFromPath(path);
  const meta: Record<string, string | number | boolean> = {};
  const rawMeta = (body.meta && typeof body.meta === "object" ? body.meta : {}) as Record<string, unknown>;
  for (const [key, value] of Object.entries(rawMeta).slice(0, 8)) {
    if (!/^[a-z_]{1,24}$/i.test(key)) continue;
    if (typeof value === "string") meta[key] = value.slice(0, 80);
    else if (typeof value === "number" || typeof value === "boolean") meta[key] = value;
  }
  return {
    ok: true,
    value: {
      name,
      path: storedPath(path),
      audience,
      utm: sanitizeUtm(body.utm),
      lang: body.lang === "en" ? "en" : "pt",
      referrerHost: clean(body.referrer).slice(0, 80),
      meta,
    },
  };
}

export type FunnelRow = { step: FunnelStep; count: number; rate: number | null };

// Conversão entre passos (null no primeiro).
export function funnel(counts: Partial<Record<FunnelStep, number>>): FunnelRow[] {
  return FUNNEL_STEPS.map((step, index) => {
    const count = counts[step] ?? 0;
    if (index === 0) return { step, count, rate: null };
    const previous = counts[FUNNEL_STEPS[index - 1]] ?? 0;
    return { step, count, rate: previous > 0 ? Math.round((count / previous) * 1000) / 10 : null };
  });
}

export function retentionCutoff(now: Date, days = RETENTION_DAYS): string {
  return new Date(now.getTime() - days * 86_400_000).toISOString();
}

export function buildCampaignUrl(base: string, path: string, utm: Partial<Utm>): string {
  const url = new URL(path.startsWith("/") ? path : `/${path}`, base);
  const clean_ = sanitizeUtm(utm);
  if (clean_.source) url.searchParams.set("utm_source", clean_.source);
  if (clean_.medium) url.searchParams.set("utm_medium", clean_.medium);
  if (clean_.campaign) url.searchParams.set("utm_campaign", clean_.campaign);
  if (clean_.content) url.searchParams.set("utm_content", clean_.content);
  return url.toString();
}

export function eventsCsv(rows: { day: string; audience: string; source: string; step: string; count: number }[]): string {
  const lines = ["dia;publico;origem;passo;total"];
  for (const r of rows) lines.push([r.day, r.audience, r.source || "(direto)", r.step, String(r.count)].join(";"));
  return lines.join("\n");
}
