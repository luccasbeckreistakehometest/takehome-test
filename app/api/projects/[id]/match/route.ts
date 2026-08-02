import { NextResponse } from "next/server";
import { GenerationError, generateStructured } from "@/lib/claude";
import { getClient, listGenerations } from "@/lib/db";
import {
  getProfessionalStats,
  getProject,
  listProfessionalAssets,
  listProfessionals,
  updateProject,
} from "@/lib/marketplace-db";
import { matchSchema, type MatchResult } from "@/lib/marketplace-schemas";
import { clientContext } from "@/lib/prompts";
import { professionalTier } from "@/lib/ranking";
import { ROLE_LABELS } from "@/lib/marketplace-types";
import { ALLOWED_IMAGE_MIMES, readUpload, type AllowedImageMime } from "@/lib/uploads";

// Visão do portfólio: além do histórico textual, deixamos a IA OLHAR peças
// reais do portfólio dos candidatos mais aderentes. Imagens custam muitos
// tokens, então limitamos a no máximo 3 profissionais × 2 imagens = 6 imagens,
// priorizando os de maior relevância textual à demanda.
const MAX_PORTFOLIO_PROFESSIONALS = 3;
const MAX_IMAGES_PER_PROFESSIONAL = 2;

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

  // Enriquece uma vez com stats/tier — reaproveitado no roster textual e na
  // seleção de quem terá imagens do portfólio anexadas.
  const enriched = professionals.map((professional) => ({
    professional,
    stats: getProfessionalStats(professional.id),
  }));

  // Relevância textual leve (sem IA): overlap de skills/especialidade com a
  // demanda, desempatado pelo track record real. Só serve para escolher DE QUEM
  // vale a pena mandar imagens — a IA ainda rankeia todos pelo texto.
  const neededSkills = project.skillsNeeded
    .map((s) => s.toLowerCase().trim())
    .filter(Boolean);
  const relevance = ({ professional, stats }: (typeof enriched)[number]): number => {
    const haystack = [
      professional.skills.join(" "),
      professional.specialties,
      professional.marketFocus,
      professional.bio,
    ]
      .join(" ")
      .toLowerCase();
    const skillHits = neededSkills.filter((skill) => haystack.includes(skill)).length;
    return skillHits * 100 + (stats.avgScore ?? 0) + stats.completed;
  };

  // Carrega até 6 imagens (3 profissionais × 2) dos candidatos mais aderentes
  // que têm portfólio hospedado — só mime image/*. attachedCounts alimenta a
  // anotação no roster para a IA saber de quem há imagens.
  const portfolioImages: { base64: string; mediaType: AllowedImageMime; label: string }[] = [];
  const attachedCounts = new Map<string, number>();
  const topForImages = enriched
    .map((entry) => ({
      entry,
      assets: listProfessionalAssets(entry.professional.id).filter((asset) =>
        (ALLOWED_IMAGE_MIMES as readonly string[]).includes(asset.mime)
      ),
    }))
    .filter((candidate) => candidate.assets.length > 0)
    .sort((a, b) => relevance(b.entry) - relevance(a.entry))
    .slice(0, MAX_PORTFOLIO_PROFESSIONALS);

  for (const { entry, assets } of topForImages) {
    for (const asset of assets.slice(0, MAX_IMAGES_PER_PROFESSIONAL)) {
      const data = readUpload(asset.id, asset.mime);
      if (!data) continue; // arquivo sumiu do disco: segue sem penalizar
      portfolioImages.push({
        base64: data.toString("base64"),
        mediaType: asset.mime as AllowedImageMime,
        label: `Portfólio de ${entry.professional.name} — ${asset.title}`,
      });
      attachedCounts.set(
        entry.professional.id,
        (attachedCounts.get(entry.professional.id) ?? 0) + 1
      );
    }
  }

  const roster = enriched
    .map(({ professional, stats }) => {
      const tier = professionalTier(stats);
      const attached = attachedCounts.get(professional.id) ?? 0;
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
        attached
          ? `Portfólio visual anexado: ${attached} imagem(ns) (rotuladas "Portfólio de ${professional.name} — ...") — AVALIE a qualidade visual e a aderência estética ao brief.`
          : `Portfólio visual anexado: nenhuma imagem (avalie só pelo texto, sem penalizar pela ausência).`,
      ].join("\n");
    })
    .join("\n\n---\n\n");

  const latestStrategy = listGenerations(project.clientId, "strategy_analysis")[0];

  try {
    const result = await generateStructured<MatchResult>({
      system:
        "Você é o diretor de operações de uma agência de marketing, especialista em alocar o profissional certo para cada job. Seja criterioso e honesto: fit alto só quando os dados sustentam. Quando houver imagens do portfólio anexadas, analise-as por visão e pese a qualidade visual e a aderência estética ao brief. Responda em português do Brasil.",
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
${
  portfolioImages.length
    ? `\nAlgumas peças reais do portfólio dos candidatos mais aderentes foram ANEXADAS como imagens (cada uma rotulada "Portfólio de {nome} — {título}"). ANALISE-as por visão: avalie a QUALIDADE VISUAL (composição, luz, acabamento, tipografia, coerência técnica) e a ADERÊNCIA ESTÉTICA ao brief e à marca deste cliente. Isso deve pesar no fit desses profissionais — peças fortes e alinhadas ao estilo pedido sobem o fit; peças fracas ou fora do estilo derrubam. Profissionais sem imagem anexada são avaliados só pelo texto, sem penalização pela ausência.\n`
    : ""
}
<profissionais_cadastrados>
${roster}
</profissionais_cadastrados>

Rankeie TODOS os profissionais pela propensão a entregar o melhor resultado para este cliente nesta demanda (campo "fit", 0-100). Considere, nesta ordem de peso: adequação de skills/especialidade à demanda, qualidade e aderência estética do portfólio ao brief (quando há imagens anexadas), track record real na plataforma (nota média e demandas concluídas), fit com o segmento/estética do cliente, localização (crítica para fotografia presencial; irrelevante para design remoto) e faixa de preço vs. verba. Para cada um: razões objetivas, lacunas/riscos e um mini-brief personalizado de como esse profissional deveria atacar o job. Ordene do maior para o menor fit. Use exatamente os IDs fornecidos.`,
      schema: matchSchema,
      maxTokens: 24000,
      ...(portfolioImages.length ? { images: portfolioImages } : {}),
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
