// Passos do tour guiado por papel (puro). Cada passo aponta para uma ou mais
// âncoras (data-tour) — vale a primeira visível; sem nenhuma visível (celular,
// seção fechada), o card aparece como folha inferior, sem destaque.

export type TourKind = "agency" | "brand" | "managed" | "professional";

export type TourStep = {
  anchors: string[];
  path: string; // "{ref}" = clientId/professionalId da sessão
  tab?: string; // aba do workspace que precisa estar aberta
  t: string;
  b: string;
};

// Agência: primeira volta curta; o resto fica em "Ver todos os diferenciais".
export const AGENCY_CORE_STEPS = 6;

const AGENCY: TourStep[] = [
  { anchors: ["nav-home"], path: "/", t: "Hoje", b: "Sua central: o que precisa de decisão agora — candidaturas, entregas para revisar, aprovações paradas, posts na hora." },
  { anchors: ["nav-clients"], path: "/", t: "Clientes", b: "Cada cliente tem briefing, kit de IA (estratégia, campanhas, identidade, social), pacote do mês, demandas e portal próprio." },
  { anchors: ["briefing-mode"], path: "/clients/new", t: "Briefing falado", b: "Aqui você pode falar em vez de digitar: a IA escuta, pergunta o que faltar e preenche o cadastro para você revisar." },
  { anchors: ["nav-production"], path: "/clients/new", t: "Produção", b: "Demandas em kanban: da abertura ao pagamento, com freelancers ou equipe interna." },
  { anchors: ["nav-insights"], path: "/clients/new", t: "Resultados", b: "Insights, horas e margem por cliente e as cobranças Pix do mês num lugar só." },
  { anchors: ["diff-scope"], path: "/", t: "Escopo e fatura", b: "Defina o pacote de cada cliente. Extra só entra com valor aprovado — e vai pra fatura Pix do mês." },
  // "Ver todos os diferenciais" — rodada 3 primeiro, depois os anteriores
  { anchors: ["diff-approval-link"], path: "/", t: "Aprovação por link", b: "No calendário, selecione os posts e toque em Enviar para aprovação. O cliente abre no celular, sem senha, aprova ou pede ajuste — e o histórico fica guardado." },
  { anchors: ["diff-invoice"], path: "/", t: "Fatura Pix sem taxa", b: "Em Resultados → Cobranças: a fatura sai com QR Pix da sua chave e lembrete pronto pro WhatsApp. O dinheiro cai direto na sua conta; você só confirma." },
  { anchors: ["diff-carousel"], path: "/", t: "Carrossel pronto", b: "Na aba Carrosséis de cada cliente (ou a partir de um post), a IA escreve os slides e eles saem com as cores e o logo da marca. Baixe as imagens ou agende." },
  { anchors: ["diff-bio"], path: "/", t: "Link na bio e cliques", b: "Cada cliente ganha uma página de links e links curtos por post. Você vê quais posts levam gente pro site — sem cookies." },
  { anchors: ["diff-radar"], path: "/", t: "Radar de IA", b: "Quando alguém pergunta pra uma IA pelo melhor negócio do ramo, seu cliente aparece? Uma rodada por semana mostra quem é citado e o que fazer." },
  { anchors: ["diff-panel"], path: "/", t: "Teste com o público", b: "Antes de agendar, compare 2 ou 3 versões do texto com as personas da estratégia. É uma simulação para descartar opções fracas; os cliques reais dizem se acertou." },
  { anchors: ["diff-report"], path: "/", t: "Relatório mensal em 1 clique", b: "Dentro de cada cliente, o botão Relatório mensal junta entregas, aprovações, posts, métricas e vendas do mês e a IA escreve o resumo — com link para o portal e para imprimir." },
  { anchors: ["diff-approval"], path: "/", t: "Aprovação que dispara ação", b: "Quando o cliente aprova uma peça no portal, ela vira rascunho no calendário e você recebe o aviso no WhatsApp. As regras ficam em Configurações." },
  { anchors: ["diff-attendant"], path: "/", t: "Atendente de WhatsApp com IA", b: "Na aba Atendente de cada cliente: rascunho ou automático, horário comercial, limite por contato e passagem para humano. Nunca inventa preço." },
  { anchors: ["diff-proposal"], path: "/", t: "Proposta pública em 5 minutos", b: "Em Crescimento → Prospecção, cada prospect ganha uma página com pitch, pacotes e prazo. Ele aceita sem login e já vira cliente com acesso ao portal." },
  { anchors: ["nav-calendar", "diff-calendar"], path: "/", t: "Calendário de conteúdo", b: "Semana ou mês por cliente, status com um clique e aviso dos dias sem conteúdo." },
  { anchors: ["diff-public-page"], path: "/", t: "Página pública da agência", b: "Em Configurações → Página pública você liga /a/sua-agencia: serviços, trabalhos que o cliente autorizou, clientes e depoimentos. O formulário vira prospect e avisa você no sino e no WhatsApp." },
  { anchors: ["diff-pulse"], path: "/", t: "Pulso do cliente e NPS", b: "No portal, o cliente responde 😞😐😀 depois de cada aprovação e uma vez por mês, e o NPS a cada trimestre. A Hoje mostra quem está em risco e o relatório mensal traz os números." },
  { anchors: ["diff-margin"], path: "/", t: "Horas e margem por cliente", b: "Na aba Horas de cada cliente você aponta tempo por demanda. Em Horas & margem, cada cliente aparece com fee, horas, custo, recebido e margem do mês — quem dá prejuízo fica em vermelho." },
  { anchors: ["diff-brand-voice"], path: "/", t: "Guardião da voz da marca", b: "No calendário e no atendente, o botão Checar voz da marca compara o texto com o briefing e as regras do cliente e dá uma nota de tom. Reescrever no tom corrige em 1 clique." },
  { anchors: ["diff-campaign"], path: "/", t: "Campanha de 30 dias", b: "Na aba 30 dias de cada cliente: objetivo, canais e data de início. A IA planeja as semanas e escreve cada post; tudo entra no calendário como rascunho nos dias livres." },
  { anchors: ["diff-learnings"], path: "/", t: "O que funciona pra este cliente", b: "No Dashboard de cada cliente, os posts publicados são cruzados com vendas, métricas e cliques dos dias seguintes: melhor formato, dia e horário e o que menos rende." },
];

