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
  // Admin: custos, teto e LGPD
  "Custos de IA": "AI costs",
  "Margem por conta (30 dias)": "Margin per account (30 days)",
  "Custo por ação e modelo (30 dias)": "Cost per action and model (30 days)",
  "Sem receita nem uso de IA nos últimos 30 dias.": "No revenue or AI usage in the last 30 days.",
  "Nenhum uso de IA registrado.": "No AI usage recorded.",
  "Receita": "Revenue",
  "Custo IA": "AI cost",
  "Margem": "Margin",
  "Chamadas": "Calls",
  "Buscas": "Searches",
  "Ação": "Action",
  "Modelo": "Model",
  "Salvar teto": "Save cap",
  "Teto de IA salvo.": "AI cap saved.",
  "vazio = padrão do plano": "empty = plan default",
  "Dados pessoais (LGPD)": "Personal data (LGPD)",
  "Exportar dados da conta": "Export account data",
  "Excluir conta": "Delete account",
  "Para excluir, digite": "To delete, type",
  "Conta excluída. Lançamentos financeiros ficam sem vínculo pessoal.": "Account deleted. Financial records stay without any personal link.",
  "A exclusão apaga a conta e o que é só dela; pagamentos e custos ficam para a contabilidade, sem vínculo com a pessoa.":
    "Deleting removes the account and what belongs only to it; payments and costs stay for accounting, with no link to the person.",
  "Escreva o motivo da concessão.": "Write the reason for the grant.",
  "Digite o nome de usuário exato para confirmar.": "Type the exact username to confirm.",
  "Use Minha conta para excluir a própria conta.": "Use My account to delete your own account.",
  "Esta conta não usa IA.": "This account doesn't use AI.",
};

export const UI_REGEX_R3: [RegExp, string][] = [
  [/^Teto diário de IA \(US\$\) · hoje (.+) de sem teto próprio$/, "Daily AI cap (US$) · today $1, no cap of its own"],
  [/^Teto diário de IA \(US\$\) · hoje (.+) de (.+)$/, "Daily AI cap (US$) · today $1 of $2"],

  [/^(\d+) prospects salvos$/, "$1 saved prospects"],
  [/^(\d+) em aberto · (\d+) aceitas$/, "$1 open · $2 accepted"],
  [/^Publicada · (\d+) pedidos recebidos$/, "Published · $1 requests received"],
];
