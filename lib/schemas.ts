// JSON Schemas para structured outputs da Claude (todas as respostas JSON são
// validadas pelo servidor da API contra estes schemas).

const str = { type: "string" } as const;
const strArray = { type: "array", items: { type: "string" } } as const;

function obj(
  properties: Record<string, unknown>,
  required = Object.keys(properties)
) {
  return { type: "object", properties, required, additionalProperties: false };
}

export const strategyAnalysisSchema = obj({
  title: str,
  executiveSummary: str,
  marketTrends: {
    type: "array",
    items: obj({ trend: str, implication: str, source: str }),
  },
  targetBuyers: {
    type: "array",
    items: obj({
      persona: str,
      profile: str,
      pains: strArray,
      desires: strArray,
      channels: strArray,
      buyingTriggers: str,
    }),
  },
  competitors: {
    type: "array",
    items: obj({
      name: str,
      positioning: str,
      strengths: strArray,
      weaknesses: strArray,
      opportunity: str,
    }),
  },
  bestFits: {
    type: "array",
    items: obj({ recommendation: str, why: str, priority: str }),
  },
  goals: {
    type: "array",
    items: obj({ goal: str, metric: str, target: str, deadline: str }),
  },
});

export const marketPulseSchema = obj({
  title: str,
  summary: str,
  headlines: {
    type: "array",
    items: obj({ headline: str, source: str, whatChanged: str, relevance: str }),
  },
  trendShifts: {
    type: "array",
    items: obj({ trend: str, direction: str, action: str }),
  },
  recommendations: {
    type: "array",
    items: obj({ recommendation: str, urgency: str, rationale: str }),
  },
  watchlist: strArray,
});

export const campaignPlanSchema = obj({
  title: str,
  month: str,
  theme: str,
  summary: str,
  influencers: {
    type: "array",
    items: obj({
      name: str,
      platform: str,
      handle: str,
      profileUrl: str,
      followers: str,
      whyFit: str,
      contactEmail: str,
    }),
  },
  objectives: {
    type: "array",
    items: obj({ objective: str, kpi: str, target: str }),
  },
  weeks: {
    type: "array",
    items: obj({ week: { type: "integer" }, focus: str, actions: strArray }),
  },
  channels: {
    type: "array",
    items: obj({ channel: str, strategy: str, frequency: str }),
  },
  budget: {
    type: "array",
    items: obj({ item: str, allocation: str, rationale: str }),
  },
  risks: strArray,
});

export const roiProjectionSchema = obj({
  title: str,
  summary: str,
  assumptions: strArray,
  investment: {
    type: "array",
    items: obj({ item: str, monthlyCost: str, notes: str }),
  },
  metrics: {
    type: "array",
    items: obj({ metric: str, before: str, after: str, uplift: str }),
  },
  roi: obj({
    totalInvestment: str,
    projectedReturn: str,
    roiPercent: str,
    paybackPeriod: str,
    explanation: str,
  }),
  roadmap: {
    type: "array",
    items: obj({ phase: str, period: str, milestones: strArray, expectedImpact: str }),
  },
});

export const socialCalendarSchema = obj({
  title: str,
  month: str,
  strategySummary: str,
  posts: {
    type: "array",
    items: obj({
      day: { type: "integer" },
      channel: str,
      format: str,
      title: str,
      caption: str,
      hashtags: strArray,
      artDirection: str,
      cta: str,
    }),
  },
});

export const postBatchSchema = obj({
  title: str,
  posts: {
    type: "array",
    items: obj({
      variation: str,
      channel: str,
      hook: str,
      caption: str,
      hashtags: strArray,
      artDirection: str,
      cta: str,
    }),
  },
});

