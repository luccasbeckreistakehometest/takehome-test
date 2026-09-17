import { generateStructured } from "./claude";
import { isAiMock } from "./ai-mock";
import { currentAgencyProfile } from "./agencies";
import type { Prospect } from "./marketplace-types";
import { mockProposalContent, type ProposalContent } from "./proposal-rules";

// Nome e estilo da casa da agência em nome de quem a IA roda.
function agencyPromptProfile(): { agencyName: string; houseStyle: string } {
  const profile = currentAgencyProfile();
  return { agencyName: profile.name, houseStyle: profile.houseStyle };
}

const str = { type: "string" } as const;
const strArray = { type: "array", items: str } as const;
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "pitch", "painPoints", "scope", "packages", "timeline", "nextSteps", "validityNote"],
  properties: {
    headline: str,
    pitch: str,
    painPoints: strArray,
    scope: strArray,
    packages: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "price", "period", "items", "recommended"],
        properties: { name: str, price: { type: "number" }, period: str, items: strArray, recommended: { type: "boolean" } },
      },
    },
    timeline: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["phase", "weeks", "deliverables"],
        properties: { phase: str, weeks: str, deliverables: strArray },
      },
    },
    nextSteps: strArray,
    validityNote: str,
  },
} as const;

export async function generateProposalContent(input: {
  prospect: Pick<Prospect, "name" | "segment" | "location" | "website" | "instagram" | "whyFit" | "marketingMaturity" | "suggestedApproach">;
  services: string;
  notes: string;
  lang: "pt-BR" | "en";
  currency: string;
}): Promise<ProposalContent> {
  const settings = agencyPromptProfile();
  if (isAiMock()) {
    return mockProposalContent({
      prospectName: input.prospect.name,
      segment: input.prospect.segment,
      location: input.prospect.location,
      whyFit: input.prospect.whyFit,
      marketingMaturity: input.prospect.marketingMaturity,
      agencyName: settings.agencyName,
      lang: input.lang,
      services: input.services,
    });
  }
  const language = input.lang === "en" ? "English (US)" : "Brazilian Portuguese";
  return generateStructured<ProposalContent>({
    tier: "standard",
    maxTokens: 6000,
    system: `You are the head of new business at ${settings.agencyName}, a marketing agency. You write one-page commercial proposals for small businesses that close: specific to the prospect, confident, no fluff, no agency jargon, no "As an AI". Write in ${language}.${settings.houseStyle ? ` House style: ${settings.houseStyle}` : ""}
Rules: headline (one line, with the prospect's name), pitch (2 short paragraphs: what we saw, what changes in 90 days), painPoints (3-4, grounded in the prospect notes), scope (5-8 concrete items), packages (2-3; prices in ${input.currency} as plain numbers; if the agency gave prices use exactly those, otherwise propose realistic values for a small business in this market and say so in validityNote; mark exactly one as recommended; period = "${input.lang === "en" ? "month" : "mês"}" or "${input.lang === "en" ? "project" : "projeto"}"), timeline (3 phases with week ranges), nextSteps (3 items: what happens after accepting), validityNote (one line).`,
    prompt: `<prospect>
Name: ${input.prospect.name}
Segment: ${input.prospect.segment || "n/d"}
Location: ${input.prospect.location || "n/d"}
Website: ${input.prospect.website || "n/d"} · Instagram: ${input.prospect.instagram || "n/d"}
Why they are a fit: ${input.prospect.whyFit || "n/d"}
Marketing maturity: ${input.prospect.marketingMaturity || "n/d"}
Suggested approach: ${input.prospect.suggestedApproach || "n/d"}
</prospect>

<agency_offer>
${input.services || "(the agency did not list services or prices — propose a standard social + paid media + WhatsApp attendant offer)"}
</agency_offer>
${input.notes ? `\nExtra notes from the agency: ${input.notes}` : ""}

Write the proposal.`,
    schema: SCHEMA as unknown as Record<string, unknown>,
  });
}
