import { generateStructured } from "./claude";
import { isAiMock } from "./ai-mock";
import { clientContext } from "./prompts";
import { currentAgencyProfile } from "./agencies";
import type { Client } from "./types";
import type { AiDraft, AttendantConfig } from "./attendant-rules";

// Nome e estilo da casa da agência em nome de quem a IA roda.
function agencyPromptProfile(): { agencyName: string; houseStyle: string } {
  const profile = currentAgencyProfile();
  return { agencyName: profile.name, houseStyle: profile.houseStyle };
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "intent", "confidence", "needsHuman", "mentionsPriceOrCommitment", "summary"],
  properties: {
    reply: { type: "string" },
    intent: { type: "string" },
    confidence: { type: "number" },
    needsHuman: { type: "boolean" },
    mentionsPriceOrCommitment: { type: "boolean" },
    summary: { type: "string" },
  },
} as const;

function normalize(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Fixture determinística (AI_MOCK=1): cobre os três caminhos — resposta
// segura, pergunta de preço (passa para humano) e pedido genérico.
export function mockAttendantDraft(client: Pick<Client, "name" | "language">, text: string): AiDraft {
  const t = normalize(text);
  const en = client.language === "en";
  if (/\b(preco|precos|valor|quanto custa|quanto e|orcamento|price|cost|how much|desconto|discount)\b/.test(t)) {
    return {
      reply: en
        ? `Great question! Someone from the ${client.name} team will confirm the exact price with you here in a moment. [demo]`
        : `Boa pergunta! Alguém da equipe da ${client.name} confirma o valor certinho com você aqui em instantes. [demo]`,
      intent: "price",
      confidence: 0.55,
      needsHuman: true,
      mentionsPriceOrCommitment: false,
      summary: en ? "Asked about price" : "Perguntou o preço",
    };
  }
  if (/\b(horario|horarios|que horas|abre|fecha|aberto|hours|open|close)\b/.test(t)) {
    return {
      reply: en
        ? `Hi! ${client.name} is open Monday to Friday, 8am to 6pm. Anything else I can help with? [demo]`
        : `Oi! A ${client.name} atende de segunda a sexta, das 8h às 18h. Posso ajudar em mais alguma coisa? [demo]`,
      intent: "hours",
      confidence: 0.92,
      needsHuman: false,
      mentionsPriceOrCommitment: false,
      summary: en ? "Asked about opening hours" : "Perguntou o horário",
    };
  }
  return {
    reply: en
      ? `Hi! This is ${client.name}. Got your message — tell me a bit more about what you need and I'll point you the right way. [demo]`
      : `Oi! Aqui é da ${client.name}. Recebi sua mensagem — me conta um pouco mais do que você precisa que eu te encaminho certinho. [demo]`,
    intent: "general",
    confidence: 0.9,
    needsHuman: false,
    mentionsPriceOrCommitment: false,
    summary: en ? "General first contact" : "Primeiro contato genérico",
  };
}

export async function draftAttendantReply(input: {
  client: Client;
  config: AttendantConfig;
  text: string;
  contactName: string;
  history: { body: string; receivedAt: string }[];
}): Promise<AiDraft> {
  if (isAiMock()) return mockAttendantDraft(input.client, input.text);
  const language = input.client.language === "en" ? "English (US)" : "Brazilian Portuguese";
  const settings = agencyPromptProfile();
  return generateStructured<AiDraft>({
    tier: "standard",
    maxTokens: 1200,
    system: `You are the WhatsApp attendant of the brand described below, answering its customers. Write like a real, warm person from the team — short WhatsApp messages (1-4 sentences), at most one emoji, no lists, no "As an AI". Language: ${language}. Use ONLY facts from the brand briefing and the instructions.
HARD RULES: never invent prices, discounts, delivery times, guarantees, availability or promises; if the customer asks for any of those and the instructions do not state it explicitly, say the team will confirm and set needsHuman=true. If the customer is upset, asks for a person, or the request is outside what the brand does, set needsHuman=true. mentionsPriceOrCommitment=true whenever your reply states a price, discount, deadline, guarantee or promise. confidence = how sure you are the reply is correct and safe (0-1).${settings.houseStyle ? ` House style: ${settings.houseStyle}` : ""}`,
    prompt: `${clientContext(input.client)}
${input.config.instructions ? `\n<instrucoes_do_atendente>\n${input.config.instructions}\n</instrucoes_do_atendente>\n` : ""}
${input.history.length ? `<mensagens_anteriores_do_contato>\n${input.history.map((h) => `[${h.receivedAt.slice(0, 16)}] ${h.body}`).join("\n")}\n</mensagens_anteriores_do_contato>\n` : ""}
Customer${input.contactName ? ` (${input.contactName})` : ""} wrote now:
"""${input.text.slice(0, 2000)}"""

Return the reply plus intent (one word), confidence, needsHuman, mentionsPriceOrCommitment and a one-line summary.`,
    schema: SCHEMA as unknown as Record<string, unknown>,
  });
}
