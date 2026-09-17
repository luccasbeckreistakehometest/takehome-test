// Abas do workspace do cliente, agrupadas em 5 seções (puro, sem React).
// A URL continua aceitando ?tab=<chave> de qualquer aba: o grupo é resolvido
// a partir da chave, então links antigos seguem abrindo o mesmo conteúdo.

export const TAB_KEYS = [
  "dashboard",
  "briefing",
  "package",
  "strategy_analysis",
  "market_pulse",
  "ai_radar",
  "campaign_plan",
  "campaign30",
  "roi_projection",
  "product_recs",
  "social_calendar",
  "post_batch",
  "carousels",
  "visual_identity",
  "bio",
  "landing_page",
  "projects",
  "attendant",
  "time",
  "sales",
  "client_report",
  "invoices",
] as const;

export type TabKey = (typeof TAB_KEYS)[number];

export type TabGroupKey = "overview" | "plan" | "content" | "ops" | "reports";

export type TabDef = {
  key: TabKey;
  label: string;
  // só agência/admin (a marca não vê, nem autônoma)
  agencyOnly?: boolean;
  // só aparece com a flag de landing pages ligada
  needsLanding?: boolean;
};

export const TAB_GROUPS: { key: TabGroupKey; label: string; tabs: TabDef[] }[] = [
  {
    key: "overview",
    label: "Visão geral",
    tabs: [
      { key: "dashboard", label: "Dashboard" },
      { key: "briefing", label: "Briefing" },
      { key: "package", label: "Pacote", agencyOnly: true },
    ],
  },
  {
    key: "plan",
    label: "Plano",
    tabs: [
      { key: "strategy_analysis", label: "Estratégia" },
      { key: "market_pulse", label: "Radar do mercado" },
      { key: "ai_radar", label: "Radar de IA" },
      { key: "campaign_plan", label: "Campanha" },
      { key: "campaign30", label: "30 dias" },
      { key: "roi_projection", label: "ROI & Roadmap" },
      { key: "product_recs", label: "Ofertas" },
    ],
  },
  {
    key: "content",
    label: "Conteúdo",
    tabs: [
      { key: "social_calendar", label: "Social" },
      { key: "post_batch", label: "Posts" },
      { key: "carousels", label: "Carrosséis" },
      { key: "visual_identity", label: "Identidade" },
      { key: "bio", label: "Link na bio" },
      { key: "landing_page", label: "Landing pages", needsLanding: true },
    ],
  },
  {
    key: "ops",
    label: "Operação",
    tabs: [
      { key: "projects", label: "Demandas" },
      { key: "attendant", label: "Atendente", agencyOnly: true },
      { key: "time", label: "Horas", agencyOnly: true },
      { key: "sales", label: "Vendas & Dados" },
    ],
  },
  {
    key: "reports",
    label: "Relatórios",
    tabs: [
      { key: "client_report", label: "Relatório executivo" },
      { key: "invoices", label: "Cobranças", agencyOnly: true },
    ],
  },
];

export function isTabKey(value: unknown): value is TabKey {
  return typeof value === "string" && (TAB_KEYS as readonly string[]).includes(value);
}

export function groupOfTab(key: TabKey): TabGroupKey {
  const group = TAB_GROUPS.find((g) => g.tabs.some((t) => t.key === key));
  return group ? group.key : "overview";
}

export type TabViewer = { viewerRole: string; landingEnabled: boolean };

function tabAllowed(tab: TabDef, viewer: TabViewer): boolean {
  if (tab.agencyOnly && viewer.viewerRole === "client") return false;
  if (tab.needsLanding && !viewer.landingEnabled) return false;
  return true;
}

// Grupos com as abas que este visitante vê (grupo vazio some).
export function visibleGroups(viewer: TabViewer): { key: TabGroupKey; label: string; tabs: TabDef[] }[] {
  return TAB_GROUPS.map((g) => ({ ...g, tabs: g.tabs.filter((t) => tabAllowed(t, viewer)) })).filter((g) => g.tabs.length > 0);
}

// Resolve o ?tab= da URL: chave válida e visível → ela; senão o Dashboard.
export function resolveTab(raw: string | null | undefined, viewer: TabViewer): { tab: TabKey; group: TabGroupKey } {
  if (isTabKey(raw)) {
    const def = TAB_GROUPS.flatMap((g) => g.tabs).find((t) => t.key === raw);
    if (def && tabAllowed(def, viewer)) return { tab: raw, group: groupOfTab(raw) };
  }
  return { tab: "dashboard", group: "overview" };
}
