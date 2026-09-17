import { createHash } from "crypto";

// Regras PURAS do guardião da voz da marca: política por cliente (termos
// proibidos/obrigatórios, CTA, hashtags, emojis, alegações que precisam de
// fonte), checagens determinísticas sobre um texto, veredito final (junta a
// nota de tom da IA com as regras), hash de cache e as fixtures do AI_MOCK.

export type BrandVoicePolicy = {
  bannedTerms: string[];
  requiredTerms: string[];
  requireCta: boolean;
  maxHashtags: number; // 0 = sem hashtags
  maxEmojis: number;
  flagClaims: boolean; // alegações ("o melhor", "100%", "comprovado") precisam de fonte
  notes: string; // orientações extras de tom (vão para a IA)
};

export const DEFAULT_BRAND_VOICE_POLICY: BrandVoicePolicy = {
  bannedTerms: [],
  requiredTerms: [],
  requireCta: true,
  maxHashtags: 10,
  maxEmojis: 4,
  flagClaims: true,
  notes: "",
};

export type CheckKind = "post" | "reply";

export function parseTerms(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of String(text ?? "").split(/[,;\n]/)) {
    const term = raw.trim().replace(/\s+/g, " ").slice(0, 60);
    if (!term) continue;
    const key = normalize(term);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(term);
  }
  return out.slice(0, 50);
}

// Entrada aceita os termos como lista ou como texto separado por vírgulas.
export type BrandVoicePolicyInput = Omit<Partial<BrandVoicePolicy>, "bannedTerms" | "requiredTerms"> & {
  bannedTerms?: string[] | string;
  requiredTerms?: string[] | string;
};

export function sanitizeBrandVoicePolicy(input: BrandVoicePolicyInput, base: BrandVoicePolicy = DEFAULT_BRAND_VOICE_POLICY): BrandVoicePolicy {
  const terms = (value: string[] | string | undefined, fallback: string[]) =>
    value === undefined ? fallback : parseTerms(Array.isArray(value) ? value.join("\n") : value);
  const clamp = (value: unknown, min: number, max: number, fallback: number) => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
  };
  return {
    bannedTerms: terms(input.bannedTerms, base.bannedTerms),
    requiredTerms: terms(input.requiredTerms, base.requiredTerms),
    requireCta: typeof input.requireCta === "boolean" ? input.requireCta : base.requireCta,
    maxHashtags: input.maxHashtags !== undefined ? clamp(input.maxHashtags, 0, 30, base.maxHashtags) : base.maxHashtags,
    maxEmojis: input.maxEmojis !== undefined ? clamp(input.maxEmojis, 0, 30, base.maxEmojis) : base.maxEmojis,
    flagClaims: typeof input.flagClaims === "boolean" ? input.flagClaims : base.flagClaims,
    notes: input.notes !== undefined ? String(input.notes).trim().slice(0, 1500) : base.notes,
  };
}

