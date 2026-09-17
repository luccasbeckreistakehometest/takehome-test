// Regras PURAS da página pública da agência (/a/[slug]) e da captação de
// leads: slug, saneamento da configuração, validação do formulário, honeypot
// e limite de envios por IP. Sem banco, sem rede — testado em isolamento.

export type Testimonial = { author: string; role: string; text: string };

export type AgencyPageConfig = {
  slug: string; // endereço público: /a/{slug}
  published: boolean; // desligada = 404 para o público
  headline: string; // frase principal do topo
  about: string; // parágrafo "quem somos"
  services: string[]; // um serviço por item
  testimonials: Testimonial[];
  showClients: boolean; // mostra a faixa de clientes (só os que consentiram)
  ctaTitle: string; // título do bloco de contato
  whatsapp: string; // número público da agência (opcional, só dígitos)
};

export const DEFAULT_AGENCY_PAGE: AgencyPageConfig = {
  slug: "",
  published: false,
  headline: "",
  about: "",
  services: [],
  testimonials: [],
  showClients: true,
  ctaTitle: "",
  whatsapp: "",
};

export const BUDGET_BANDS = ["ate-1k", "1k-3k", "3k-10k", "10k-mais", "nao-sei"] as const;
export type BudgetBand = (typeof BUDGET_BANDS)[number];

export const BUDGET_BAND_LABELS: Record<BudgetBand, { pt: string; en: string }> = {
  "ate-1k": { pt: "até R$ 1 mil/mês", en: "up to R$ 1k/month" },
  "1k-3k": { pt: "R$ 1 a 3 mil/mês", en: "R$ 1k–3k/month" },
  "3k-10k": { pt: "R$ 3 a 10 mil/mês", en: "R$ 3k–10k/month" },
  "10k-mais": { pt: "acima de R$ 10 mil/mês", en: "over R$ 10k/month" },
  "nao-sei": { pt: "ainda não sei", en: "not sure yet" },
};

export const SLUG_MAX = 40;

// "Estúdio Sol & Cia" → "estudio-sol-cia". Vazio quando nada sobra.
export function normalizeSlug(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, "");
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/.test(slug);
}

function cleanText(value: unknown, max: number): string {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

export function sanitizeAgencyPage(
  input: Partial<AgencyPageConfig>,
  base: AgencyPageConfig = DEFAULT_AGENCY_PAGE
): AgencyPageConfig {
  const slug = input.slug !== undefined ? normalizeSlug(String(input.slug)) : base.slug;
  const services = Array.isArray(input.services)
    ? input.services.map((s) => cleanText(s, 80)).filter(Boolean).slice(0, 12)
    : base.services;
  const testimonials = Array.isArray(input.testimonials)
    ? input.testimonials
        .map((t) => ({
          author: cleanText((t as Testimonial)?.author, 80),
          role: cleanText((t as Testimonial)?.role, 80),
          text: String((t as Testimonial)?.text ?? "").trim().slice(0, 600),
        }))
        .filter((t) => t.author && t.text)
        .slice(0, 8)
    : base.testimonials;
  return {
    slug,
    published: typeof input.published === "boolean" ? input.published : base.published,
    headline: input.headline !== undefined ? cleanText(input.headline, 120) : base.headline,
    about: input.about !== undefined ? String(input.about).trim().slice(0, 1200) : base.about,
    services,
    testimonials,
    showClients: typeof input.showClients === "boolean" ? input.showClients : base.showClients,
    ctaTitle: input.ctaTitle !== undefined ? cleanText(input.ctaTitle, 80) : base.ctaTitle,
    whatsapp: input.whatsapp !== undefined ? String(input.whatsapp).replace(/\D/g, "").slice(0, 15) : base.whatsapp,
  };
}

// A página só existe para o público quando tem slug e está publicada.
export function isPageLive(config: Pick<AgencyPageConfig, "slug" | "published">, slug: string): boolean {
  return config.published && config.slug.length > 0 && config.slug === normalizeSlug(slug);
}

// ---------- Formulário de lead ----------

export type Lead = { name: string; whatsapp: string; need: string; budgetBand: BudgetBand };

export type LeadCheck =
  | { ok: true; lead: Lead }
  | { ok: false; reason: "honeypot" | "name" | "whatsapp" | "need" | "budget" };

// `website` é o honeypot: campo invisível que humanos não preenchem. Quando
// vem preenchido, o servidor finge sucesso e não cria nada.
export function validateLead(input: unknown): LeadCheck {
  const body = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  if (String(body.website ?? "").trim()) return { ok: false, reason: "honeypot" };
  const name = cleanText(body.name, 80);
  if (name.length < 2) return { ok: false, reason: "name" };
  const whatsapp = String(body.whatsapp ?? "").replace(/\D/g, "");
  if (whatsapp.length < 10 || whatsapp.length > 15) return { ok: false, reason: "whatsapp" };
  const need = String(body.need ?? "").trim().slice(0, 1000);
  if (need.length < 5) return { ok: false, reason: "need" };
  const budgetBand = String(body.budgetBand ?? "");
  if (!(BUDGET_BANDS as readonly string[]).includes(budgetBand)) return { ok: false, reason: "budget" };
  return { ok: true, lead: { name, whatsapp, need, budgetBand: budgetBand as BudgetBand } };
}

// Texto que vai para o prospect (mesma lista da prospecção por IA).
export function leadToProspectFields(lead: Lead, lang: "pt-BR" | "en" = "pt-BR"): {
  whyFit: string;
  marketingMaturity: string;
  suggestedApproach: string;
} {
  const band = BUDGET_BAND_LABELS[lead.budgetBand][lang === "en" ? "en" : "pt"];
  if (lang === "en") {
    return {
      whyFit: `Came in through the public page: "${lead.need}"`,
      marketingMaturity: `Budget band: ${band}`,
      suggestedApproach: `Reply on WhatsApp +${lead.whatsapp} within the hour while the interest is warm.`,
    };
  }
  return {
    whyFit: `Chegou pela página pública: "${lead.need}"`,
    marketingMaturity: `Faixa de verba: ${band}`,
    suggestedApproach: `Responder no WhatsApp +${lead.whatsapp} dentro de uma hora, enquanto o interesse está quente.`,
  };
}

// ---------- Limite por IP (janela deslizante) ----------
// A implementação mora em lib/rate-limit.ts (reusada por login, cadastro,
// contato e rotas de IA); reexportada aqui para os usos antigos.
export { createRateLimiter, type RateLimitVerdict } from "./rate-limit";

export function leadRateLimitPerHour(env: string | undefined): number {
  const n = Number(env);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 5;
}