export const productRecsSchema = obj({
  title: str,
  summary: str,
  opportunities: {
    type: "array",
    items: obj({
      name: str,
      whatItIs: str,
      trendBasis: str, // tendência real (com fonte) que sustenta
      fitWithCapabilities: str, // por que dá para fazer com o que o cliente TEM
      howToStart: str,
      effort: str, // baixo/médio/alto
      potential: str,
    }),
  },
  repositioning: {
    type: "array",
    items: obj({ area: str, recommendation: str, why: str }),
  },
});

export type ProductRecs = {
  title: string;
  summary: string;
  opportunities: {
    name: string;
    whatItIs: string;
    trendBasis: string;
    fitWithCapabilities: string;
    howToStart: string;
    effort: string;
    potential: string;
  }[];
  repositioning: { area: string; recommendation: string; why: string }[];
};

export const visualIdentitySchema = obj({
  title: str,
  essence: str,
  slogans: strArray,
  logoConcepts: {
    type: "array",
    items: obj({ name: str, rationale: str, svg: str }),
  },
  palette: {
    type: "array",
    items: obj({ name: str, hex: str, usage: str }),
  },
  typography: {
    type: "array",
    items: obj({ role: str, font: str, alternative: str, notes: str }),
  },
  toneOfVoice: obj({ description: str, dos: strArray, donts: strArray }),
  applications: strArray,
});

export type StrategyAnalysis = {
  title: string;
  executiveSummary: string;
  marketTrends: { trend: string; implication: string; source: string }[];
  targetBuyers: {
    persona: string;
    profile: string;
    pains: string[];
    desires: string[];
    channels: string[];
    buyingTriggers: string;
  }[];
  competitors: {
    name: string;
    positioning: string;
    strengths: string[];
    weaknesses: string[];
    opportunity: string;
  }[];
  bestFits: { recommendation: string; why: string; priority: string }[];
  goals: { goal: string; metric: string; target: string; deadline: string }[];
};

export type MarketPulse = {
  title: string;
  summary: string;
  headlines: { headline: string; source: string; whatChanged: string; relevance: string }[];
  trendShifts: { trend: string; direction: string; action: string }[];
  recommendations: { recommendation: string; urgency: string; rationale: string }[];
  watchlist: string[];
};

export type CampaignPlan = {
  title: string;
  month: string;
  theme: string;
  summary: string;
  influencers: {
    name: string;
    platform: string;
    handle: string;
    profileUrl: string;
    followers: string;
    whyFit: string;
    contactEmail: string;
  }[];
  objectives: { objective: string; kpi: string; target: string }[];
  weeks: { week: number; focus: string; actions: string[] }[];
  channels: { channel: string; strategy: string; frequency: string }[];
  budget: { item: string; allocation: string; rationale: string }[];
  risks: string[];
};

export type RoiProjection = {
  title: string;
  summary: string;
  assumptions: string[];
  investment: { item: string; monthlyCost: string; notes: string }[];
  metrics: { metric: string; before: string; after: string; uplift: string }[];
  roi: {
    totalInvestment: string;
    projectedReturn: string;
    roiPercent: string;
    paybackPeriod: string;
    explanation: string;
  };
  roadmap: { phase: string; period: string; milestones: string[]; expectedImpact: string }[];
};

export type SocialCalendar = {
  title: string;
  month: string;
  strategySummary: string;
  posts: {
    day: number;
    channel: string;
    format: string;
    title: string;
    caption: string;
    hashtags: string[];
    artDirection: string;
    cta: string;
  }[];
};

export type PostBatch = {
  title: string;
  posts: {
    variation: string;
    channel: string;
    hook: string;
    caption: string;
    hashtags: string[];
    artDirection: string;
    cta: string;
  }[];
};

export type VisualIdentity = {
  title: string;
  essence: string;
  slogans: string[];
  logoConcepts: { name: string; rationale: string; svg: string }[];
  palette: { name: string; hex: string; usage: string }[];
  typography: { role: string; font: string; alternative: string; notes: string }[];
  toneOfVoice: { description: string; dos: string[]; donts: string[] };
  applications: string[];
};
