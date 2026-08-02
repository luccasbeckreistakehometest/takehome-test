export type ClientLanguage = "pt-BR" | "en";

export type Client = {
  id: string;
  name: string;
  industry: string;
  description: string;
  audience: string;
  tone: string;
  goals: string;
  budget: string;
  channels: string[];
  differentials: string;
  competitors: string;
  brandColors: string;
  website: string;
  instagram: string;
  notes: string;
  language: ClientLanguage;
  createdAt: string;
};

export type ClientInput = Omit<Client, "id" | "createdAt">;

export const GENERATION_TYPES = [
  "strategy_analysis",
  "market_pulse",
  "campaign_plan",
  "roi_projection",
  "social_calendar",
  "post_batch",
  "visual_identity",
  "landing_page",
] as const;

export type GenerationType = (typeof GENERATION_TYPES)[number];

export type Generation = {
  id: string;
  clientId: string;
  type: GenerationType;
  title: string;
  params: Record<string, unknown>;
  content: string;
  createdAt: string;
};

export const GENERATION_LABELS: Record<GenerationType, string> = {
  strategy_analysis: "Estratégia & Deep Dive",
  market_pulse: "Radar de mercado",
  campaign_plan: "Plano de campanha",
  roi_projection: "ROI & Roadmap",
  social_calendar: "Calendário social",
  post_batch: "Posts",
  visual_identity: "Identidade visual",
  landing_page: "Landing page",
};

// Ordem usada pelo "kit completo": estratégia primeiro, o resto se apoia nela
export const FULL_KIT_SEQUENCE: GenerationType[] = [
  "strategy_analysis",
  "campaign_plan",
  "roi_projection",
  "visual_identity",
  "social_calendar",
  "landing_page",
];

export const CHANNEL_OPTIONS = [
  "Instagram",
  "Facebook",
  "TikTok",
  "LinkedIn",
  "YouTube",
  "Google Ads",
  "Meta Ads",
  "E-mail",
  "Blog/SEO",
  "WhatsApp",
] as const;
