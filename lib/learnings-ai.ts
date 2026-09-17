import { generateStructured } from "./claude";
import { isAiMock } from "./ai-mock";
import { getSettings } from "./settings";
import type { Client } from "./types";
import { describeLearnings, mockLearningsReading, type Learnings, type LearningsReading } from "./learnings-rules";

// Leitura curta (3 linhas) dos aprendizados do mês. Os números já vêm
// calculados; a IA só interpreta — modelo padrão, poucos tokens.
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["lines"],
  properties: { lines: { type: "array", items: { type: "string" } } },
} as const;

export async function generateLearningsReading(client: Client, l: Learnings): Promise<LearningsReading> {
  const lang = client.language === "en" ? "en" : "pt-BR";
  if (isAiMock({ orNoKey: true })) return mockLearningsReading(l, lang);
  const settings = getSettings();
  const result = await generateStructured<{ lines: string[] }>({
    tier: "standard",
    maxTokens: 800,
    system: `You are the performance lead of a marketing agency${settings.agencyName ? ` (${settings.agencyName})` : ""}. From the numbers given, write exactly 3 short lines (max 160 characters each) in ${lang === "en" ? "English (US)" : "Brazilian Portuguese"} for the account team: line 1 = what is working, line 2 = when to post, line 3 = what to cut or change. Use only the numbers given, name the formats/days/times as written, never invent results, and remember these are correlations over a small sample — say "até aqui"/"so far" rather than claiming causation.`,
    prompt: `Client: ${client.name} (${client.industry || "n/d"})\n\n${describeLearnings(l, lang).join("\n")}\n\nWrite the 3 lines.`,
    schema: SCHEMA as unknown as Record<string, unknown>,
  });
  const lines = result.lines.map((line) => line.trim()).filter(Boolean).slice(0, 3);
  return { lines, demo: false };
}
