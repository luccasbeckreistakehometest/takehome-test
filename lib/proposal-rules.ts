// Regras PURAS da proposta pública: validade por token, estado (aberta /
// aceita / expirada), fixture determinística. Sem banco, sem rede.

export type ProposalPackage = {
  name: string;
  price: number; // na moeda da proposta
  period: string; // "mês" | "projeto" | "month" | "project"
  items: string[];
  recommended: boolean;
};

export type ProposalContent = {
  headline: string;
  pitch: string;
  painPoints: string[];
  scope: string[];
  packages: ProposalPackage[];
  timeline: { phase: string; weeks: string; deliverables: string[] }[];
  nextSteps: string[];
  validityNote: string;
};

export type ProposalStatus = "sent" | "viewed" | "accepted" | "expired";
export type ProposalState = "open" | "accepted" | "expired";

export const DEFAULT_PROPOSAL_DAYS = 14;

export function expiryFromNow(now: Date, days: number): string {
  const safeDays = Number.isFinite(days) ? Math.min(90, Math.max(1, Math.round(days))) : DEFAULT_PROPOSAL_DAYS;
  return new Date(now.getTime() + safeDays * 24 * 60 * 60 * 1000).toISOString();
}

export function isProposalExpired(
  proposal: { expiresAt: string; status: ProposalStatus },
  now: Date = new Date()
): boolean {
  if (proposal.status === "accepted") return false;
  return proposal.expiresAt <= now.toISOString();
}

export function proposalState(
  proposal: { expiresAt: string; status: ProposalStatus },
  now: Date = new Date()
): ProposalState {
  if (proposal.status === "accepted") return "accepted";
  if (isProposalExpired(proposal, now)) return "expired";
  return "open";
}

export type AcceptCheck = { ok: true } | { ok: false; reason: "accepted" | "expired" | "unknown_package" };

export function canAccept(
  proposal: { expiresAt: string; status: ProposalStatus; content: { packages: ProposalPackage[] } },
  packageName: string,
  now: Date = new Date()
): AcceptCheck {
  const state = proposalState(proposal, now);
  if (state === "accepted") return { ok: false, reason: "accepted" };
  if (state === "expired") return { ok: false, reason: "expired" };
  if (!proposal.content.packages.some((p) => p.name === packageName)) return { ok: false, reason: "unknown_package" };
  return { ok: true };
}

export function validityLabel(expiresAt: string, lang: "pt-BR" | "en"): string {
  const date = new Date(expiresAt).toLocaleDateString(lang === "en" ? "en-US" : "pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  return lang === "en" ? `Valid until ${date}` : `Válida até ${date}`;
}

// Fixture (AI_MOCK=1): proposta coerente montada a partir do prospect.
export function mockProposalContent(input: {
  prospectName: string;
  segment: string;
  location: string;
  whyFit: string;
  marketingMaturity: string;
  agencyName: string;
  lang: "pt-BR" | "en";
  services: string;
}): ProposalContent {
  const seg = input.segment || (input.lang === "en" ? "your business" : "seu negócio");
  if (input.lang === "en") {
    return {
      headline: `A 90-day growth plan for ${input.prospectName}`,
      pitch: `${input.prospectName} already has what most competitors in ${seg} lack: a real product people come back for. What is missing is a consistent presence where customers decide — and that is exactly what ${input.agencyName} sets up in the first weeks. ${input.whyFit ? `We noticed: ${input.whyFit}` : ""} [demo]`,
      painPoints: [
        input.marketingMaturity || "Irregular social presence, no calendar",
        "No clear offer to bring first-time customers in",
        "Results are not measured, so spend is guesswork",
      ],
      scope: ["Brand and offer positioning", "Monthly content calendar with ready captions", "Paid social setup and weekly optimisation", "WhatsApp attendant with AI, 24/7", "Monthly report with the numbers that matter"],
      packages: [
        { name: "Essential", price: 1500, period: "month", items: ["8 posts/month", "Monthly calendar", "Monthly report"], recommended: false },
        { name: "Growth", price: 2900, period: "month", items: ["12 posts + 4 reels/month", "Paid social management", "AI WhatsApp attendant", "Monthly report"], recommended: true },
        { name: "Full", price: 4900, period: "month", items: ["Everything in Growth", "Photo shoot every month", "Landing page + lead capture", "Weekly check-in"], recommended: false },
      ],
      timeline: [
        { phase: "Foundation", weeks: "Weeks 1-2", deliverables: ["Briefing and strategy", "Visual identity check", "Channel setup"] },
        { phase: "Traction", weeks: "Weeks 3-8", deliverables: ["Content live", "First campaigns", "Attendant answering"] },
        { phase: "Scale", weeks: "Weeks 9-12", deliverables: ["Optimise what works", "Second offer", "Quarter report"] },
      ],
      nextSteps: ["Pick a package and accept below", "We schedule a 30-minute kickoff", "Your client portal opens the same day"],
      validityNote: input.services ? `Pricing based on: ${input.services.slice(0, 120)}` : "Reference pricing for a small business; adjusted after the kickoff.",
    };
  }
  return {
    headline: `Plano de crescimento de 90 dias para ${input.prospectName}`,
    pitch: `A ${input.prospectName} já tem o que a maioria dos concorrentes em ${seg} não tem: um produto de verdade, que faz o cliente voltar. O que falta é presença constante onde o cliente decide — e é exatamente isso que a ${input.agencyName} monta nas primeiras semanas. ${input.whyFit ? `O que a gente viu: ${input.whyFit}` : ""} [demo]`,
    painPoints: [
      input.marketingMaturity || "Presença irregular nas redes, sem calendário",
      "Nenhuma oferta clara para trazer o cliente de primeira vez",
      "Resultado não medido: a verba vira chute",
    ],
    scope: ["Posicionamento da marca e da oferta", "Calendário de conteúdo mensal com legendas prontas", "Tráfego pago configurado e otimizado toda semana", "Atendente de WhatsApp com IA, 24/7", "Relatório mensal com os números que importam"],
    packages: [
      { name: "Essencial", price: 1500, period: "mês", items: ["8 posts/mês", "Calendário mensal", "Relatório mensal"], recommended: false },
      { name: "Crescimento", price: 2900, period: "mês", items: ["12 posts + 4 reels/mês", "Gestão de tráfego pago", "Atendente de WhatsApp com IA", "Relatório mensal"], recommended: true },
      { name: "Completo", price: 4900, period: "mês", items: ["Tudo do Crescimento", "Ensaio de fotos todo mês", "Landing page + captação de leads", "Reunião semanal"], recommended: false },
    ],
    timeline: [
      { phase: "Fundação", weeks: "Semanas 1-2", deliverables: ["Briefing e estratégia", "Revisão da identidade visual", "Canais configurados"] },
      { phase: "Tração", weeks: "Semanas 3-8", deliverables: ["Conteúdo no ar", "Primeiras campanhas", "Atendente respondendo"] },
      { phase: "Escala", weeks: "Semanas 9-12", deliverables: ["Otimizar o que funciona", "Segunda oferta", "Relatório do trimestre"] },
    ],
    nextSteps: ["Escolha um pacote e aceite abaixo", "A gente marca um kickoff de 30 minutos", "Seu portal de cliente abre no mesmo dia"],
    validityNote: input.services ? `Valores com base em: ${input.services.slice(0, 120)}` : "Valores de referência para pequeno negócio; ajustados depois do kickoff.",
  };
}