const BRAND: TourStep[] = [
  { anchors: ["briefing-talk", "ws-group-overview"], path: "/clients/{ref}", tab: "dashboard", t: "Conte falando", b: "Toque em Falando e responda como numa conversa. Quando você para, a IA entende que é a vez dela." },
  { anchors: ["ws-tab-strategy_analysis", "ws-group-plan"], path: "/clients/{ref}", tab: "strategy_analysis", t: "Gere o seu kit", b: "Estratégia, campanha, identidade e ROI saem do seu briefing. O Kit completo faz tudo de uma vez." },
  { anchors: ["ws-tab-campaign30", "ws-group-plan"], path: "/clients/{ref}", tab: "campaign30", t: "Um mês de posts", b: "Escolha o objetivo e a IA escreve 30 dias de posts direto no calendário. Você aceita ou pula um a um." },
  { anchors: ["ws-tab-carousels", "ws-group-content"], path: "/clients/{ref}", tab: "carousels", t: "Carrossel pronto", b: "Da ideia ao carrossel com as cores e o logo da marca. É só baixar e postar." },
  { anchors: ["ws-tab-client_report", "ws-group-reports"], path: "/clients/{ref}", tab: "client_report", t: "O que funcionou", b: "Todo mês, um relatório com posts, cliques e vendas — e o que funciona pra sua marca." },
];

