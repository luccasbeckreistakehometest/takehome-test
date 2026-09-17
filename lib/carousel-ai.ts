import { generateStructured, recordMockCall } from "./claude";
import { isAiMock } from "./ai-mock";
import { clientContext } from "./prompts";
import { listGenerations } from "./db";
import { currentAgencyProfile } from "./agencies";
import { aiHash, readAiCache, writeAiCache } from "./ai-cache";
import { getBrandVoicePolicy } from "./brand-voice-db";
import { ruleChecks, type RuleIssue } from "./brand-voice-rules";
import { captionText, mockCarousel, sanitizeContent, MAX_SLIDES, MIN_SLIDES, type CarouselContent } from "./carousel-rules";
import type { Client } from "./types";

// Roteiro do carrossel (modelo padrão, saída estruturada, cache por entrada).
// A checagem da voz da marca por regras roda sempre, sem custo.

const str = { type: "string" } as const;
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["hook", "slides", "cta", "caption", "hashtags"],
  properties: {
    hook: str,
    slides: {
      type: "array",
      items: { type: "object", additionalProperties: false, required: ["title", "body", "visualHint"], properties: { title: str, body: str, visualHint: str } },
    },
    cta: str,
    caption: str,
    hashtags: { type: "array", items: str },
  },
} as const;

export type CarouselDraft = { content: CarouselContent; cached: boolean; demo: boolean; voiceIssues: RuleIssue[] };

export function carouselCacheKey(client: Client, input: { topic: string; goal: string; count: number }): string {
  const strategy = listGenerations(client.id, "strategy_analysis")[0]?.id ?? "";
  return aiHash("carousel", {
    client: [client.id, client.name, client.industry, client.audience, client.tone, client.language, client.differentials],
    strategy,
    ...input,
    policy: getBrandVoicePolicy(client.id),
  });
}

export function cachedCarousel(client: Client, input: { topic: string; goal: string; count: number }): CarouselDraft | null {
  const hit = readAiCache<{ content: CarouselContent; demo: boolean }>(carouselCacheKey(client, input));
  if (!hit) return null;
  const content = sanitizeContent(hit.content);
  return { content, cached: true, demo: hit.demo, voiceIssues: ruleChecks(captionText(content), getBrandVoicePolicy(client.id), "post") };
}

export async function draftCarousel(client: Client, input: { topic: string; goal: string; count: number }): Promise<CarouselDraft> {
  const count = Math.max(MIN_SLIDES, Math.min(MAX_SLIDES, Math.floor(input.count)));
  const lang = client.language === "en" ? "en" : "pt-BR";
  let content: CarouselContent;
  let demo = false;
  if (isAiMock()) {
    recordMockCall({ tier: "standard" });
    content = mockCarousel(input.topic, lang, count);
    demo = true;
  } else {
    const strategy = listGenerations(client.id, "strategy_analysis")[0]?.content.slice(0, 5000) ?? "";
    const policy = getBrandVoicePolicy(client.id);
    const profile = currentAgencyProfile();
    const out = await generateStructured<CarouselContent>({
      tier: "standard",
      maxTokens: 2500,
      system: `You write Instagram carousels (${count} slides, 1080x1350) for a brand, in ${lang === "en" ? "English (US)" : "Brazilian Portuguese, written natively"}. Slide 1 is the hook that stops the scroll; the middle slides deliver one idea each; the last slide asks for one action. Each title has at most 60 characters and each body at most 180. No emojis inside slides. Never invent numbers, prices, awards or testimonials. visualHint is a short art direction for the designer. caption is the post caption (2-4 short paragraphs), cta one short line, hashtags 3-8 without #.${profile.houseStyle ? ` House style: ${profile.houseStyle}` : ""}${policy.bannedTerms.length ? ` Never use: ${policy.bannedTerms.join(", ")}.` : ""}${policy.requiredTerms.length ? ` Include naturally: ${policy.requiredTerms.join(", ")}.` : ""}`,
      prompt: `${clientContext(client)}
${strategy ? `\n<estrategia>\n${strategy}\n</estrategia>\n` : ""}
<carrossel>
Tema: ${input.topic}
Objetivo: ${input.goal || "engajamento e salvamentos"}
Slides: ${count}
</carrossel>`,
      schema: SCHEMA as unknown as Record<string, unknown>,
    });
    content = sanitizeContent({ ...out, slides: out.slides.slice(0, count) });
    if (content.slides.length < MIN_SLIDES) {
      // completa com o roteiro base em vez de falhar por um slide a menos
      const filler = mockCarousel(input.topic, lang, count).slides;
      content.slides = [...content.slides, ...filler.slice(content.slides.length, count)];
    }
  }
  writeAiCache(carouselCacheKey(client, input), "carousel", client.id, { content, demo });
  return { content, cached: false, demo, voiceIssues: ruleChecks(captionText(content), getBrandVoicePolicy(client.id), "post") };
}
