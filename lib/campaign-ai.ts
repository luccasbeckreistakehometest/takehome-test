import { generateStructured } from "./claude";
import { isAiMock } from "./ai-mock";
import { clientContext } from "./prompts";
import { currentAgencyProfile } from "./agencies";
import type { Client } from "./types";
import { formatsFor, HOOK_TYPES, mockCampaignPlan, type CampaignInput, type CampaignPlan } from "./campaign-rules";

// Nome e estilo da casa da agência em nome de quem a IA roda.
function agencyPromptProfile(): { agencyName: string; houseStyle: string } {
  const profile = currentAgencyProfile();
  return { agencyName: profile.name, houseStyle: profile.houseStyle };
}

// Campanha de 30 dias: do briefing + objetivo + canais para um mês inteiro
// de posts rascunhados (tema, formato, dia, gancho, legenda, CTA, brief da
// imagem). Modelo padrão, medido como as demais gerações.

const str = { type: "string" } as const;
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["theme", "summary", "weeks", "posts"],
  properties: {
    theme: str,
    summary: str,
    weeks: {
      type: "array",
      items: { type: "object", additionalProperties: false, required: ["week", "theme", "goal"], properties: { week: { type: "integer" }, theme: str, goal: str } },
    },
    posts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["dayOffset", "channel", "format", "title", "hookType", "hook", "caption", "cta", "imageBrief", "hashtags"],
        properties: {
          dayOffset: { type: "integer" },
          channel: str,
          format: str,
          title: str,
          hookType: { type: "string", enum: [...HOOK_TYPES] },
          hook: str,
          caption: str,
          cta: str,
          imageBrief: str,
          hashtags: { type: "array", items: str },
        },
      },
    },
  },
} as const;

export async function generateCampaignPlan(client: Client, input: CampaignInput): Promise<CampaignPlan> {
  if (isAiMock()) return mockCampaignPlan({ ...input, clientName: client.name, lang: client.language });
  const total = Math.max(1, Math.round((input.days / 7) * input.postsPerWeek));
  const language = client.language === "en" ? "English (US)" : "Brazilian Portuguese";
  const settings = agencyPromptProfile();
  const plan = await generateStructured<CampaignPlan>({
    tier: "standard",
    maxTokens: 24000,
    system: `You are the head of content of a marketing agency${settings.agencyName ? ` (${settings.agencyName})` : ""}. You plan a full ${input.days}-day content campaign for the brand in the briefing and write every post ready to publish, in ${language}, in the brand's tone of voice. Specific, concrete, no filler, no "As an AI".${settings.houseStyle ? ` House style: ${settings.houseStyle}` : ""}
Rules: exactly ${total} posts (${input.postsPerWeek} per week), only on these channels: ${input.channels.join(", ")}; dayOffset is the day inside the campaign (0 = first day, ${input.days - 1} = last), spread evenly, at most one post per channel per day; formats per channel: ${input.channels.map((c) => `${c}: ${formatsFor(c).join("/")}`).join("; ")}; hookType from: ${HOOK_TYPES.join(", ")} — rotate them; each post: title (internal), hook (first line that stops the scroll), caption (complete, ready to publish, with the hook as its first line), cta (one clear action), imageBrief (objective art direction the designer executes without a meeting), hashtags (5-10 relevant). weeks: one theme + goal per week tying back to the campaign goal.`,
    prompt: `${clientContext(client)}

Campaign goal: ${input.goal || "grow the brand's audience and sales this month"}
Start date: ${input.startDate} · Length: ${input.days} days · Cadence: ${input.postsPerWeek} posts/week · Channels: ${input.channels.join(", ")}

Plan the campaign and write all ${total} posts.`,
    schema: SCHEMA as unknown as Record<string, unknown>,
  });
  // Defesa: canal fora da lista cai no primeiro canal pedido
  const allowed = new Set(input.channels.map((c) => c.toLowerCase()));
  plan.posts = plan.posts.slice(0, total + 5).map((p) => ({
    ...p,
    channel: allowed.has(p.channel.toLowerCase()) ? input.channels.find((c) => c.toLowerCase() === p.channel.toLowerCase())! : input.channels[0],
    hashtags: Array.isArray(p.hashtags) ? p.hashtags.slice(0, 12) : [],
  }));
  return plan;
}