const MANAGED: TourStep[] = [
  { anchors: ["portal-deliverables"], path: "/portal/client/{ref}", t: "Aprovar", b: "Chegou um link? É só abrir, olhar e tocar em Aprovar. Pediu ajuste, a agência recebe na hora. Aqui no portal fica tudo o que está em produção." },
  { anchors: ["portal-scope"], path: "/portal/client/{ref}", t: "Seu pacote do mês", b: "Veja quanto do pacote já foi usado e peça uma produção. Se passar do combinado, o valor do extra chega para você aprovar antes." },
  { anchors: ["portal-invoices"], path: "/portal/client/{ref}", t: "Faturas", b: "As faturas da agência ficam aqui, com Pix copia e cola. Pagou? Toque em Já paguei e a agência confirma." },
  { anchors: ["portal-chat"], path: "/portal/client/{ref}", t: "Fale com a agência", b: "Mande mensagem para a agência e conte como está sendo — sua nota ajuda o time a melhorar." },
];

const PROFESSIONAL: TourStep[] = [
  { anchors: ["pro-portfolio", "pro-profile"], path: "/professionals/{ref}", t: "Portfólio", b: "Suba pelo menos 3 trabalhos. É isso que o match da IA olha antes de indicar você." },
  { anchors: ["pro-opportunities"], path: "/professionals/{ref}", t: "Oportunidades", b: "As demandas abertas na plataforma aparecem aqui, com verba e prazo." },
  { anchors: ["pro-opportunities"], path: "/professionals/{ref}", t: "Candidatura", b: "Toque em Candidatar-se e mande uma mensagem curta. O status da candidatura fica ao lado da demanda." },
  { anchors: ["pro-projects"], path: "/professionals/{ref}", t: "Entrega com marcações", b: "Aceita, a demanda aparece em Minhas demandas. Suba a entrega; a agência revisa com marcações direto na imagem." },
  { anchors: ["pro-earnings", "pro-profile"], path: "/professionals/{ref}", t: "Ganhos e elo", b: "Veja o que tem a receber e o que já foi pago. Entregas bem avaliadas sobem o seu elo — e a sua visibilidade." },
];

export const STEPS_BY_ROLE: Record<TourKind, TourStep[]> = {
  agency: AGENCY,
  brand: BRAND,
  managed: MANAGED,
  professional: PROFESSIONAL,
};

export function tourKind(session: { role?: string | null; selfServe?: boolean; refId?: string | null } | null): TourKind | null {
  if (!session) return null;
  if (session.role === "agency") return "agency";
  if (session.role === "client" && session.refId) return session.selfServe ? "brand" : "managed";
  if (session.role === "professional" && session.refId) return "professional";
  return null;
}

export function stepPath(step: TourStep, ref: string | null | undefined): string {
  return step.path.replace("{ref}", encodeURIComponent(ref ?? ""));
}

// Quantos passos a pessoa vê de uma vez: a agência para no 6º (a não ser que
// peça para ver todos); os outros papéis veem a lista inteira.
export function visibleTotal(kind: TourKind, step: number): number {
  const all = STEPS_BY_ROLE[kind].length;
  if (kind !== "agency") return all;
  return step < AGENCY_CORE_STEPS ? AGENCY_CORE_STEPS : all;
}

export function isLastStep(kind: TourKind, step: number): boolean {
  return step >= visibleTotal(kind, step) - 1;
}

export function canShowMore(kind: TourKind, step: number): boolean {
  return kind === "agency" && step === AGENCY_CORE_STEPS - 1 && STEPS_BY_ROLE.agency.length > AGENCY_CORE_STEPS;
}

// Onde pôr o card: abaixo da âncora, acima dela, ou como folha inferior
// (celular, âncora ausente ou alta demais).
export type CardPlacement = { mode: "sheet" } | { mode: "below"; top: number; left: number } | { mode: "above"; bottom: number; left: number };

export function cardPlacement(
  rect: { top: number; left: number; width: number; height: number } | null,
  viewport: { width: number; height: number },
  card: { width: number; height: number } = { width: 360, height: 240 }
): CardPlacement {
  if (!rect || viewport.width < 640) return { mode: "sheet" };
  const left = Math.max(12, Math.min(rect.left, viewport.width - card.width - 12));
  const below = rect.top + rect.height + 12;
  if (below + card.height <= viewport.height - 12) return { mode: "below", top: below, left };
  if (rect.top - 12 - card.height >= 12) return { mode: "above", bottom: viewport.height - rect.top + 12, left };
  return { mode: "sheet" };
}
