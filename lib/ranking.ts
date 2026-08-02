// Ranking gamificado estilo elo (sem XP): Bronze → Prata → Ouro → Platina.
// Calculado a partir de dados reais da plataforma, nunca editável à mão.
// Cada elo expõe progress (0-100 rumo ao próximo nível) e as métricas que
// movem o ponteiro — é isso que dá ao usuário um motivo para voltar.

export type Tier = "Bronze" | "Prata" | "Ouro" | "Platina";

export const TIER_COLORS: Record<Tier, string> = {
  Bronze: "#cd7f32",
  Prata: "#c0c0c8",
  Ouro: "#e6c229",
  Platina: "#7de2d1",
};

export type TierMetric = {
  label: string;
  value: number | string;
  target?: number;
};

export type TierInfo = {
  tier: Tier;
  reason: string;
  nextStep: string;
  progress: number;
  metrics: TierMetric[];
};

// Progresso rumo ao próximo elo: média dos critérios, cada um limitado a 100%.
function progressOf(...ratios: number[]): number {
  const capped = ratios.map((ratio) => Math.max(0, Math.min(1, ratio)));
  return Math.round((capped.reduce((sum, r) => sum + r, 0) / capped.length) * 100);
}

// Profissional: sobe combinando volume de demandas concluídas com a nota média
// das análises de IA das entregas (qualidade real, não só quantidade).
export function professionalTier(stats: {
  completed: number;
  avgScore: number | null;
}): TierInfo {
  const { completed, avgScore } = stats;
  const score = avgScore ?? 0;
  const metrics = (targetCompleted?: number, targetScore?: number): TierMetric[] => [
    { label: "Demandas concluídas", value: completed, target: targetCompleted },
    { label: "Nota média das entregas", value: avgScore ?? "n/d", target: targetScore },
  ];
  if (completed >= 10 && score >= 85) {
    return {
      tier: "Platina",
      reason: `${completed} demandas concluídas com nota média ${score}`,
      nextStep: "Mantenha a média acima de 85 para permanecer no topo",
      progress: 100,
      metrics: metrics(),
    };
  }
  if (completed >= 5 && score >= 75) {
    return {
      tier: "Ouro",
      reason: `${completed} demandas concluídas com nota média ${score}`,
      nextStep: "Platina: 10+ demandas concluídas com média ≥ 85",
      progress: progressOf(completed / 10, score / 85),
      metrics: metrics(10, 85),
    };
  }
  if (completed >= 2 && score >= 60) {
    return {
      tier: "Prata",
      reason: `${completed} demandas concluídas com nota média ${score}`,
      nextStep: "Ouro: 5+ demandas concluídas com média ≥ 75",
      progress: progressOf(completed / 5, score / 75),
      metrics: metrics(5, 75),
    };
  }
  return {
    tier: "Bronze",
    reason:
      completed === 0
        ? "Ainda sem demandas concluídas na plataforma"
        : `${completed} demanda(s) concluída(s)`,
    nextStep: "Prata: 2+ demandas concluídas com média ≥ 60",
    progress: progressOf(completed / 2, score / 60),
    metrics: metrics(2, 60),
  };
}

// Empresa/cliente: sobe por relacionamento ativo — demandas pagas e
// entregáveis gerados na plataforma.
export function clientTier(stats: {
  paidProjects: number;
  generations: number;
}): TierInfo {
  const { paidProjects, generations } = stats;
  const metrics = (targetPaid?: number): TierMetric[] => [
    { label: "Demandas pagas", value: paidProjects, target: targetPaid },
    { label: "Entregáveis gerados", value: generations },
  ];
  if (paidProjects >= 15) {
    return {
      tier: "Platina",
      reason: `${paidProjects} demandas pagas na plataforma`,
      nextStep: "Conta platina — parceiro estratégico",
      progress: 100,
      metrics: metrics(),
    };
  }
  if (paidProjects >= 6) {
    return {
      tier: "Ouro",
      reason: `${paidProjects} demandas pagas`,
      nextStep: "Platina: 15+ demandas pagas",
      progress: progressOf(paidProjects / 15),
      metrics: metrics(15),
    };
  }
  if (paidProjects >= 2 || generations >= 10) {
    return {
      tier: "Prata",
      reason: `${paidProjects} demandas pagas · ${generations} entregáveis gerados`,
      nextStep: "Ouro: 6+ demandas pagas",
      progress: progressOf(paidProjects / 6),
      metrics: metrics(6),
    };
  }
  return {
    tier: "Bronze",
    reason: "Conta em início de jornada",
    nextStep: "Prata: 2+ demandas pagas ou 10+ entregáveis gerados",
    progress: progressOf(Math.max(paidProjects / 2, generations / 10)),
    metrics: metrics(2),
  };
}

// Agência: o elo da operação inteira — cresce com carteira ativa, entregas
// pagas e qualidade média das entregas avaliada pela IA.
export type AgencyStats = {
  activeClients: number;
  paidProjects: number;
  generations: number;
  avgScore: number | null;
  professionals: number;
  meetingsHeld: number;
  weeklyActions: number;
};

export function agencyTier(stats: AgencyStats): TierInfo {
  const { activeClients, paidProjects, generations, avgScore } = stats;
  const score = avgScore ?? 0;
  const metrics = (
    targetClients?: number,
    targetPaid?: number,
    targetScore?: number
  ): TierMetric[] => [
    { label: "Clientes ativos", value: activeClients, target: targetClients },
    { label: "Demandas pagas", value: paidProjects, target: targetPaid },
    { label: "Entregáveis gerados", value: generations },
    { label: "Nota média das entregas", value: avgScore ?? "n/d", target: targetScore },
    { label: "Profissionais na rede", value: stats.professionals },
    { label: "Ações nos últimos 7 dias", value: stats.weeklyActions },
  ];
  if (activeClients >= 8 && paidProjects >= 20 && score >= 80) {
    return {
      tier: "Platina",
      reason: `${activeClients} clientes ativos · ${paidProjects} demandas pagas · nota média ${score}`,
      nextStep: "Operação platina — mantenha a nota média acima de 80",
      progress: 100,
      metrics: metrics(),
    };
  }
  if (activeClients >= 4 && paidProjects >= 8 && score >= 70) {
    return {
      tier: "Ouro",
      reason: `${activeClients} clientes ativos · ${paidProjects} demandas pagas · nota média ${score}`,
      nextStep: "Platina: 8+ clientes, 20+ demandas pagas e nota média ≥ 80",
      progress: progressOf(activeClients / 8, paidProjects / 20, score / 80),
      metrics: metrics(8, 20, 80),
    };
  }
  if (activeClients >= 2 && (generations >= 10 || paidProjects >= 2)) {
    return {
      tier: "Prata",
      reason: `${activeClients} clientes ativos · ${generations} entregáveis gerados`,
      nextStep: "Ouro: 4+ clientes, 8+ demandas pagas e nota média ≥ 70",
      progress: progressOf(activeClients / 4, paidProjects / 8, score / 70),
      metrics: metrics(4, 8, 70),
    };
  }
  return {
    tier: "Bronze",
    reason: "Operação em início de jornada",
    nextStep: "Prata: 2+ clientes ativos com 10+ entregáveis ou 2+ demandas pagas",
    progress: progressOf(
      activeClients / 2,
      Math.max(generations / 10, paidProjects / 2)
    ),
    metrics: metrics(2, 2),
  };
}
