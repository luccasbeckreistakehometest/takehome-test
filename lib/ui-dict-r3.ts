// Dicionário PT→EN da rodada 3 (mesma regra do ui-dict: correspondência exata
// com o texto da interface). Separado só para não inchar o arquivo principal.
export const UI_DICT_R3: Record<string, string> = {
  // Navegação consolidada
  "Crescimento": "Growth",
  "Mais": "More",
  "Conteúdo": "Content",
  "Visão geral": "Overview",
  "Plano": "Plan",
  "Operação": "Operations",
  "Radar do mercado": "Market radar",
  "Insights": "Insights",
  "Propostas": "Proposals",
  "Página pública": "Public page",
  "Navegação": "Navigation",
  "Seções do cliente": "Client sections",
  "Abas da seção": "Section tabs",
  "Aba do workspace": "Workspace tab",
  "Onde a agência encontra cliente novo e vende mais para quem já está com você.":
    "Where your agency finds new clients and sells more to the ones you already have.",
  "A IA procura empresas do seu nicho e região, com motivo e primeira mensagem para cada uma.":
    "The AI finds businesses in your niche and region, each with a reason and a first message.",
  "Buscar prospects": "Find prospects",
  "Nenhum prospect ainda": "No prospects yet",
  "Uma página com pitch, pacotes e prazo. O prospect aceita sem login e já vira cliente.":
    "A page with the pitch, packages and deadline. The prospect accepts without logging in and becomes a client.",
  "Criar proposta": "Create a proposal",
  "Serviços, trabalhos e depoimentos no seu endereço. O formulário vira prospect e avisa você.":
    "Services, work and testimonials at your own address. The form turns into a prospect and alerts you.",
  "Configurar página": "Set up the page",
  "Ainda não publicada": "Not published yet",
};

export const UI_REGEX_R3: [RegExp, string][] = [
  [/^(\d+) prospects salvos$/, "$1 saved prospects"],
  [/^(\d+) em aberto · (\d+) aceitas$/, "$1 open · $2 accepted"],
  [/^Publicada · (\d+) pedidos recebidos$/, "Published · $1 requests received"],
];
