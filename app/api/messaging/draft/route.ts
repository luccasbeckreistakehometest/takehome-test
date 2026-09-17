import { NextResponse } from "next/server";
import { z } from "zod";
import { generateStructured } from "@/lib/claude";
import { getClient } from "@/lib/db";
import { clientContext } from "@/lib/prompts";
import { currentAgencyProfile } from "@/lib/agencies";
import { aiErrorResponse, beginAi } from "@/lib/metering";
import { agencyOnly, guard, isDenied } from "@/lib/guard";

export const maxDuration = 120;

const schema = z.object({
  channel: z.enum(["whatsapp", "instagram"]),
  goal: z.string().trim().min(1, "Diga o objetivo da mensagem").max(2000),
  clientId: z.string().nullable().default(null),
  audience: z.string().trim().max(1000).default(""),
});

const draftSchema = {
  type: "object",
  additionalProperties: false,
  required: ["message", "variants"],
  properties: {
    message: { type: "string", description: "A mensagem principal pronta para enviar" },
    variants: {
      type: "array",
      items: { type: "string" },
      description: "2 variações alternativas com abordagens diferentes",
    },
  },
} as const;

// Redige mensagens de WhatsApp/Instagram no tom da marca. Usa {nome} como
// placeholder do primeiro nome (a fila substitui por contato).
export async function POST(request: Request) {
  const auth = await agencyOnly();
  if (isDenied(auth)) return auth;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }
  const { channel, goal, clientId, audience } = parsed.data;
  if (clientId) {
    const owner = await guard(["agency", "admin"], { clientId });
    if (isDenied(owner)) return owner;
  }
  const client = clientId ? getClient(clientId) : null;

  const channelRules =
    channel === "whatsapp"
      ? "WhatsApp: tom próximo e direto, 1 a 4 frases, no máximo 1 emoji, uma única chamada para ação clara. Nada de parecer robô ou spam."
      : "Instagram DM: tom leve e conversacional, curto, pode abrir com algo pessoal sobre o perfil; 1 emoji no máximo.";

  const ticket = await beginAi(request, auth, "message_draft", { agencyId: client?.agencyId });
  if (isDenied(ticket)) return ticket;
  try {
    return await ticket.run(async () => {
    const result = await generateStructured<{ message: string; variants: string[] }>({
      system:
        `Você escreve mensagens de relacionamento e prospecção para uma agência de marketing. Escreve como uma pessoa real, calorosa e profissional — nunca como IA. ${currentAgencyProfile().houseStyle ? `Estilo da casa: ${currentAgencyProfile().houseStyle}.` : ""} Responda em português do Brasil.`,
      prompt: `Escreva uma mensagem de ${channel === "whatsapp" ? "WhatsApp" : "Instagram"} com este objetivo: "${goal}".
${channelRules}
Use {nome} onde entraria o primeiro nome da pessoa.
${audience ? `Público: ${audience}.` : ""}
${client ? `\nContexto da conta que está enviando:\n${clientContext(client)}` : ""}

Entregue a mensagem principal e 2 variações com ângulos diferentes.`,
      schema: draftSchema,
      tier: "standard",
      maxTokens: 2000,
    });
    return NextResponse.json(result);
    });
  } catch (error) {
    ticket.refund();
    return aiErrorResponse(error);
  }
}