export function normalize(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function containsTerm(text: string, term: string): boolean {
  const t = normalize(text);
  const needle = normalize(term);
  // termo com espaços/pontuação: busca literal; palavra: com fronteira
  const pattern = /^[a-z0-9]+$/.test(needle) ? new RegExp(`(^|[^a-z0-9])${escapeRe(needle)}(?=$|[^a-z0-9])`) : new RegExp(escapeRe(needle));
  return pattern.test(t);
}

export function countHashtags(text: string): number {
  return (text.match(/(^|\s)#[\p{L}\p{N}_]+/gu) ?? []).length;
}

export function countEmojis(text: string): number {
  return (text.match(/\p{Extended_Pictographic}/gu) ?? []).length;
}

const CTA_PATTERNS = [
  /\b(clique|clica|acesse|acessa|saiba mais|garanta|garante|compre|compra|agende|agenda|peca|pede|reserve|reserva|cadastre|inscreva|baixe|baixa|confira|confere|comente|comenta|salve|salva|compartilhe|compartilha|marque|marca alguem|responda|responde|chame|chama|fale com|fala com|me chama|manda (um|uma) (mensagem|direct|dm)|vem|venha|experimente|experimenta|aproveite|aproveita|link na bio|arrasta pra cima|toque|toca)\b/,
  /\b(shop now|book now|book (a|your)|sign up|learn more|dm us|send us|link in bio|order now|get yours|call us|message us|reply|tap|click|swipe up|grab|reserve|schedule|join|download|try it|comment|share|tag (a|someone))\b/,
  /\bwhatsapp\b/,
];

export function hasCta(text: string): boolean {
  const t = normalize(text);
  return CTA_PATTERNS.some((p) => p.test(t));
}

// { re, group }: quando o padrão precisa de contexto antes (ex.: "#1"), o
// trecho reportado é o grupo indicado, não a correspondência inteira.
const CLAIM_PATTERNS: { re: RegExp; group?: number }[] = [
  { re: /\b\d+(?:[.,]\d+)?\s?%/ },
  { re: /\b(o|a) melhor\b/ },
  { re: /\bmelhor (do|da|de|em) \b/ },
  { re: /\bmais (barato|barata|baratos|baratas|vendido|vendida|vendidos|rapido|rapida|eficaz|eficiente|completo|completa|potente|seguro|segura) (do|da|de|em|que)\b/ },
  { re: /(?:^|[^a-z0-9])(n[ºo°.]?\s?1|numero 1|#1)(?=$|[^a-z0-9])/, group: 1 },
  { re: /\b(garantido|garantida|garantia de|garantimos|resultado garantido)\b/ },
  { re: /\b(comprovado|comprovada|cientificamente|clinicamente|testado e aprovado|aprovado por)\b/ },
  { re: /\b\d+\s?x mais\b/ },
  { re: /\b(unico|unica) (no|na|do|da) \b/ },
  { re: /\b(lider|lideres) (de|em|do|da) mercado\b/ },
  { re: /\b(recomendado por|indicado por) (medicos|dentistas|especialistas|nutricionistas)\b/ },
  { re: /\bsem (efeitos colaterais|risco|riscos|contraindicacao)\b/ },
  { re: /\b(guaranteed|proven|clinically|scientifically|certified|best in|number one|world.?s best|award.?winning|risk.?free)\b/ },
];

// Trechos que afirmam algo mensurável/superlativo sem fonte.
export function findClaims(text: string): string[] {
  const t = normalize(text);
  const found: string[] = [];
  for (const { re, group } of CLAIM_PATTERNS) {
    const m = t.match(re);
    const hit = m ? (group !== undefined ? m[group] : m[0]).trim() : "";
    if (hit && !found.includes(hit)) found.push(hit);
  }
  return found;
}

export type RuleIssueCode = "banned_term" | "missing_term" | "no_cta" | "too_many_hashtags" | "too_many_emojis" | "claim_needs_source";
export type RuleIssue = { code: RuleIssueCode; severity: "block" | "warn"; detail: string };

// Checagens determinísticas: termos proibidos bloqueiam; o resto pede revisão.
export function ruleChecks(text: string, policy: BrandVoicePolicy, kind: CheckKind = "post"): RuleIssue[] {
  const issues: RuleIssue[] = [];
  for (const term of policy.bannedTerms) {
    if (containsTerm(text, term)) issues.push({ code: "banned_term", severity: "block", detail: term });
  }
  for (const term of policy.requiredTerms) {
    if (!containsTerm(text, term)) issues.push({ code: "missing_term", severity: "warn", detail: term });
  }
  if (policy.requireCta && kind === "post" && !hasCta(text)) issues.push({ code: "no_cta", severity: "warn", detail: "" });
  const hashtags = countHashtags(text);
  if (hashtags > policy.maxHashtags) issues.push({ code: "too_many_hashtags", severity: "warn", detail: `${hashtags}/${policy.maxHashtags}` });
  const emojis = countEmojis(text);
  if (emojis > policy.maxEmojis) issues.push({ code: "too_many_emojis", severity: "warn", detail: `${emojis}/${policy.maxEmojis}` });
  if (policy.flagClaims) {
    for (const claim of findClaims(text)) issues.push({ code: "claim_needs_source", severity: "warn", detail: claim });
  }
  return issues;
}

export type AiVoiceAssessment = {
  toneScore: number; // 0-100
  toneNotes: string[];
  claims: { text: string; why: string }[];
  suggestions: string[];
};

export type Verdict = "ok" | "review" | "block";

export type VoiceCheck = AiVoiceAssessment & {
  verdict: Verdict;
  issues: RuleIssue[];
  cached: boolean;
  demo: boolean;
};

export function verdictFrom(toneScore: number, issues: RuleIssue[]): Verdict {
  if (issues.some((i) => i.severity === "block") || toneScore < 50) return "block";
  if (issues.length > 0 || toneScore < 70) return "review";
  return "ok";
}

export function mergeCheck(ai: AiVoiceAssessment, issues: RuleIssue[], meta: { cached: boolean; demo: boolean }): VoiceCheck {
  const toneScore = Math.min(100, Math.max(0, Math.round(ai.toneScore)));
  return {
    toneScore,
    toneNotes: ai.toneNotes.slice(0, 6),
    claims: ai.claims.slice(0, 6),
    suggestions: ai.suggestions.slice(0, 6),
    verdict: verdictFrom(toneScore, issues),
    issues,
    ...meta,
  };
}

// Cache por conteúdo: mesmo texto + mesma política + mesmo cliente = mesma resposta.
export function contentHash(input: { op: "check" | "rewrite"; clientId: string; kind: CheckKind; text: string; policy: BrandVoicePolicy; tone: string }): string {
  return createHash("sha256")
    .update(JSON.stringify([input.op, input.clientId, input.kind, input.text.trim(), input.policy, input.tone]))
    .digest("hex");
}

// ---------- Fixtures (AI_MOCK=1) ----------

// Nota de tom determinística: parte de 88 e desconta gritaria (!!!, CAIXA
// ALTA), termos proibidos e alegações; anota o que viu.
export function mockToneAssessment(text: string, policy: BrandVoicePolicy, tone: string, lang: "pt-BR" | "en"): AiVoiceAssessment {
  let score = 88;
  const notes: string[] = [];
  const en = lang === "en";
  if (/!{2,}/.test(text)) {
    score -= 12;
    notes.push(en ? "Stacked exclamation marks read as shouting." : "Exclamações empilhadas soam como grito.");
  }
  const shouting = (text.match(/\b[A-ZÁÉÍÓÚÂÊÔÃÕÇ]{4,}\b/g) ?? []).length;
  if (shouting > 0) {
    score -= 10;
    notes.push(en ? "Words in ALL CAPS break the tone." : "Palavras em CAIXA ALTA quebram o tom.");
  }
  for (const term of policy.bannedTerms) if (containsTerm(text, term)) score -= 20;
  const claims = findClaims(text).map((c) => ({ text: c, why: en ? "Needs a source or a number you can back." : "Precisa de fonte ou de um número que dê para sustentar." }));
  score -= claims.length * 6;
  if (text.trim().length < 20) {
    score -= 15;
    notes.push(en ? "Too short to carry the brand voice." : "Curto demais para carregar a voz da marca.");
  }
  if (notes.length === 0) notes.push(en ? `Close to the briefed tone${tone ? ` (${tone})` : ""}. [demo]` : `Perto do tom do briefing${tone ? ` (${tone})` : ""}. [demo]`);
  const suggestions = [
    hasCta(text) ? (en ? "Keep the call to action at the end." : "Mantenha a chamada para ação no fim.") : en ? "Close with one clear call to action." : "Feche com uma chamada para ação clara.",
    en ? "Swap generic adjectives for something concrete about the product." : "Troque adjetivos genéricos por algo concreto do produto.",
  ];
  return { toneScore: Math.max(0, Math.min(100, score)), toneNotes: notes, claims, suggestions };
}

// Reescrita determinística: remove termos proibidos, reduz gritaria, corta
// hashtags/emojis além da política e garante CTA quando exigido.
export function mockRewrite(text: string, policy: BrandVoicePolicy, kind: CheckKind, lang: "pt-BR" | "en"): string {
  let out = text;
  for (const term of policy.bannedTerms) {
    const re = new RegExp(escapeRe(term), "gi");
    out = out.replace(re, lang === "en" ? "great value" : "que vale a pena");
  }
  out = out.replace(/!{2,}/g, "!").replace(/\b([A-ZÁÉÍÓÚÂÊÔÃÕÇ]{4,})\b/g, (w) => w.charAt(0) + w.slice(1).toLowerCase());
  if (policy.flagClaims) {
    for (const claim of findClaims(out)) {
      const re = new RegExp(escapeRe(claim), "i");
      out = out.replace(re, lang === "en" ? "made with care" : "feito com cuidado");
    }
  }
  // hashtags além do limite
  let hashtagsSeen = 0;
  out = out.replace(/(^|\s)(#[\p{L}\p{N}_]+)/gu, (m, space, tag) => {
    hashtagsSeen += 1;
    return hashtagsSeen <= policy.maxHashtags ? `${space}${tag}` : "";
  });
  let emojisSeen = 0;
  out = out.replace(/\p{Extended_Pictographic}/gu, (e) => {
    emojisSeen += 1;
    return emojisSeen <= policy.maxEmojis ? e : "";
  });
  for (const term of policy.requiredTerms) {
    if (!containsTerm(out, term)) out = `${term}: ${out}`;
  }
  if (policy.requireCta && kind === "post" && !hasCta(out)) {
    out = `${out.trim()}\n\n${lang === "en" ? "Message us on WhatsApp to order." : "Chame a gente no WhatsApp para pedir."}`;
  }
  return out.replace(/[ \t]+\n/g, "\n").replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}
