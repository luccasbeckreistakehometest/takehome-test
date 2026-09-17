import { generateStructured, recordMockCall, STANDARD_MODEL } from "./claude";
import { isAiMock } from "./ai-mock";
import { clientContext } from "./prompts";
import { aiHash } from "./ai-cache";
import { LETTERS, mockPanel, normalizeResult, type PanelResult, type Persona } from "./panel-rules";
import type { Client } from "./types";

// Uma chamada: cada persona avalia cada variante (parar a rolagem, clareza,
// clicaria?, objeção, frase) e o painel escolhe a melhor com um ajuste.

const str = { type: "string" } as const;
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["cells", "winner", "why", "fix"],
  properties: {
    cells: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["persona", "variant", "stopScroll", "clarity", "wouldClick", "objection", "quote"],
        properties: {
          persona: str,
          variant: { type: "integer" },
          stopScroll: { type: "integer" },
          clarity: { type: "integer" },
          wouldClick: { type: "boolean" },
          objection: str,
          quote: str,
        },
      },
    },
    winner: { type: "integer" },
    why: str,
    fix: str,
  },
} as const;

export function panelHash(clientId: string, variants: string[], personas: Persona[]): string {
  return aiHash("panel", { clientId, variants, personas: personas.map((p) => [p.name, p.description]) });
}

export async function runPanel(client: Client, variants: string[], personas: Persona[]): Promise<{ result: PanelResult; demo: boolean }> {
  if (isAiMock()) {
    recordMockCall({ model: STANDARD_MODEL });
    return { result: normalizeResult(mockPanel(personas, variants), personas, variants.length), demo: true };
  }
  const lang = client.language === "en" ? "English" : "Brazilian Portuguese";
  const raw = await generateStructured<PanelResult>({
    model: STANDARD_MODEL,
    maxTokens: 2000,
    system: `You simulate a small audience panel for a social media post. Each persona reads each variant as it would appear in the feed and scores stopScroll (0-10, would they stop?), clarity (0-10), wouldClick (true/false), one short objection and one short quote in their voice. Variants are numbered from 0. Then pick the winner (variant index), explain why in one sentence and give one concrete fix for it. Be honest and critical; this is a screening, not a real test. Write objections, quotes, why and fix in ${lang}. Persona names must be copied exactly.`,
    prompt: `${clientContext(client)}

<personas>
${personas.map((p) => `- ${p.name}: ${p.description}`).join("\n")}
</personas>

${variants.map((v, i) => `<variant index="${i}" label="${LETTERS[i]}">\n${v}\n</variant>`).join("\n\n")}`,
    schema: SCHEMA as unknown as Record<string, unknown>,
  });
  return { result: normalizeResult(raw, personas, variants.length), demo: false };
}
