// Guardrails PUROS do atendente de WhatsApp com IA (por cliente): pedido de
// humano, horário comercial, limite de respostas automáticas, e o veredito
// sobre o rascunho da IA (enviar / passar para humano / deixar como
// rascunho). Sem banco, sem rede — testado em isolamento.

export type AttendantMode = "off" | "draft" | "auto";

export type AttendantConfig = {
  mode: AttendantMode;
  phoneNumberId: string; // WhatsApp Cloud API — número próprio do cliente
  apiToken: string; // token do número próprio (vazio = usa o canal da agência)
  hoursStart: number; // 0-23 (inclusive)
  hoursEnd: number; // 1-24 (exclusive)
  days: number[]; // 0 = domingo … 6 = sábado
  timezone: string; // IANA
  maxAutoPerContactPerDay: number;
  minConfidence: number; // 0-1
  instructions: string; // o que a marca oferece / FAQ / o que nunca dizer
  handoffMessage: string; // vazio = padrão pelo idioma
};

export const DEFAULT_ATTENDANT_CONFIG: AttendantConfig = {
  mode: "off",
  phoneNumberId: "",
  apiToken: "",
  hoursStart: 8,
  hoursEnd: 18,
  days: [1, 2, 3, 4, 5],
  timezone: "America/Sao_Paulo",
  maxAutoPerContactPerDay: 5,
  minConfidence: 0.7,
  instructions: "",
  handoffMessage: "",
};

// O que a IA devolve para cada mensagem recebida.
export type AiDraft = {
  reply: string;
  intent: string;
  confidence: number; // 0-1
  needsHuman: boolean; // a IA mesma pede passagem para humano
  mentionsPriceOrCommitment: boolean; // preço, prazo garantido, promessa
  summary: string;
};

function normalize(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// O contato pediu explicitamente uma pessoa.
const HUMAN_PATTERNS = [
  /\batendente\b/,
  /\bhumano\b/,
  /\bhumana\b/,
  /\bpessoa de verdade\b/,
  /\bgerente\b/,
  /\bresponsavel\b/,
  /\bfalar com (alguem|voces|uma pessoa|um humano|o dono|a dona)\b/,
  /\bquero (uma pessoa|alguem)\b/,
  /\bhuman\b/,
  /\breal person\b/,
  /\ban? agent\b/,
  /\brepresentative\b/,
  /\btalk to (someone|a person)\b/,
];

export function wantsHuman(text: string): boolean {
  const t = normalize(text);
  return HUMAN_PATTERNS.some((p) => p.test(t));
}

// Preço, desconto, garantia ou promessa no TEXTO DA RESPOSTA — o atendente
// nunca inventa isso; quando aparece, a mensagem vai para um humano.
const PRICE_OR_PROMISE = [
  /r\$\s?\d/,
  /\$\s?\d/,
  /\d+\s?(reais|real|dolares|dollars)\b/,
  /\d+\s?%/,
  /\bgarant(o|ia|imos|ido|ida)\b/,
  /\bpromet(o|emos|ido)\b/,
  /\bde graca\b/,
  /\bgratis\b/,
  /\bfree\b/,
  /\bguarantee[ds]?\b/,
  /\bpromise[ds]?\b/,
  /\bdiscount\b/,
  /\bdesconto\b/,
];

export function containsPriceOrPromise(text: string): boolean {
  const t = normalize(text);
  return PRICE_OR_PROMISE.some((p) => p.test(t));
}

// Hora e dia da semana no fuso do cliente.
export function localClock(date: Date, timezone: string): { hour: number; weekday: number } {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
      weekday: "short",
    }).formatToParts(date);
  } catch {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo",
      hour: "numeric",
      hour12: false,
      weekday: "short",
    }).formatToParts(date);
  }
  const hourPart = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const hour = hourPart === 24 ? 0 : hourPart;
  const weekdayName = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekdayName);
  return { hour, weekday: weekday < 0 ? 1 : weekday };
}

