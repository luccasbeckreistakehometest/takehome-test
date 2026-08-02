import { NextResponse } from "next/server";
import { GenerationError, generateStructured } from "@/lib/claude";
import { getClient, listGenerations } from "@/lib/db";
import {
  getProfessionalStats,
  getProject,
  listProfessionals,
  updateProject,
} from "@/lib/marketplace-db";
import { matchSchema, type MatchResult } from "@/lib/marketplace-schemas";
import { clientContext } from "@/lib/prompts";
import { professionalTier } from "@/lib/ranking";
import { ROLE_LABELS } from "@/lib/marketplace-types";

export const maxDuration = 300;

type Context = { params: Promise<{ id: string }> };

// Match por IA: rankeia os profissionais cadastrados pela propensão a entregar
// o melhor resultado para ESTE cliente e ESTA demanda — considerando skills,
// localização, especialidade, portfolio e o track record real na plataforma
// (nota média das entregas analisadas pela IA e demandas concluídas).
export async function POST(_request: Request, { params }: Context) {
  const { id } = await params;
  const project = getProject(id);
  if (!project) {
    return NextResponse.json({ error: "Demanda não encontrada" }, { status: 404 });
  }
  const client = getClient(project.clientId);
  if (!client) {
    return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }
  const professionals = listProfessionals();
  if (professionals.length === 0) {
    return NextResponse.json(
      { error: "Nenhum profissional cadastrado ainda. Cadastre profissionais primeiro." },
      { status: 400 }
    );
  }

  const roster = professionals
    .map((professional) => {
      const stats = getProfessionalStats(professional.id);
      const tier = professionalTier(stats);
      return [
        `ID: ${professional.id}`,
        `Nome: ${professional.name} (${ROLE_LABELS[professional.role]})`,
        `Localização: ${professional.location}`,
        `Skills: ${professional.skills.join(", ") || "n/d"}`,
        `Especialidades: ${professional.specialties || "n/d"}`,
        `Foco de mercado: ${professional.marketFocus || "n/d"}`,
        `Faixa de preço: ${professional.priceRange || "n/d"}`,
        `Bio: ${professional.bio || "n/d"}`,
        `Portfolio: ${professional.portfolio.map((p) => p.title || p.url).join("; ") || "n/d"}`,
        `Track record na plataforma: elo ${tier.tier}, ${stats.completed} demandas concluídas, nota média das entregas ${stats.avgScore ?? "sem análises ainda"} (${stats.reviewCount} análises), ${stats.active} demandas ativas`,
      ].join("\n");
    })
    .join("\n\n---\n\n");

  const latestStrategy = listGenerations(project.clientId, "strategy_analysis")[0];

  try {
    const result = await generateStructured<MatchResult>({
      system:
        "Você é o diretor de operações de uma agência de marketing, especialista em alocar o profissional certo para cada job. Seja criterioso e honesto: fit alto só quando os dados sustentam. Responda em português do Brasil.",
      prompt: `${clientContext(client)}
${latestStrategy ? `\n<estrategia_da_conta>\n${latestStrategy.content.slice(0, 4000)}\n</estrategia_da_conta>\n` : ""}
<demanda>
Título: ${project.title}
Brief: ${project.brief || "n/d"}
Skills necessárias: ${project.skillsNeeded.join(", ") || "n/d"}
Local da produção: ${project.location || "remoto/indiferente"}
Verba: ${project.budget || "n/d"}
Prazo: ${project.deadline || "n/d"}
</demanda>

<profissionais_cadastrados>
${roster}
</profissionais_cadastrados>

Rankeie TODOS os profissionais pela propensão a entregar o melhor resultado para este cliente nesta demanda (campo "fit", 0-100). Considere, nesta ordem de peso: adequação de skills/especialidade à demanda, track record real na plataforma (nota média e demandas concluídas), fit com o segmento/estética do cliente, localização (crítica para fotografia presencial; irrelevante para design remoto) e faixa de preço vs. verba. Para cada um: razões objetivas, lacunas/riscos e um mini-brief personalizado de como esse profissional deveria atacar o job. Ordene do maior para o menor fit. Use exatamente os IDs fornecidos.`,
      schema: matchSchema,
      maxTokens: 24000,
    });

    updateProject(id, { matchResult: JSON.stringify(result) });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof GenerationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Erro inesperado no match." }, { status: 500 });
  }
}
