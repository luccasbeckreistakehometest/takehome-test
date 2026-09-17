// Primeiros passos por papel (puro): o que conta como "feito" vem de dados
// reais da conta, não de cliques no checklist.

export const BRIEFING_KEYS = ["name", "industry", "description", "audience", "goals", "tone", "channels"] as const;

export function briefingCompleteness(client: {
  name?: string;
  industry?: string;
  description?: string;
  audience?: string;
  goals?: string;
  tone?: string;
  channels?: string[];
}): number {
  const filled = BRIEFING_KEYS.filter((key) => {
    const value = client[key];
    return Array.isArray(value) ? value.length > 0 : typeof value === "string" && value.trim().length >= 3;
  }).length;
  return Math.round((filled / BRIEFING_KEYS.length) * 100);
}

export const BRIEFING_READY_PCT = 60;

export type ActivationRole = "brand" | "managed" | "professional" | "agency";

export type ActivationFacts = {
  briefingPct?: number;
  generations?: number;
  scheduledPosts?: number;
  carousels?: number;
  reports?: number;
  approvals?: number; // decisões do cliente (portal ou link)
  pulseAnswers?: number;
  invoicesSeen?: number;
  messagesSent?: number;
  portfolioAssets?: number;
  applications?: number;
  profileComplete?: boolean;
  deliveries?: number;
  clients?: number;
  brandingSet?: boolean;
  pagePublished?: boolean;
  invites?: number;
  packages?: number;
  requests?: number; // pedidos de produção feitos pelo cliente
};

export type ActivationStep = { key: string; label: string; hint: string; href: string; done: boolean };

const n = (v: number | undefined) => v ?? 0;

export function activationSteps(role: ActivationRole, f: ActivationFacts, ids: { clientId?: string; professionalId?: string } = {}): ActivationStep[] {
  const ws = ids.clientId ? `/clients/${ids.clientId}` : "/";
  const portal = ids.clientId ? `/portal/client/${ids.clientId}` : "/";
  const pro = ids.professionalId ? `/professionals/${ids.professionalId}` : "/";
  if (role === "brand") {
    return [
      { key: "briefing", label: "Conte sobre a marca", hint: "Falando ou escrevendo: é daqui que a IA tira tudo.", href: `${ws}?tab=briefing`, done: n(f.briefingPct) >= BRIEFING_READY_PCT },
      { key: "kit", label: "Gere a primeira peça com IA", hint: "Estratégia, calendário ou posts.", href: `${ws}?tab=strategy_analysis`, done: n(f.generations) > 0 },
      { key: "calendar", label: "Coloque um post na agenda", hint: "Use os 30 dias ou crie à mão.", href: `${ws}?tab=campaign30`, done: n(f.scheduledPosts) > 0 },
      { key: "carousel", label: "Monte um carrossel", hint: "Pronto para baixar e postar.", href: `${ws}?tab=carousels`, done: n(f.carousels) > 0 },
      { key: "report", label: "Veja o que funcionou", hint: "Relatório do mês com os números da marca.", href: `${ws}/report`, done: n(f.reports) > 0 },
    ];
  }
  if (role === "managed") {
    return [
      { key: "approve", label: "Aprove uma peça", hint: "Pelo portal ou pelo link que a agência mandar.", href: `${portal}#producoes`, done: n(f.approvals) > 0 },
      { key: "request", label: "Peça uma produção", hint: "O pacote do mês mostra o que já foi usado e o que vira extra.", href: `${portal}#pacote`, done: n(f.requests) > 0 },
      { key: "invoice", label: "Abra uma fatura", hint: "Pix direto para a agência, com copia e cola.", href: `${portal}#faturas`, done: n(f.invoicesSeen) > 0 },
      { key: "talk", label: "Fale com a agência", hint: "Uma mensagem ou a nota de como está sendo.", href: `${portal}#conversa`, done: n(f.messagesSent) + n(f.pulseAnswers) > 0 },
    ];
  }
  if (role === "professional") {
    return [
      { key: "profile", label: "Complete o perfil", hint: "Bio, habilidades e cidade.", href: pro, done: Boolean(f.profileComplete) },
      { key: "portfolio", label: "Suba 3 trabalhos", hint: "É isso que o match da IA olha antes de indicar você.", href: `${pro}#portfolio`, done: n(f.portfolioAssets) >= 3 },
      { key: "apply", label: "Candidate-se a uma demanda", hint: "Uma mensagem curta basta.", href: `${pro}#oportunidades`, done: n(f.applications) > 0 },
      { key: "deliver", label: "Faça a primeira entrega", hint: "A agência revisa com marcações na imagem.", href: `${pro}#demandas`, done: n(f.deliveries) > 0 },
    ];
  }
  return [
    { key: "client", label: "Cadastre o primeiro cliente", hint: "Digite ou fale o briefing.", href: "/clients/new", done: n(f.clients) > 0 },
    { key: "branding", label: "Coloque a sua marca", hint: "Nome, cor e logo no portal dos clientes.", href: "/settings", done: Boolean(f.brandingSet) },
    { key: "package", label: "Defina o pacote de um cliente", hint: "Extra só entra com valor aprovado.", href: "/clients", done: n(f.packages) > 0 },
    { key: "page", label: "Publique sua página", hint: "Receba pedidos pelo seu endereço.", href: "/settings#pagina-publica", done: Boolean(f.pagePublished) },
    { key: "invite", label: "Chame o time e os clientes", hint: "Cada convite entra direto no seu espaço.", href: "/settings#convites", done: n(f.invites) > 0 },
  ];
}

export function activationProgress(steps: ActivationStep[]): { done: number; total: number; pct: number; complete: boolean } {
  const done = steps.filter((s) => s.done).length;
  return { done, total: steps.length, pct: steps.length ? Math.round((done / steps.length) * 100) : 0, complete: done === steps.length };
}