export function isWithinBusinessHours(
  date: Date,
  cfg: Pick<AttendantConfig, "hoursStart" | "hoursEnd" | "days" | "timezone">
): boolean {
  const { hour, weekday } = localClock(date, cfg.timezone);
  if (!cfg.days.includes(weekday)) return false;
  return hour >= cfg.hoursStart && hour < cfg.hoursEnd;
}

export type AutoGate =
  | { ok: true }
  | { ok: false; reason: "mode_off" | "mode_draft" | "outside_hours" | "rate_limit" };

export function canAutoReply(input: {
  mode: AttendantMode;
  withinHours: boolean;
  autoRepliesToday: number;
  max: number;
}): AutoGate {
  if (input.mode === "off") return { ok: false, reason: "mode_off" };
  if (input.mode === "draft") return { ok: false, reason: "mode_draft" };
  if (!input.withinHours) return { ok: false, reason: "outside_hours" };
  if (input.autoRepliesToday >= input.max) return { ok: false, reason: "rate_limit" };
  return { ok: true };
}

export type DraftVerdict =
  | { outcome: "send" }
  | { outcome: "handoff"; reason: "needs_human" | "price_or_promise" }
  | { outcome: "draft"; reason: "low_confidence" | "empty" };

export function evaluateDraft(
  draft: AiDraft,
  cfg: Pick<AttendantConfig, "minConfidence">
): DraftVerdict {
  if (draft.needsHuman) return { outcome: "handoff", reason: "needs_human" };
  if (draft.mentionsPriceOrCommitment || containsPriceOrPromise(draft.reply)) {
    return { outcome: "handoff", reason: "price_or_promise" };
  }
  if (!draft.reply.trim()) return { outcome: "draft", reason: "empty" };
  if (draft.confidence < cfg.minConfidence) return { outcome: "draft", reason: "low_confidence" };
  return { outcome: "send" };
}

export function defaultHandoffMessage(lang: "pt-BR" | "en", brandName: string): string {
  return lang === "en"
    ? `Hi! I'm bringing in someone from the ${brandName} team to answer you personally — they'll get back to you here shortly.`
    : `Oi! Vou chamar alguém da equipe da ${brandName} para te responder pessoalmente — já já retornam por aqui. 🙂`;
}

export function sanitizeAttendantConfig(
  input: Partial<AttendantConfig>,
  base: AttendantConfig = DEFAULT_ATTENDANT_CONFIG
): AttendantConfig {
  const clampInt = (value: unknown, min: number, max: number, fallback: number) => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
  };
  const mode: AttendantMode = input.mode === "auto" || input.mode === "draft" ? input.mode : input.mode === "off" ? "off" : base.mode;
  const days = Array.isArray(input.days)
    ? Array.from(
        new Set(
          input.days
            .map((d) => Number(d))
            .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
        )
      ).sort((a, b) => a - b)
    : base.days;
  const confidence = Number(input.minConfidence);
  const hoursStart = clampInt(input.hoursStart, 0, 23, base.hoursStart);
  const hoursEnd = clampInt(input.hoursEnd, 1, 24, base.hoursEnd);
  return {
    mode,
    phoneNumberId: String(input.phoneNumberId ?? base.phoneNumberId).trim().slice(0, 64),
    apiToken: String(input.apiToken ?? base.apiToken).trim().slice(0, 512),
    hoursStart,
    hoursEnd: hoursEnd > hoursStart ? hoursEnd : Math.min(24, hoursStart + 1),
    days,
    timezone: String(input.timezone ?? base.timezone).trim() || base.timezone,
    maxAutoPerContactPerDay: clampInt(input.maxAutoPerContactPerDay, 1, 50, base.maxAutoPerContactPerDay),
    minConfidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : base.minConfidence,
    instructions: String(input.instructions ?? base.instructions).slice(0, 4000),
    handoffMessage: String(input.handoffMessage ?? base.handoffMessage).slice(0, 500),
  };
}
