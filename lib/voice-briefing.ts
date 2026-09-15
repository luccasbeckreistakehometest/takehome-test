import { generateStructured } from "./claude";
import { CHANNEL_OPTIONS, type ClientInput } from "./types";

// Briefing de marca falado → campos do cadastro de cliente. A pessoa fala
// solta; a cada turno o modelo consolida o que entendeu e pergunta UMA coisa
// que ainda falta, até não faltar nada obrigatório.
export type VoiceBriefing = {
  fields: Pick<ClientInput, "name" | "industry" | "description" | "audience" | "tone" | "goals" | "budget" | "differentials" | "competitors" | "brandColors" | "website" | "instagram" | "notes" | "capabilities" | "country"> & { channels: string[] };
  missing: string[];
  followUp: string;
  summary: string;
};

const str = { type: "string" } as const;
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["fields", "missing", "followUp", "summary"],
  properties: {
    fields: {
      type: "object",
      additionalProperties: false,
      required: ["name", "industry", "description", "audience", "tone", "goals", "budget", "channels", "differentials", "competitors", "brandColors", "website", "instagram", "notes", "capabilities", "country"],
      properties: {
        name: str, industry: str, description: str, audience: str, tone: str, goals: str, budget: str,
        channels: { type: "array", items: { type: "string", enum: [...CHANNEL_OPTIONS] } },
        differentials: str, competitors: str, brandColors: str, website: str, instagram: str, notes: str, capabilities: str, country: str,
      },
    },
    missing: { type: "array", items: { type: "string" } },
    followUp: str,
    summary: str,
  },
} as const;

const REQUIRED = ["name", "industry", "description", "audience", "goals"] as const;

export function mockVoiceBriefing(transcript: string, lang: "pt" | "en"): VoiceBriefing {
  const enough = transcript.length > 80;
  const empty = { name: "", industry: "", description: "", audience: "", tone: "", goals: "", budget: "", channels: [] as string[], differentials: "", competitors: "", brandColors: "", website: "", instagram: "", notes: "", capabilities: "", country: "Brasil" };
  if (!enough) return { fields: empty, missing: ["name", "industry", "description", "audience", "goals"], followUp: lang === "en" ? "What's the brand called, and what does it sell?" : "Como se chama a marca, e o que ela vende?", summary: "" };
  return {
    fields: { ...empty, name: "Café Aurora", industry: "cafeteria artesanal", description: "Cafeteria de bairro com grãos especiais e padaria própria. [demo]", audience: "Moradores de 25 a 45 anos, home office, valorizam qualidade", tone: "acolhedor e bem-humorado", goals: "Dobrar o movimento nas manhãs de semana em 6 meses", budget: "R$ 3.000/mês", channels: ["Instagram", "Google Ads"], differentials: "Torra própria, padaria artesanal", competitors: "Starbucks do shopping, padaria da esquina", brandColors: "verde-escuro e creme" },
    missing: [], followUp: "", summary: lang === "en" ? "Café Aurora, an artisan coffee shop, wants to double weekday morning traffic." : "Café Aurora, cafeteria artesanal, quer dobrar o movimento das manhãs de semana.",
  };
}

export async function extractVoiceBriefing(args: { transcript: string; lang: "pt" | "en"; prior?: VoiceBriefing | null }): Promise<VoiceBriefing> {
  if (process.env.AI_MOCK === "1") return mockVoiceBriefing(args.transcript, args.lang);
  const language = args.lang === "en" ? "English" : "Brazilian Portuguese";
  return generateStructured<VoiceBriefing>({
    tier: "standard",
    maxTokens: 2500,
    system: `You turn a spoken, informal brand briefing (a business owner or an agency talking about a client) into the fields of a marketing platform's client profile. The person is talking, not typing: fix disfluencies, keep facts exactly as said, never invent. Fill each field in ${language} as a short, useful text in the speaker's own words; "" when nothing was said about it. channels only from the allowed list. country defaults to "Brasil" unless said otherwise.
Required for a usable briefing: ${REQUIRED.join(", ")}. missing = required fields still empty. followUp = ONE natural question in ${language} asking only for the first missing item, or "" when nothing is missing. summary = one sentence in ${language} reflecting back what you understood.
When PRIOR fields are given, merge: keep prior values unless the new transcript corrects them.`,
    prompt: `${args.prior ? `PRIOR FIELDS:\n${JSON.stringify(args.prior.fields)}\n\n` : ""}NEW TRANSCRIPT:\n${args.transcript.slice(0, 6000)}`,
    schema: SCHEMA as unknown as Record<string, unknown>,
  });
}
