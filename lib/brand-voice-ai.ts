import { generateStructured } from "./claude";
import { isAiMock } from "./ai-mock";
import { clientContext } from "./prompts";
import { getSettings } from "./settings";
import type { Client } from "./types";
import {
  contentHash,
  mergeCheck,
  mockRewrite,
  mockToneAssessment,
  ruleChecks,
  type AiVoiceAssessment,
  type BrandVoicePolicy,
  type CheckKind,
  type VoiceCheck,
} from "./brand-voice-rules";
import { readCache, writeCache } from "./brand-voice-db";

// Guardião da voz da marca: regras determinísticas + nota de tom da IA
// (modelo barato, saída estruturada), tudo cacheado por hash do conteúdo.

const str = { type: "string" } as const;
const ASSESS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["toneScore", "toneNotes", "claims", "suggestions"],
  properties: {
    toneScore: { type: "integer" },
    toneNotes: { type: "array", items: str },
    claims: { type: "array", items: { type: "object", additionalProperties: false, required: ["text", "why"], properties: { text: str, why: str } } },
    suggestions: { type: "array", items: str },
  },
} as const;
const REWRITE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["text"],
  properties: { text: str },
} as const;

function policyText(policy: BrandVoicePolicy, kind: CheckKind): string {
  const lines = [
    policy.bannedTerms.length ? `Banned terms (never use): ${policy.bannedTerms.join(", ")}` : "",
    policy.requiredTerms.length ? `Required terms (must appear): ${policy.requiredTerms.join(", ")}` : "",
    policy.requireCta && kind === "post" ? "A clear call to action is required." : "",
    `Hashtags: at most ${policy.maxHashtags}. Emojis: at most ${policy.maxEmojis}.`,
    policy.flagClaims ? "Any measurable or superlative claim (best, 100%, proven, guaranteed, nº 1) needs a source or must go." : "",
    policy.notes ? `Extra tone guidance from the agency: ${policy.notes}` : "",
  ].filter(Boolean);
  return lines.join("\n");
}

export type CheckResult = VoiceCheck;

// Uma checagem: regras → cache → IA (só quando não está no cache).
// `charge` é chamado apenas quando a IA roda de verdade.
export async function checkBrandVoice(input: {
  client: Client;
  policy: BrandVoicePolicy;
  text: string;
  kind: CheckKind;
  charge?: () => { ok: boolean; reason?: string; status?: number } | Promise<{ ok: boolean; reason?: string; status?: number }>;
}): Promise<{ result: CheckResult } | { error: string; status: number }> {
  const text = input.text.trim().slice(0, 4000);
  const issues = ruleChecks(text, input.policy, input.kind);
  const hash = contentHash({ op: "check", clientId: input.client.id, kind: input.kind, text, policy: input.policy, tone: input.client.tone });
  const cached = readCache<{ ai: AiVoiceAssessment; demo: boolean }>(hash);
  if (cached) return { result: mergeCheck(cached.ai, issues, { cached: true, demo: cached.demo }) };
  if (input.charge) {
    const charge = await input.charge();
    if (!charge.ok) return { error: charge.reason ?? "Sem créditos de IA.", status: charge.status ?? 402 };
  }
  let ai: AiVoiceAssessment;
  let demo = false;
  if (isAiMock()) {
    ai = mockToneAssessment(text, input.policy, input.client.tone, input.client.language);
    demo = true;
  } else {
    const settings = getSettings();
    ai = await generateStructured<AiVoiceAssessment>({
      tier: "standard",
      maxTokens: 1200,
      system: `You are the brand-voice guardian of a marketing agency${settings.agencyName ? ` (${settings.agencyName})` : ""}. You judge whether a ${input.kind === "reply" ? "WhatsApp reply to a customer" : "social media post"} sounds like the brand described in the briefing. Be specific and short. Never rewrite here — only assess.
Return toneScore (0-100: how much the text matches the brand's tone of voice, audience and language; 85+ = publish as is, 50-69 = needs work, <50 = off-brand), toneNotes (2-4 short observations, concrete, about tone/vocabulary/audience fit), claims (statements that need a source or proof: superlatives, numbers, guarantees, health/legal claims — with why), suggestions (2-4 concrete edits, each one line). Write notes and suggestions in ${input.client.language === "en" ? "English (US)" : "Brazilian Portuguese"}.`,
      prompt: `${clientContext(input.client)}

<politica_da_marca>
${policyText(input.policy, input.kind)}
</politica_da_marca>

<texto>
${text}
</texto>

Assess the text.`,
      schema: ASSESS_SCHEMA as unknown as Record<string, unknown>,
    });
  }
  writeCache({ hash, clientId: input.client.id, op: "check", kind: input.kind, result: { ai, demo } });
  return { result: mergeCheck(ai, issues, { cached: false, demo }) };
}

// Reescrita no tom da marca respeitando a política; cacheada por hash.
export async function rewriteInBrandVoice(input: {
  client: Client;
  policy: BrandVoicePolicy;
  text: string;
  kind: CheckKind;
  charge?: () => { ok: boolean; reason?: string; status?: number } | Promise<{ ok: boolean; reason?: string; status?: number }>;
}): Promise<{ text: string; cached: boolean; demo: boolean } | { error: string; status: number }> {
  const text = input.text.trim().slice(0, 4000);
  const hash = contentHash({ op: "rewrite", clientId: input.client.id, kind: input.kind, text, policy: input.policy, tone: input.client.tone });
  const cached = readCache<{ text: string; demo: boolean }>(hash);
  if (cached) return { text: cached.text, cached: true, demo: cached.demo };
  if (input.charge) {
    const charge = await input.charge();
    if (!charge.ok) return { error: charge.reason ?? "Sem créditos de IA.", status: charge.status ?? 402 };
  }
  let out: string;
  let demo = false;
  if (isAiMock()) {
    out = mockRewrite(text, input.policy, input.kind, input.client.language);
    demo = true;
  } else {
    const settings = getSettings();
    const result = await generateStructured<{ text: string }>({
      tier: "standard",
      maxTokens: 2000,
      system: `You rewrite ${input.kind === "reply" ? "WhatsApp replies" : "social media posts"} so they sound exactly like the brand in the briefing, keeping the original message, facts and structure. Follow the brand policy strictly: remove banned terms, include required terms naturally, respect the hashtag and emoji limits, keep or add one clear call to action when required, and drop or soften any claim that has no source (never invent numbers or proof). Keep the same language as the original (${input.client.language === "en" ? "English" : "Brazilian Portuguese"}). Return only the rewritten text.${settings.houseStyle ? ` House style: ${settings.houseStyle}` : ""}`,
      prompt: `${clientContext(input.client)}

<politica_da_marca>
${policyText(input.policy, input.kind)}
</politica_da_marca>

<texto_original>
${text}
</texto_original>

Rewrite it in the brand voice.`,
      schema: REWRITE_SCHEMA as unknown as Record<string, unknown>,
    });
    out = result.text.trim();
  }
  writeCache({ hash, clientId: input.client.id, op: "rewrite", kind: input.kind, result: { text: out, demo } });
  return { text: out, cached: false, demo };
}
