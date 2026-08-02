import { NextResponse } from "next/server";
import { z } from "zod";
import { GenerationError, generateStructured } from "@/lib/claude";
import { getClient, listGenerations } from "@/lib/db";
import { demandSuggestionsSchema, type DemandSuggestions } from "@/lib/marketplace-schemas";
import { SKILL_OPTIONS } from "@/lib/marketplace-types";
import { clientContext } from "@/lib/prompts";

export const maxDuration = 300;

const bodySchema = z.object({
  clientId: z.string().min(1),
  idea: z.string().trim().default(""),
});

// Fluidez kit → demandas: a IA lê o que já foi planejado para a conta
// (estratégia, campanha, calendário) e propõe as demandas de produção
// (foto/vídeo/design) necessárias para executar o plano — ou, com "idea",
// escreve o brief completo de uma demanda a partir de uma frase.
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
  }
  const { clientId, idea } = parsed.data;
  const client = getClient(clientId);
  if (!client) {
    return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }

  const latest = (type: Parameters<typeof listGenerations>[1]) =>
    listGenerations(clientId, type)[0]?.content.slice(0, 4000) ?? "";
  const strategy = latest("strategy_analysis");
  const campaign = latest("campaign_plan");
  const social = latest("social_calendar");

  const planBlock = [
    strategy && `<estrategia>\n${strategy}\n</estrategia>`,
    campaign && `<campanha>\n${campaign}\n</campanha>`,
    social && `<calendario_social>\n${social}\n</calendario_social>`,
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const result = await generateStructured<DemandSuggestions>({
      system:
        "Você é o diretor de operações de uma agência de marketing. Você transforma planos em ordens de produção executáveis para fotógrafos e designers, com briefs que dispensam reunião de dúvidas. Escreva como um profissional humano, direto e específico — nunca genérico. Responda em português do Brasil.",
      prompt: `${clientContext(client)}

${planBlock || "A conta ainda não tem plano gerado — proponha com base no briefing."}

${
        idea
          ? `A agência quer criar UMA demanda de produção a partir desta ideia: "${idea}".
Escreva a demanda completa: título objetivo, brief detalhado (o que produzir, quantidades, referências de estilo coerentes com a marca, entregáveis e formatos), skills necessárias, local (cidade do cliente se for foto presencial, "Remoto" se design), sugestão de verba realista para o mercado do país do cliente e prazo sugerido.`
          : `Liste as demandas de produção (foto, vídeo curto, design) necessárias para EXECUTAR o plano atual desta conta — 3 a 6 demandas, sem redundância.
Para cada uma: título objetivo, brief detalhado (o que produzir, quantidades, referências de estilo coerentes com a marca, entregáveis e formatos), skills necessárias, local (cidade do cliente se presencial, "Remoto" se design), verba sugerida realista e prazo sugerido. No campo "source", diga de onde do plano a demanda vem (ex.: "reels da semana 2 da campanha", "fotos do calendário social").`
      }

Use apenas skills desta lista no campo "skillsNeeded": ${SKILL_OPTIONS.join(", ")}.`,
      schema: demandSuggestionsSchema,
      tier: "standard",
      maxTokens: 12000,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof GenerationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Erro ao sugerir demandas." }, { status: 500 });
  }
}
