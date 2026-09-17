import { NextResponse } from "next/server";
import { z } from "zod";
import { generateStructured } from "@/lib/claude";
import { getClient, listClients, listGenerations } from "@/lib/db";
import {
  createIdeaBatch,
  getProfessional,
  getProfessionalStats,
  listIdeaBatches,
  listProfessionals,
  listProjects,
  listProspects,
} from "@/lib/marketplace-db";
import { ideasSchema, type IdeasResult } from "@/lib/marketplace-schemas";
import { clientContext } from "@/lib/prompts";
import { professionalTier } from "@/lib/ranking";
import { aiErrorResponse, beginAi } from "@/lib/metering";
import { agencyOnly, isDenied } from "@/lib/guard";

export const maxDuration = 300;

const requestSchema = z.object({
  audience: z.enum(["agency", "client", "professional"]),
  targetId: z.string().nullable().default(null),
});

export async function GET(request: Request) {
  const auth = await agencyOnly();
  if (isDenied(auth)) return auth;
  const url = new URL(request.url);
  const audience = url.searchParams.get("audience");
  if (audience !== "agency" && audience !== "client" && audience !== "professional") {
    return NextResponse.json({ error: "audience inválido" }, { status: 400 });
  }
  return NextResponse.json(
    listIdeaBatches(audience, url.searchParams.get("targetId") || null)
  );
}

function professionalsSummary(): string {
  return listProfessionals()
    .map((p) => {
      const stats = getProfessionalStats(p.id);
      return `- ${p.name} (${p.role}, ${p.location}): ${p.skills.join(", ")} | elo ${professionalTier(stats).tier}, nota média ${stats.avgScore ?? "n/d"}`;
    })
    .join("\n");
}

// Motor de ideias proativo: propõe novas apostas para agência, cliente ou
// profissional, fundamentadas em tendências reais (web search) e conectadas
// às pessoas/contas já cadastradas na plataforma quando houver fit.
export async function POST(request: Request) {
  const auth = await agencyOnly();
  if (isDenied(auth)) return auth;
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
  }
  const { audience, targetId } = parsed.data;

  let prompt: string;
  if (audience === "client") {
    const client = targetId ? getClient(targetId) : null;
    if (!client) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    }
    const strategy = listGenerations(client.id, "strategy_analysis")[0];
    prompt = `${clientContext(client)}
${strategy ? `\n<estrategia_vigente>\n${strategy.content.slice(0, 4000)}\n</estrategia_vigente>` : ""}

<profissionais_disponiveis_na_plataforma>
${professionalsSummary() || "nenhum cadastrado"}
</profissionais_disponiveis_na_plataforma>

Pesquise as tendências mais recentes do segmento deste cliente e proponha 4 a 6 ideias NOVAS de campanha/trabalho para ele — coisas que ainda não estão na estratégia vigente. Para cada ideia: qual tendência real a sustenta (com fonte), o próximo passo concreto, e — quando um profissional cadastrado tiver fit claro para executá-la — indique o nome dele em "linkedTo" (senão, string vazia). Priorize (alta/média/baixa) pelo potencial de resultado para ESTE cliente.`;
  } else if (audience === "professional") {
    const professional = targetId ? getProfessional(targetId) : null;
    if (!professional) {
      return NextResponse.json({ error: "Profissional não encontrado" }, { status: 404 });
    }
    const stats = getProfessionalStats(professional.id);
    const openProjects = listProjects({ openOnly: true })
      .map((p) => `- "${p.title}" (skills: ${p.skillsNeeded.join(", ") || "n/d"}, local: ${p.location || "remoto"}, verba: ${p.budget || "n/d"})`)
      .join("\n");
    prompt = `<perfil_do_profissional>
Nome: ${professional.name} (${professional.role})
Localização: ${professional.location}
Skills: ${professional.skills.join(", ")}
Especialidades: ${professional.specialties || "n/d"}
Foco de mercado: ${professional.marketFocus || "n/d"}
Elo na plataforma: ${professionalTier(stats).tier} (${stats.completed} demandas concluídas, nota média ${stats.avgScore ?? "n/d"})
</perfil_do_profissional>

<demandas_abertas_na_plataforma>
${openProjects || "nenhuma no momento"}
</demandas_abertas_na_plataforma>

Pesquise as tendências mais recentes do mercado criativo (fotografia/design para marketing) e proponha 4 a 6 ideias para este profissional crescer: skills que estão subindo em demanda, formatos/estilos em alta para o portfolio, posicionamento e precificação. Quando uma demanda aberta da plataforma tiver fit claro com o perfil, recomende-a em uma ideia com o título dela em "linkedTo". Para cada ideia: tendência real que a sustenta (com fonte) e próximo passo concreto.`;
  } else {
    const clients = listClients()
      .map((c) => `- ${c.name} (${c.industry || "segmento n/d"})`)
      .join("\n");
    const prospects = listProspects()
      .filter((p) => p.status === "new" || p.status === "contacted")
      .map((p) => `- ${p.name} (${p.segment}, ${p.status})`)
      .join("\n");
    prompt = `<carteira_da_agencia>
Clientes ativos:
${clients || "nenhum"}

Prospects em aberto:
${prospects || "nenhum"}

Profissionais parceiros:
${professionalsSummary() || "nenhum"}
</carteira_da_agencia>

Pesquise as tendências mais recentes de marketing digital e proponha 4 a 6 ideias de negócio para a agência: novas campanhas para clientes específicos da carteira (cite o cliente em "linkedTo"), novos serviços para ofertar, nichos quentes para prospectar e formas de ativar os profissionais parceiros. Para cada ideia: tendência real que a sustenta (com fonte), próximo passo concreto e prioridade pelo potencial de receita.`;
  }

  const ticket = await beginAi(request, auth, "ideas");
  if (isDenied(ticket)) return ticket;
  try {
    return await ticket.run(async () => {
    const result = await generateStructured<IdeasResult>({
      system:
        "Você é um estrategista de marketing sênior que transforma tendências reais de mercado em oportunidades acionáveis. Nunca proponha genérico: cada ideia deve citar a tendência/dado real que a sustenta. Responda em português do Brasil.",
      prompt,
      schema: ideasSchema,
      useWebSearch: true,
      tier: "standard",
      maxTokens: 20000,
    });
    const batch = createIdeaBatch({
      audience,
      targetId,
      content: JSON.stringify(result),
    });
    return NextResponse.json(batch, { status: 201 });
    });
  } catch (error) {
    ticket.refund();
    return aiErrorResponse(error);
  }
}
