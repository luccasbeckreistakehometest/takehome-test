// Catálogo de planos e créditos ("coins"). Estático e versionável.
// Modelo de receita: cada tipo de conta tem tiers que se diferenciam por
// QUANTIDADE e QUALIDADE de IA. Também há o modo on-demand (coins) para quem
// não quer assinar, e descontos progressivos em períodos maiores.

export type AccountType = "client" | "professional" | "agency";
export type AiQuality = "economy" | "balanced" | "premium";
export type BillingPeriod = "monthly" | "quarterly" | "semiannual" | "annual";

export type Plan = {
  id: string;
  accountType: AccountType;
  name: string;
  monthlyPrice: number; // BRL/mês (base; períodos aplicam desconto)
  aiCoinsPerMonth: number; // cota mensal de coins inclusa (0 = ilimitado se unlimited)
  quality: AiQuality; // teto de qualidade de IA
  unlimited?: boolean; // sem metering (planos topo)
  highlights: string[];
  recommended?: boolean;
};

// Descontos promocionais por período (multiplicador sobre o preço mensal).
export const PERIOD_DISCOUNT: Record<BillingPeriod, { months: number; discount: number; label: string }> = {
  monthly: { months: 1, discount: 0, label: "Mensal" },
  quarterly: { months: 3, discount: 0.1, label: "Trimestral · -10%" },
  semiannual: { months: 6, discount: 0.15, label: "Semestral · -15%" },
  annual: { months: 12, discount: 0.25, label: "Anual · -25%" },
};

// Preço total do período já com desconto.
export function periodPrice(monthlyPrice: number, period: BillingPeriod): number {
  const { months, discount } = PERIOD_DISCOUNT[period];
  return Math.round(monthlyPrice * months * (1 - discount));
}

export const PLANS: Plan[] = [
  // ---------- Cliente / marca ----------
  {
    id: "client_free",
    accountType: "client",
    name: "Grátis",
    monthlyPrice: 0,
    aiCoinsPerMonth: 40,
    quality: "economy",
    highlights: ["40 coins/mês", "Qualidade econômica", "1 kit por mês", "Sem landing pages"],
  },
  {
    id: "client_starter",
    accountType: "client",
    name: "Starter",
    monthlyPrice: 97,
    aiCoinsPerMonth: 400,
    quality: "balanced",
    recommended: true,
    highlights: ["400 coins/mês", "Qualidade balanceada", "Landing pages", "Agendamento de posts"],
  },
  {
    id: "client_pro",
    accountType: "client",
    name: "Pro",
    monthlyPrice: 297,
    aiCoinsPerMonth: 1500,
    quality: "premium",
    highlights: ["1.500 coins/mês", "Qualidade premium (Opus)", "Tudo do Starter", "Prioridade na fila de IA"],
  },
  // ---------- Profissional ----------
  {
    id: "pro_free",
    accountType: "professional",
    name: "Grátis",
    monthlyPrice: 0,
    aiCoinsPerMonth: 20,
    quality: "economy",
    highlights: ["Perfil e portfólio", "5 candidaturas/mês", "Elo e ranking"],
  },
  {
    id: "pro_plus",
    accountType: "professional",
    name: "Pro",
    monthlyPrice: 47,
    aiCoinsPerMonth: 200,
    quality: "balanced",
    recommended: true,
    highlights: ["Candidaturas ilimitadas", "Destaque no match", "IA de portfólio", "200 coins/mês"],
  },
  // ---------- Agência ----------
  {
    id: "agency_starter",
    accountType: "agency",
    name: "Starter",
    monthlyPrice: 497,
    aiCoinsPerMonth: 2000,
    quality: "balanced",
    highlights: ["Até 10 clientes", "Whitelabel completo", "2.000 coins/mês", "Convites com sua marca"],
  },
  {
    id: "agency_growth",
    accountType: "agency",
    name: "Growth",
    monthlyPrice: 997,
    aiCoinsPerMonth: 6000,
    quality: "premium",
    recommended: true,
    highlights: ["Até 30 clientes", "Qualidade premium (Opus)", "6.000 coins/mês", "Pool de coins compartilhado"],
  },
  {
    id: "agency_scale",
    accountType: "agency",
    name: "Scale",
    monthlyPrice: 1997,
    aiCoinsPerMonth: 0,
    quality: "premium",
    unlimited: true,
    highlights: ["Clientes ilimitados", "IA premium ilimitada", "Prioridade máxima", "Suporte dedicado"],
  },
];

export function plansFor(accountType: AccountType): Plan[] {
  return PLANS.filter((p) => p.accountType === accountType);
}
export function getPlan(id: string): Plan | undefined {
  return PLANS.find((p) => p.id === id);
}
export function defaultPlanId(accountType: AccountType): string {
  return accountType === "agency" ? "agency_starter" : `${accountType === "professional" ? "pro" : "client"}_free`;
}

// ---------- Coins on-demand (sem assinatura) ----------
export type CoinPack = { id: string; coins: number; price: number; bonus: number };
export const COIN_PACKS: CoinPack[] = [
  { id: "pack_100", coins: 100, price: 29, bonus: 0 },
  { id: "pack_500", coins: 500, price: 119, bonus: 75 }, // +15%
  { id: "pack_2000", coins: 2000, price: 399, bonus: 500 }, // +25%
];
export function getCoinPack(id: string): CoinPack | undefined {
  return COIN_PACKS.find((p) => p.id === id);
}

// ---------- Custo em coins por ação de IA ----------
// Ações mais caras (pesquisa web, Opus, imagem) custam mais coins. Isso é o
// que faz o modelo dar lucro: preço do coin > custo de token estimado.
export const ACTION_COST: Record<string, number> = {
  strategy_analysis: 10,
  market_pulse: 6,
  campaign_plan: 8,
  roi_projection: 4,
  social_calendar: 4,
  post_batch: 4,
  visual_identity: 6,
  landing_page: 12,
  client_report: 5,
  product_recs: 5,
  prospecting: 8,
  ideas: 4,
  concepts: 3, // por lote de imagens-conceito
  mockup: 4,
  assistant: 1,
  message_draft: 1,
  monthly_report: 3,
  proposal: 4,
};
export function actionCost(action: string): number {
  return ACTION_COST[action] ?? 2;
}
