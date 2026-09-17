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
  // false = fora de venda (fica no catálogo para contas antigas e concessões)
  purchasable?: boolean;
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

// Destaques: só o que o produto faz hoje (cota de coins, teto de qualidade da
// IA, recursos existentes). Nada de limite de clientes ou suporte dedicado
// enquanto isso não existir de verdade.
export const PLANS: Plan[] = [
  // ---------- Cliente / marca ----------
  {
    id: "client_free",
    accountType: "client",
    name: "Grátis",
    monthlyPrice: 0,
    aiCoinsPerMonth: 40,
    quality: "economy",
    highlights: ["40 coins/mês, renovados todo mês", "IA no modo econômico", "Briefing, calendário e aprovações"],
  },
  {
    id: "client_starter",
    accountType: "client",
    name: "Starter",
    monthlyPrice: 97,
    aiCoinsPerMonth: 400,
    quality: "balanced",
    recommended: true,
    highlights: ["400 coins/mês", "IA no modo balanceado", "Kit completo de estratégia e conteúdo", "Relatório mensal com leitura da IA"],
  },
  {
    id: "client_pro",
    accountType: "client",
    name: "Pro",
    monthlyPrice: 297,
    aiCoinsPerMonth: 1500,
    quality: "premium",
    highlights: ["1.500 coins/mês", "IA no modo premium (Opus)", "Tudo do Starter"],
  },
  // ---------- Profissional ----------
  {
    id: "pro_free",
    accountType: "professional",
    name: "Grátis",
    monthlyPrice: 0,
    aiCoinsPerMonth: 20,
    quality: "economy",
    highlights: ["Perfil e portfólio", "Candidaturas às demandas abertas", "Elo e ranking"],
  },
  {
    id: "pro_plus",
    accountType: "professional",
    name: "Pro",
    monthlyPrice: 47,
    aiCoinsPerMonth: 200,
    quality: "balanced",
    // Profissional ainda não tem ação de IA: nada a vender por enquanto.
    purchasable: false,
    highlights: ["200 coins/mês", "IA no modo balanceado", "Tudo do Grátis"],
  },
  // ---------- Agência ----------
  {
    id: "agency_free",
    accountType: "agency",
    name: "Grátis",
    monthlyPrice: 0,
    aiCoinsPerMonth: 60,
    quality: "economy",
    highlights: ["60 coins/mês para testar", "IA no modo econômico", "Clientes, produção e calendário"],
  },
  {
    id: "agency_starter",
    accountType: "agency",
    name: "Starter",
    monthlyPrice: 497,
    aiCoinsPerMonth: 2000,
    quality: "balanced",
    highlights: ["2.000 coins/mês para todos os clientes", "IA no modo balanceado", "Sua marca: logo, cores e nome", "Convites com a sua marca"],
  },
  {
    id: "agency_growth",
    accountType: "agency",
    name: "Growth",
    monthlyPrice: 997,
    aiCoinsPerMonth: 6000,
    quality: "premium",
    recommended: true,
    highlights: ["6.000 coins/mês para todos os clientes", "IA no modo premium (Opus)", "Tudo do Starter"],
  },
  {
    id: "agency_scale",
    accountType: "agency",
    name: "Scale",
    monthlyPrice: 1997,
    aiCoinsPerMonth: 0,
    quality: "premium",
    unlimited: true,
    highlights: ["IA premium sem cota de coins (uso justo)", "Tudo do Growth"],
  },
];

export function plansFor(accountType: AccountType): Plan[] {
  return PLANS.filter((p) => p.accountType === accountType);
}
// Planos à venda (e o grátis) de um tipo de conta.
export function listedPlansFor(accountType: AccountType): Plan[] {
  return plansFor(accountType).filter((p) => p.monthlyPrice === 0 || p.purchasable !== false);
}
export function isPurchasablePlan(plan: Plan | undefined): boolean {
  return isPaidPlan(plan) && plan!.purchasable !== false;
}

// Quem pode comprar plano/coins: só quem de fato roda IA e paga por ela.
// Marca gerenciada: a agência paga. Profissional: nenhuma ação de IA hoje.
export const PURCHASE_MANAGED_BRAND =
  "A sua agência cuida da IA da sua marca e paga pelo uso. Você não precisa comprar plano nem coins.";
export const PURCHASE_PROFESSIONAL =
  "A conta de profissional é grátis: perfil, portfólio e candidaturas não usam coins. Não há nada para comprar.";
export function purchaseBlockReason(session: { role: string; selfServe?: boolean }): string | null {
  if (session.role === "agency") return null;
  if (session.role === "client") return session.selfServe ? null : PURCHASE_MANAGED_BRAND;
  if (session.role === "professional") return PURCHASE_PROFESSIONAL;
  return "Esta conta não compra planos.";
}
export function getPlan(id: string): Plan | undefined {
  return PLANS.find((p) => p.id === id);
}
// Plano de entrada (grátis) de cada tipo: quem não pagou, ou cujo plano pago
// venceu, fica nele. Nunca um plano pago de graça.
export function defaultPlanId(accountType: AccountType): string {
  if (accountType === "agency") return "agency_free";
  return accountType === "professional" ? "pro_free" : "client_free";
}
export const entryPlanId = defaultPlanId;

export function isPaidPlan(plan: Plan | undefined): boolean {
  return Boolean(plan && plan.monthlyPrice > 0);
}

export function isBillingPeriod(value: unknown): value is BillingPeriod {
  return typeof value === "string" && value in PERIOD_DISCOUNT;
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
  brand_voice_check: 1, // modelo barato + cache por conteúdo
  brand_voice_rewrite: 2,
  campaign_30d: 8, // mês inteiro de posts rascunhados de uma vez
  learnings: 1, // leitura curta dos aprendizados do mês
  match: 3, // ranking de profissionais com visão do portfólio
  sketch: 3,
  art_review: 3, // análise de arte com visão
  demand_suggestions: 2,
  meeting_recs: 2,
  voice_briefing: 1, // uma rodada do briefing falado
  tts: 0, // voz: limitada por taxa, não por coins
  attendant_reply: 1, // rascunho do atendente de WhatsApp (pago pela agência)
};
export function actionCost(action: string): number {
  return ACTION_COST[action] ?? 2;
}
