import { generateStructured, recordMockCall, STANDARD_MODEL } from "./claude";
import { isAiMock } from "./ai-mock";
import { clientContext } from "./prompts";
import { listGenerations } from "./db";
import { aiHash, readAiCache, writeAiCache } from "./ai-cache";
import {
  countryCode,
  mockResults,
  sameBrand,
  sanitizeQuestions,
  SOURCE_TYPES,
  SUGGESTED_QUESTIONS,
  type QuestionResult,
} from "./ai-visibility-rules";
import type { Client } from "./types";

// Radar de IA: a pergunta é respondida pelo nosso modelo com busca na web,
// como um assistente responderia a um consumidor. Nunca consulta o ChatGPT
// nem raspa outro serviço. Duas perguntas por vez (VPS de 1 vCPU).

const str = { type: "string" } as const;
const SUGGEST_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["questions"],
  properties: { questions: { type: "array", items: str } },
} as const;

const RESULT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["answerSummary", "brandsMentioned", "citedSources"],
  properties: {
    answerSummary: str,
    brandsMentioned: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "position", "sentiment"],
        properties: { name: str, position: { type: "integer" }, sentiment: { type: "string", enum: ["positivo", "neutro", "negativo"] } },
      },
    },
    citedSources: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["url", "type"],
        properties: { url: str, type: { type: "string", enum: SOURCE_TYPES } },
      },
    },
  },
} as const;

export function suggestCacheKey(client: Client): string {
  return aiHash("radar_questions", [client.id, client.name, client.industry, client.description, client.audience, client.country, client.language]);
}

export function cachedSuggestions(client: Client): string[] | null {
  return readAiCache<string[]>(suggestCacheKey(client));
}

export async function suggestQuestions(client: Client): Promise<string[]> {
  const lang = client.language === "en" ? "en" : "pt-BR";
  let questions: string[];
  if (isAiMock()) {
    recordMockCall({ model: STANDARD_MODEL });
    const seg = client.industry || (lang === "en" ? "business" : "negócio");
    questions =
      lang === "en"
        ? [`What is the best ${seg} near me?`, `Which ${seg} has the best reviews?`, `Where can I find a reliable ${seg}?`, `${seg} with good prices?`, `Which ${seg} do people recommend?`, `Best ${seg} for families?`, `Is there a ${seg} open on weekends?`, `Which ${seg} delivers?`]
        : [`Qual o melhor ${seg} perto de mim?`, `Qual ${seg} tem as melhores avaliações?`, `Onde encontro um ${seg} de confiança?`, `${seg} com preço bom e qualidade?`, `Qual ${seg} as pessoas recomendam?`, `Melhor ${seg} para ir com a família?`, `Tem ${seg} aberto no fim de semana?`, `Qual ${seg} faz entrega?`];
  } else {
    const out = await generateStructured<{ questions: string[] }>({
      model: STANDARD_MODEL,
      maxTokens: 800,
      system: `You write the questions real buyers type into AI assistants (ChatGPT, Gemini) when looking for a business like this one. ${SUGGESTED_QUESTIONS} questions, in ${lang === "en" ? "English" : "Brazilian Portuguese, the way people actually write"}, buyer intent, mentioning the city or region when the briefing says it, never mentioning the brand's own name.`,
      prompt: clientContext(client),
      schema: SUGGEST_SCHEMA as unknown as Record<string, unknown>,
    });
    questions = out.questions;
  }
  const clean = sanitizeQuestions(questions).slice(0, SUGGESTED_QUESTIONS);
  writeAiCache(suggestCacheKey(client), "radar_questions", client.id, clean);
  return clean;
}

// Buscas por pergunta: com 10 perguntas o teto de busca de uma rodada fica em
// US$ 0,20 — dentro dos 12 coins cobrados. Só sobe se o custo real no ledger
// mostrar que cabe.
export const WEB_SEARCHES_PER_QUESTION = 2;

async function askOne(client: Client, question: string): Promise<QuestionResult> {
  const lang = client.language === "en" ? "English" : "Brazilian Portuguese";
  const country = countryCode(client.country);
  const out = await generateStructured<Omit<QuestionResult, "question" | "clientMentioned" | "clientPosition">>({
    model: STANDARD_MODEL,
    maxTokens: 1500,
    useWebSearch: true,
    webSearchMaxUses: WEB_SEARCHES_PER_QUESTION,
    webSearchUserLocation: country ? { country } : undefined,
    system: `Answer the consumer's question the way an AI assistant would, using web search. Then report, in ${lang}: answerSummary (2 sentences), brandsMentioned (every business you recommended or named, in order, position starting at 1, with sentiment), citedSources (the pages you relied on, each typed as one of: ${SOURCE_TYPES.join(", ")}). Be neutral: do not favour any brand you were not asked about.`,
    prompt: question,
    schema: RESULT_SCHEMA as unknown as Record<string, unknown>,
  });
  const brands = (out.brandsMentioned ?? []).slice(0, 12).map((b, i) => ({ name: String(b.name).slice(0, 80), position: Number(b.position) || i + 1, sentiment: b.sentiment }));
  return {
    question,
    answerSummary: String(out.answerSummary ?? "").slice(0, 600),
    brandsMentioned: brands,
    clientMentioned: false,
    clientPosition: null,
    citedSources: (out.citedSources ?? []).slice(0, 8).map((s) => ({ url: String(s.url).slice(0, 300), type: SOURCE_TYPES.includes(s.type) ? s.type : "site" })),
  };
}

// Uma rodada: até 10 perguntas, 2 por vez. Com AI_MOCK, resultado de exemplo
// (mas o ledger registra as chamadas e as buscas como na produção).
export async function runRadar(client: Client, questions: string[]): Promise<{ results: QuestionResult[]; demo: boolean }> {
  const competitors = latestCompetitors(client);
  if (isAiMock()) {
    for (let i = 0; i < questions.length; i++) recordMockCall({ model: STANDARD_MODEL, webSearches: WEB_SEARCHES_PER_QUESTION });
    return { results: mockResults(questions, client.name, competitors), demo: true };
  }
  const results: QuestionResult[] = new Array(questions.length);
  let next = 0;
  const worker = async () => {
    while (next < questions.length) {
      const index = next++;
      results[index] = await askOne(client, questions[index]);
    }
  };
  await Promise.all([worker(), worker()]);
  // a marca aparece em cada resposta? (nome comparado sem acento/espaço)
  const marked = results.map((r) => {
    const hit = r.brandsMentioned.find((b) => sameBrand(b.name, client.name));
    return { ...r, clientMentioned: Boolean(hit), clientPosition: hit ? hit.position : null };
  });
  return { results: marked, demo: false };
}

// Concorrentes: os da última estratégia, senão os do briefing.
export function latestCompetitors(client: Client): string {
  const strategy = listGenerations(client.id, "strategy_analysis")[0];
  if (strategy) {
    try {
      const parsed = JSON.parse(strategy.content) as { competitors?: { name?: string }[] };
      const names = (parsed.competitors ?? []).map((c) => c.name).filter(Boolean);
      if (names.length) return names.join(", ");
    } catch {
      /* estratégia antiga sem concorrentes estruturados */
    }
  }
  return client.competitors;
}
