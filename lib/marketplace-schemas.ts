// Schemas de structured outputs das features de marketplace/prospecção.

const str = { type: "string" } as const;
const strArray = { type: "array", items: { type: "string" } } as const;
const int = { type: "integer" } as const;

function obj(
  properties: Record<string, unknown>,
  required = Object.keys(properties)
) {
  return { type: "object", properties, required, additionalProperties: false };
}

export const matchSchema = obj({
  summary: str,
  matches: {
    type: "array",
    items: obj({
      professionalId: str,
      name: str,
      fit: int, // 0-100: propensão a entregar resultado para ESTE cliente
      reasons: strArray,
      gaps: strArray,
      suggestedBrief: str,
    }),
  },
});

export type MatchResult = {
  summary: string;
  matches: {
    professionalId: string;
    name: string;
    fit: number;
    reasons: string[];
    gaps: string[];
    suggestedBrief: string;
  }[];
};

export const artReviewSchema = obj({
  overallScore: int,
  verdict: str,
  criteria: {
    type: "array",
    items: obj({ criterion: str, score: int, comment: str }),
  },
  campaignFit: obj({ score: int, comment: str }),
  strengths: strArray,
  improvements: strArray,
  revisionNotes: strArray,
});

export type ArtReviewContent = {
  overallScore: number;
  verdict: string;
  criteria: { criterion: string; score: number; comment: string }[];
  campaignFit: { score: number; comment: string };
  strengths: string[];
  improvements: string[];
  revisionNotes: string[];
};

export const prospectingSchema = obj({
  summary: str,
  prospects: {
    type: "array",
    items: obj({
      name: str,
      segment: str,
      location: str,
      website: str,
      instagram: str,
      whyFit: str,
      marketingMaturity: str,
      suggestedApproach: str,
    }),
  },
});

export type ProspectingResult = {
  summary: string;
  prospects: {
    name: string;
    segment: string;
    location: string;
    website: string;
    instagram: string;
    whyFit: string;
    marketingMaturity: string;
    suggestedApproach: string;
  }[];
};

export const ideasSchema = obj({
  summary: str,
  ideas: {
    type: "array",
    items: obj({
      title: str,
      description: str,
      trendBasis: str, // tendência/dado real que sustenta a ideia
      action: str, // próximo passo concreto
      linkedTo: str, // cliente/profissional da plataforma relacionado ("" se nenhum)
      priority: str,
    }),
  },
});

export type IdeasResult = {
  summary: string;
  ideas: {
    title: string;
    description: string;
    trendBasis: string;
    action: string;
    linkedTo: string;
    priority: string;
  }[];
};

export const clientReportSchema = obj({
  title: str,
  period: str,
  executiveSummary: str,
  highlights: strArray,
  workstreams: {
    type: "array",
    items: obj({ area: str, status: str, detail: str }),
  },
  qualityOverview: str,
  nextSteps: strArray,
  risks: strArray,
});

export type ClientReport = {
  title: string;
  period: string;
  executiveSummary: string;
  highlights: string[];
  workstreams: { area: string; status: string; detail: string }[];
  qualityOverview: string;
  nextSteps: string[];
  risks: string[];
};
