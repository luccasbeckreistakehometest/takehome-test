// Ranking gamificado estilo elo (sem XP): Bronze → Prata → Ouro → Platina.
// Calculado a partir de dados reais da plataforma, nunca editável à mão.

export type Tier = "Bronze" | "Prata" | "Ouro" | "Platina";

export const TIER_COLORS: Record<Tier, string> = {
  Bronze: "#cd7f32",
  Prata: "#c0c0c8",
  Ouro: "#e6c229",
  Platina: "#7de2d1",
};

export type TierInfo = { tier: Tier; reason: string; nextStep: string };

// Profissional: sobe combinando volume de demandas concluídas com a nota média
// das análises de IA das entregas (qualidade real, não só quantidade).
export function professionalTier(stats: {
  completed: number;
  avgScore: number | null;
}): TierInfo {
  const { completed, avgScore } = stats;
  const score = avgScore ?? 0;
  if (completed >= 10 && score >= 85) {
    return {
      tier: "Platina",
      reason: `${completed} demandas concluídas com nota média ${score}`,
      nextStep: "Mantenha a média acima de 85 para permanecer no topo",
    };
  }
  if (completed >= 5 && score >= 75) {
    return {
      tier: "Ouro",
      reason: `${completed} demandas concluídas com nota média ${score}`,
      nextStep: "Platina: 10+ demandas concluídas com média ≥ 85",
    };
  }
  if (completed >= 2 && score >= 60) {
    return {
      tier: "Prata",
      reason: `${completed} demandas concluídas com nota média ${score}`,
      nextStep: "Ouro: 5+ demandas concluídas com média ≥ 75",
    };
  }
  return {
    tier: "Bronze",
    reason:
      completed === 0
        ? "Ainda sem demandas concluídas na plataforma"
        : `${completed} demanda(s) concluída(s)`,
    nextStep: "Prata: 2+ demandas concluídas com média ≥ 60",
  };
}

// Empresa/cliente: sobe por relacionamento ativo — demandas pagas e
// entregáveis gerados na plataforma.
export function clientTier(stats: {
  paidProjects: number;
  generations: number;
}): TierInfo {
  const { paidProjects, generations } = stats;
  if (paidProjects >= 15) {
    return {
      tier: "Platina",
      reason: `${paidProjects} demandas pagas na plataforma`,
      nextStep: "Conta platina — parceiro estratégico",
    };
  }
  if (paidProjects >= 6) {
    return {
      tier: "Ouro",
      reason: `${paidProjects} demandas pagas`,
      nextStep: "Platina: 15+ demandas pagas",
    };
  }
  if (paidProjects >= 2 || generations >= 10) {
    return {
      tier: "Prata",
      reason: `${paidProjects} demandas pagas · ${generations} entregáveis gerados`,
      nextStep: "Ouro: 6+ demandas pagas",
    };
  }
  return {
    tier: "Bronze",
    reason: "Conta em início de jornada",
    nextStep: "Prata: 2+ demandas pagas ou 10+ entregáveis gerados",
  };
}
