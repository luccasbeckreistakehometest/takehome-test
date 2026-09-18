import type { IconName } from "@/components/icons";

// Navegação da agência (pura): 7 itens principais + "Mais". `match` lista os
// caminhos que acendem o item (a Agenda junta calendário de conteúdo e
// reuniões; Resultados junta insights, margem e cobranças).
export type NavItem = { href: string; label: string; icon: IconName; tour: string; match?: string[] };

export const AGENCY_PRIMARY_NAV: NavItem[] = [
  { href: "/", label: "Hoje", icon: "home", tour: "nav-home" },
  { href: "/clients", label: "Clientes", icon: "briefcase", tour: "nav-clients" },
  { href: "/production", label: "Produção", icon: "kanban", tour: "nav-production" },
  { href: "/calendar", label: "Agenda", icon: "calendar", tour: "nav-calendar", match: ["/calendar", "/agenda"] },
  { href: "/growth", label: "Crescimento", icon: "trend", tour: "nav-growth", match: ["/growth", "/prospecting", "/links", "/radar"] },
  { href: "/messages", label: "Mensagens", icon: "message", tour: "nav-messages" },
  { href: "/insights", label: "Resultados", icon: "chart", tour: "nav-insights", match: ["/insights", "/finance", "/invoices"] },
];

export const AGENCY_MORE_NAV: NavItem[] = [
  { href: "/professionals", label: "Profissionais", icon: "users", tour: "nav-professionals" },
  { href: "/ideas", label: "Ideias", icon: "lightbulb", tour: "nav-ideas" },
  { href: "/assistant", label: "Assistente", icon: "sparkle", tour: "nav-assistant" },
  { href: "/treinamento", label: "Treinamento", icon: "doc", tour: "nav-training" },
  { href: "/plans", label: "Planos", icon: "money", tour: "nav-plans" },
];

// Grupos do trilho lateral (§4.1B). A lista acima continua sendo a fonte da
// verdade — aqui só se diz em que bloco cada item mora, para o trilho ter
// hierarquia em vez de doze linhas iguais.
const primaryByHref = (href: string): NavItem => {
  const found = AGENCY_PRIMARY_NAV.find((item) => item.href === href);
  if (!found) throw new Error(`nav: item ${href} não existe em AGENCY_PRIMARY_NAV`);
  return found;
};

export const AGENCY_NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  { label: "Operação", items: ["/", "/clients", "/production", "/calendar"].map(primaryByHref) },
  { label: "Crescimento", items: ["/growth", "/messages", "/insights"].map(primaryByHref) },
];

function pathMatches(pathname: string, prefix: string): boolean {
  if (prefix === "/") return pathname === "/";
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function navItemActive(item: NavItem, pathname: string): boolean {
  return (item.match ?? [item.href]).some((p) => pathMatches(pathname, p));
}

// Abas de páginas irmãs (a URL continua sendo a de cada página).
export type SectionTab = { href: string; label: string; testId: string };

export const AGENDA_TABS: SectionTab[] = [
  { href: "/calendar", label: "Conteúdo", testId: "agenda-tab-content" },
  { href: "/agenda", label: "Reuniões", testId: "agenda-tab-meetings" },
];

export const RESULTS_TABS: SectionTab[] = [
  { href: "/insights", label: "Insights", testId: "results-tab-insights" },
  { href: "/finance", label: "Horas & margem", testId: "results-tab-finance" },
  { href: "/invoices", label: "Cobranças", testId: "results-tab-invoices" },
];
