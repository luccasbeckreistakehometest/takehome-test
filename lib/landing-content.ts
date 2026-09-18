import type { IconName } from "@/components/icons";
import type { AccountType } from "@/lib/plans";

export type Lang = "pt" | "en";

// Mini-ilustrações da vitrine (componentes em components/landing/ShowcaseDemo).
export type ShowcaseDemo = "approval" | "carousel" | "voice" | "radar" | "scope" | "invoice" | "bio" | "panel" | "portfolio" | "markup" | "tier";

export type Showcase = {
  title: string;
  sub: string;
  items: { demo: ShowcaseDemo; icon: IconName; t: string; d: string; href: string; cta: string }[];
};
export type Timeline = { title: string; sub: string; steps: { when: string; t: string }[] };
export type Compare = { title: string; head: [string, string, string]; rows: [string, string, string][] };

export type LandingConfig = {
  signupType: "client" | "professional" | "agency" | null;
  pricingType: AccountType | null;
  showAudienceCards?: boolean;
  content: Record<
    Lang,
    {
      eyebrow: string;
      h1a: string;
      h1b: string;
      sub: string;
      ctaPrimary: string;
      ctaSecondary: string;
      trust: string;
      stats: { n: number; suf: string; label: string }[];
      problemTitle: string;
      problems: string[];
      solution: string;
      benefitsTitle: string;
      benefitsSub: string;
      benefits: { icon: IconName; t: string; d: string }[];
      howTitle: string;
      how: { icon: IconName; t: string; d: string }[];
      showcase?: Showcase;
      timeline?: Timeline;
      compare?: Compare;
      audienceTitle?: string;
      audiences?: { icon: IconName; t: string; d: string; href: string; cta: string }[];
      faqTitle: string;
      faq: { q: string; a: string }[];
      finalEyebrow: string;
      finalTitle: string;
      finalSub: string;
      ctaFinal: string;
    }
  >;
};

// ==================== GERAL (/) ====================
export const GENERAL: LandingConfig = {
  signupType: null,
  pricingType: null,
  showAudienceCards: true,
  content: {
    pt: {
      eyebrow: "Central de marketing com IA",
      h1a: "Semanas de marketing,",
      h1b: "entregues em minutos.",
      sub: "A Marqa conecta agência, marca e profissionais numa só plataforma — com a marca da agência para os clientes dela — e gera estratégia, campanhas, identidade e conteúdo com IA e pesquisa real de mercado.",
      ctaPrimary: "Criar conta grátis",
      ctaSecondary: "Escolher meu caminho",
      trust: "Sem cartão para começar · Assinatura no cartão: cancele quando quiser",
      stats: [
        { n: 9, suf: "", label: "entregáveis de IA por cliente" },
        { n: 3, suf: "", label: "públicos numa só plataforma" },
        { n: 30, suf: "", label: "dias de posts planejados de uma vez" },
      ],
      problemTitle: "Marketing bom trava sempre nos mesmos gargalos",
      problems: [
        "Estratégia leva semanas — e sai cara.",
        "Conteúdo atrasa e o calendário fica vazio.",
        "Encontrar (e pagar) bons profissionais é um caos.",
        "Ninguém prova o retorno do que foi investido.",
      ],
      solution:
        "A Marqa resolve os quatro de uma vez: IA que cria com pesquisa real, produção organizada do brief à aprovação do cliente, e relatório com dados de venda pra provar o resultado.",
      benefitsTitle: "Tudo que uma operação de marketing precisa",
      benefitsSub: "Um kit completo por cliente, mais o ecossistema para produzir e vender.",
      benefits: [
        { icon: "radar", t: "Estratégia com pesquisa real", d: "Deep dive de mercado: tendências, personas, concorrentes e metas SMART." },
        { icon: "megaphone", t: "Campanhas prontas", d: "Plano acionável com canais, mensagens e influenciadores reais." },
        { icon: "palette", t: "Identidade visual", d: "Conceitos de marca, paleta e direção de arte no tom certo." },
        { icon: "calendar", t: "Social & posts", d: "Calendário completo, posts prontos (feed, Stories, Reels, carrossel) e link na bio com cliques por destino." },
        { icon: "target", t: "Painel de público e voz da marca", d: "Antes de publicar: o texto testado com as personas da estratégia e um guardião que segura o que foge da voz da marca." },
        { icon: "users", t: "Marketplace de profissionais", d: "Match por IA de fotógrafos e designers, com o status de cada etapa até a aprovação." },
        { icon: "message", t: "WhatsApp & Instagram", d: "Pela API oficial: listas, agendamento e um atendente que rascunha respostas no tom da marca." },
        { icon: "chart", t: "Relatório mensal & vendas", d: "Relatório do mês com leitura da IA, pulso e NPS do cliente, vendas reais (GA4, Meta Ads, loja) e o que funciona em cada marca." },
        { icon: "layers", t: "Com a marca da agência", d: "Logo, cores e nome da agência para os clientes e profissionais que ela convida." },
      ],
      howTitle: "Do briefing ao pronto, em 3 passos",
      how: [
        { icon: "clipboard", t: "Conte o briefing", d: "Uma vez só. É o que alimenta toda a IA da plataforma." },
        { icon: "layers", t: "A IA cria", d: "Estratégia, campanha, identidade e social — com pesquisa real e atual." },
        { icon: "check", t: "Aprove e publique", d: "Revise, ajuste e coloque no ar. Conecte profissionais e meça o retorno." },
      ],
      showcase: {
        title: "O que só a Marqa faz por você",
        sub: "Tudo isso já está no ar — é criar a conta e usar.",
        items: [
          { demo: "approval", icon: "link", t: "Aprovação por link", d: "Cliente aprova pelo WhatsApp, sem senha. O post aprovado já fica agendado.", href: "/para-agencias", cta: "Ver para agências" },
          { demo: "carousel", icon: "layers", t: "Carrossel pronto", d: "Da ideia ao carrossel com a cara da marca — é só baixar e postar.", href: "/para-marcas", cta: "Ver para marcas" },
          { demo: "voice", icon: "mic", t: "Briefing falado", d: "Conte sobre sua marca como numa conversa. A IA escuta, pergunta e anota.", href: "/para-marcas", cta: "Ver para marcas" },
          { demo: "radar", icon: "radar", t: "Radar de IA", d: "Simule o que uma IA responde sobre o seu mercado e veja se a marca aparece.", href: "/para-agencias", cta: "Ver para agências" },
        ],
      },
      compare: {
        title: "Do jeito de hoje × Com a Marqa",
        head: ["Tarefa", "Do jeito de hoje", "Com a Marqa"],
        rows: [
          ["Aprovação", "print no WhatsApp", "link com histórico"],
          ["Extras", "“depois a gente vê”", "pacote conta sozinho"],
          ["Cobrança", "Pix na mão", "fatura com QR e lembrete"],
          ["Carrossel", "montado do zero, slide a slide", "pronto na identidade da marca"],
          ["Relatório", "planilha", "1 clique com resumo"],
        ],
      },
      audienceTitle: "Escolha o seu caminho",
      audiences: [
        { icon: "briefcase", t: "Para agências", d: "Escale clientes sem inflar a equipe. Mais entregas, mais margem, mais retenção.", href: "/para-agencias", cta: "Ver para agências" },
        { icon: "target", t: "Para marcas", d: "Marketing de agência, sem o custo. Estratégia e conteúdo sob medida.", href: "/para-marcas", cta: "Ver para marcas" },
        { icon: "user", t: "Para profissionais", d: "Receba demandas reais com match por IA que olha o seu portfólio.", href: "/para-profissionais", cta: "Ver para profissionais" },
      ],
      faqTitle: "Perguntas frequentes",
      faq: [
        { q: "Preciso pagar pra começar?", a: "Não. Você cria sua conta grátis e já gera seu primeiro kit. Evolui pra um plano quando quiser." },
        { q: "A IA gera em português?", a: "Sim — no idioma e no tom da sua marca. Os entregáveis saem prontos pra editar e publicar." },
        { q: "Como funciona o pagamento dos profissionais?", a: "A agência ou a marca combina e paga o profissional diretamente. A Marqa organiza a demanda e mostra o status de cada etapa, mas não guarda nem repassa dinheiro." },
        { q: "Posso usar com a minha marca?", a: "Sim. A agência sobe logo, cores e nome, e os clientes e profissionais convidados veem a marca dela. Domínio próprio ainda não está disponível." },
        { q: "Quais formas de pagamento?", a: "Pelo Mercado Pago, em reais. Assinatura no cartão: renova sozinha, você cancela quando quiser e o plano vale até o fim do período pago. Ou pague 1, 3, 6 ou 12 meses à vista (Pix, cartão ou boleto), com desconto nos maiores e sem renovação." },
        { q: "Quanto custa cada ação de IA?", a: "Cada ação tem um preço fixo em coins; a tabela aparece nos planos das páginas de agências, marcas e profissionais. Os coins do plano renovam todo mês; os comprados avulsos não expiram." },
        { q: "Dá pra prospectar e fechar cliente novo pela Marqa?", a: "Dá, no caminho das agências: a prospecção pesquisa empresas do seu nicho e a IA monta uma proposta com escopo, pacotes e preços. Você manda o link; quando a pessoa aceita um pacote, a marca já entra na sua carteira com o login criado na hora." },
      ],
      finalEyebrow: "Comece grátis. Evolua quando crescer.",
      finalTitle: "Pronto para acelerar seu marketing?",
      finalSub: "Crie sua conta em segundos e gere seu primeiro kit hoje.",
      ctaFinal: "Criar conta grátis",
    },
    en: {
      eyebrow: "AI marketing hub",
      h1a: "Weeks of marketing,",
      h1b: "delivered in minutes.",
      sub: "Marqa connects agency, brand and professionals in one platform — with the agency's own brand for its clients — and generates strategy, campaigns, identity and content with AI and real market research.",
      ctaPrimary: "Start for free",
      ctaSecondary: "Choose my path",
      trust: "No card to start · Card subscription: cancel anytime",
      stats: [
        { n: 9, suf: "", label: "AI deliverables per client" },
        { n: 3, suf: "", label: "audiences in one platform" },
        { n: 30, suf: "", label: "days of posts planned at once" },
      ],
      problemTitle: "Great marketing always stalls at the same bottlenecks",
      problems: [
        "Strategy takes weeks — and it's expensive.",
        "Content is late and the calendar stays empty.",
        "Finding (and paying) good professionals is chaos.",
        "Nobody proves the return on what was spent.",
      ],
      solution:
        "Marqa solves all four at once: AI that creates with real research, production organised from brief to client approval, and reports with sales data to prove results.",
      benefitsTitle: "Everything a marketing operation needs",
      benefitsSub: "A full kit per client, plus the ecosystem to produce and sell.",
      benefits: [
        { icon: "radar", t: "Strategy with real research", d: "Market deep dive: trends, personas, competitors and SMART goals." },
        { icon: "megaphone", t: "Ready campaigns", d: "Actionable plan with channels, messaging and real influencers." },
        { icon: "palette", t: "Visual identity", d: "Brand concepts, palette and art direction in the right tone." },
        { icon: "calendar", t: "Social & posts", d: "Full calendar, ready posts (feed, Stories, Reels, carousel) and a link in bio with clicks per destination." },
        { icon: "target", t: "Audience panel and brand voice", d: "Before publishing: the copy tested against your strategy's personas, and a guardian that holds back whatever drifts from the brand voice." },
        { icon: "users", t: "Professionals marketplace", d: "AI match of photographers and designers, with the status of every step up to approval." },
        { icon: "message", t: "WhatsApp & Instagram", d: "Through the official API: lists, scheduling and an attendant that drafts replies in the brand's tone." },
        { icon: "chart", t: "Monthly report & sales", d: "Monthly report with an AI summary, client pulse and NPS, real sales (GA4, Meta Ads, store) and what works for each brand." },
        { icon: "layers", t: "Your agency's brand", d: "Logo, colours and agency name for the clients and professionals it invites." },
      ],
      howTitle: "From brief to done, in 3 steps",
      how: [
        { icon: "clipboard", t: "Share the brief", d: "Just once. It powers all the AI in the platform." },
        { icon: "layers", t: "AI creates", d: "Strategy, campaign, identity and social — with real, current research." },
        { icon: "check", t: "Approve & publish", d: "Review, tweak and go live. Connect professionals and measure the return." },
      ],
      showcase: {
        title: "What only Marqa does for you",
        sub: "All of this is live — sign up and use it.",
        items: [
          { demo: "approval", icon: "link", t: "Approval by link", d: "Clients approve from a WhatsApp link — no password. Approved posts are scheduled right away.", href: "/para-agencias", cta: "See for agencies" },
          { demo: "carousel", icon: "layers", t: "Ready-to-post carousels", d: "Carousels in the brand's look — just download and post.", href: "/para-marcas", cta: "See for brands" },
          { demo: "voice", icon: "mic", t: "Spoken briefing", d: "Talk about your brand like in a conversation. The AI listens, asks and takes notes.", href: "/para-marcas", cta: "See for brands" },
          { demo: "radar", icon: "radar", t: "AI radar", d: "Simulate what an AI answers about your market and see whether the brand shows up.", href: "/para-agencias", cta: "See for agencies" },
        ],
      },
      compare: {
        title: "Today's way × With Marqa",
        head: ["Task", "Today", "With Marqa"],
        rows: [
          ["Approvals", "screenshots on WhatsApp", "a link with history"],
          ["Extras", "“we'll sort it out later”", "scope that counts itself"],
          ["Billing", "Pix by hand", "an invoice with QR and reminder"],
          ["Carousels", "built from scratch, slide by slide", "ready in the brand's look"],
          ["Reports", "a spreadsheet", "1 click, with a summary"],
        ],
      },
      audienceTitle: "Choose your path",
      audiences: [
        { icon: "briefcase", t: "For agencies", d: "Scale clients without scaling the team. More output, more margin, more retention.", href: "/para-agencias", cta: "See for agencies" },
        { icon: "target", t: "For brands", d: "Agency-grade marketing without the cost. Tailored strategy and content.", href: "/para-marcas", cta: "See for brands" },
        { icon: "user", t: "For professionals", d: "Get real work via an AI match that looks at your portfolio.", href: "/para-profissionais", cta: "See for professionals" },
      ],
      faqTitle: "Frequently asked questions",
      faq: [
        { q: "Do I need to pay to start?", a: "No. Create your account for free and generate your first kit. Upgrade to a plan whenever you want." },
        { q: "Does the AI write in my language?", a: "Yes — in your language and your brand's tone. Deliverables come ready to edit and publish." },
        { q: "How do professionals get paid?", a: "The agency or brand agrees the fee and pays the professional directly. Marqa organises the job and shows the status of each step, but never holds or transfers money." },
        { q: "Can I use my own brand?", a: "Yes. The agency uploads its logo, colours and name, and invited clients and professionals see that brand. Custom domains are not available yet." },
        { q: "Which payment methods?", a: "Through Mercado Pago, billed in BRL. Card subscription: renews on its own, cancel anytime and the plan lasts until the end of the paid period. Or prepay 1, 3, 6 or 12 months (Pix, card or boleto), with discounts on longer periods and no renewal." },
        { q: "How much does each AI action cost?", a: "Every action has a fixed price in coins; the table is in the pricing section of the agency, brand and professional pages. Plan coins refresh every month; purchased coins never expire." },
        { q: "Can I prospect and win new clients on Marqa?", a: "Yes, on the agency path: prospecting researches companies in your niche and the AI writes a proposal with scope, packages and prices. You send the link; when someone accepts a package, the brand lands in your portfolio with a login created on the spot." },
      ],
      finalEyebrow: "Start free. Grow when you grow.",
      finalTitle: "Ready to accelerate your marketing?",
      finalSub: "Create your account in seconds and generate your first kit today.",
      ctaFinal: "Start for free",
    },
  },
};

// ==================== AGÊNCIAS ====================
export const AGENCY: LandingConfig = {
  signupType: "agency",
  pricingType: "agency",
  content: {
    pt: {
      eyebrow: "Para agências",
      h1a: "Escale sua agência",
      h1b: "sem inflar a equipe.",
      sub: "Entregue estratégia, campanhas e conteúdo para mais clientes em minutos — com a sua marca. Mais entregas, mais margem, mais retenção.",
      ctaPrimary: "Começar como agência",
      ctaSecondary: "Ver planos",
      trust: "Com a sua marca · Sem cartão para começar",
      stats: [
        { n: 9, suf: "", label: "entregáveis por cliente, em minutos" },
        { n: 30, suf: "", label: "dias de posts por cliente, de uma vez" },
        { n: 25, suf: "%", label: "de desconto no plano anual" },
      ],
      problemTitle: "O que trava o crescimento da sua agência",
      problems: [
        "Cada cliente novo exige mais gente na equipe.",
        "Estrategista sênior é caro e o gargalo é sempre ele.",
        "Produção com freelas é desorganizada e arriscada.",
        "Cliente não vê resultado e não renova.",
        "Pedido fora do escopo vira trabalho de graça.",
      ],
      solution:
        "Com a Marqa você multiplica a capacidade da equipe: a IA faz o trabalho pesado de estratégia e conteúdo, a produção fica organizada do brief à aprovação do cliente, e o relatório mensal prova o retorno pro cliente renovar. O pacote do cliente conta cada post e transforma extra em valor aprovado.",
      benefitsTitle: "A sua operação inteira, potencializada",
      benefitsSub: "Da captação à retenção, tudo num lugar só — com a sua identidade.",
      benefits: [
        { icon: "layers", t: "Kit completo por cliente", d: "Estratégia, campanha, ROI, identidade e social gerados de uma vez." },
        { icon: "palette", t: "Com a sua marca", d: "Seu logo, suas cores e o nome da agência. O cliente enxerga a sua marca." },
        { icon: "users", t: "Rede de profissionais", d: "Match por IA com portfólio e histórico. Distribua produção sem folha inchada." },
        { icon: "link", t: "Aprovação sem login", d: "O cliente aprova pelo celular, num link. Pedido de ajuste chega na hora, com histórico." },
        { icon: "package", t: "Escopo sob controle", d: "O pacote do cliente conta cada post e transforma extra em valor aprovado antes de começar." },
        { icon: "qr", t: "Fatura Pix sem taxa", d: "Fatura do fee com QR da sua chave Pix e lembrete pronto: o pagamento cai direto na sua conta." },
        { icon: "chart", t: "Relatório que prova resultado", d: "Relatório do mês em 1 clique com posts, vendas, link na bio e links curtos por post — e o que funciona pra cada cliente." },
        { icon: "whatsapp", t: "Atendente de WhatsApp com IA", d: "Responde os clientes de cada marca pela API oficial, no tom dela, e chama uma pessoa quando precisa." },
        { icon: "radar", t: "Radar de IA para revender", d: "Simule perguntas de compra numa IA e mostre ao cliente se ele aparece — e o que fazer para aparecer mais." },
        { icon: "target", t: "Painel de público e voz da marca", d: "Teste 2 ou 3 versões do texto com as personas da estratégia do cliente: o painel aponta a mais forte e a objeção que aparece. E o guardião segura o que foge da voz daquela marca." },
        { icon: "trend", t: "Pulso e NPS do cliente", d: "O cliente dá uma nota a cada entrega aprovada e um NPS por trimestre. Quem está caindo, calado ou detrator aparece na sua Hoje — antes do pedido de saída." },
        { icon: "clock", t: "Horas e margem por cliente", d: "Lance as horas do time e veja o mês inteiro: fee contra custo, quem dá lucro, quem dá prejuízo e quanto sobra em cada conta." },
      ],
      howTitle: "Como a agência opera na Marqa",
      how: [
        { icon: "palette", t: "Ative sua marca", d: "Suba logo e cores. A plataforma vira sua em minutos." },
        { icon: "briefcase", t: "Traga clientes", d: "Mande uma proposta com escopo e pacotes por link: quem aceita já entra como cliente, com o kit completo gerado por IA." },
        { icon: "users", t: "Produza e prove", d: "Conecte profissionais, entregue e mostre o resultado com dados." },
      ],
      showcase: {
        title: "O que só a Marqa faz pela sua agência",
        sub: "Do pedido do cliente ao dinheiro na conta, sem planilha no meio.",
        items: [
          { demo: "approval", icon: "link", t: "Aprovação sem login", d: "Um link no WhatsApp: o cliente aprova pelo celular e o post aprovado já fica agendado.", href: "/criar-conta?type=agency", cta: "Começar como agência" },
          { demo: "scope", icon: "package", t: "Escopo sob controle", d: "O pacote conta cada post. Passou do combinado? O cliente aprova o valor antes de você começar.", href: "/criar-conta?type=agency", cta: "Começar como agência" },
          { demo: "invoice", icon: "qr", t: "Fatura Pix sem taxa", d: "QR da sua chave Pix e lembrete pronto. O pagamento cai direto na sua conta.", href: "/criar-conta?type=agency", cta: "Começar como agência" },
          { demo: "radar", icon: "radar", t: "Radar de IA para revender", d: "Simule perguntas de compra numa IA e mostre ao cliente se ele aparece — e o que fazer para aparecer mais.", href: "/criar-conta?type=agency", cta: "Começar como agência" },
        ],
      },
      timeline: {
        title: "Um mês com a Marqa",
        sub: "O ciclo de cada cliente, do briefing à fatura.",
        steps: [
          { when: "Dia 1", t: "O cliente conta o briefing falando." },
          { when: "Dia 2", t: "Kit e 30 dias de posts no calendário." },
          { when: "Toda semana", t: "Um link de aprovação no WhatsApp." },
          { when: "No meio do mês", t: "Pedido extra? O pacote avisa e o cliente aprova o valor." },
          { when: "Dia 30", t: "Relatório com o que funcionou e os links mais clicados." },
          { when: "Dia 1 de novo", t: "A fatura Pix do mês já está pronta pra enviar — o dinheiro cai direto na sua conta." },
        ],
      },
      compare: {
        title: "Do jeito de hoje × Com a Marqa",
        head: ["Tarefa", "Do jeito de hoje", "Com a Marqa"],
        rows: [
          ["Aprovação", "print no WhatsApp", "link com histórico"],
          ["Extras", "“depois a gente vê”", "pacote conta sozinho"],
          ["Cobrança", "Pix na mão", "fatura com QR e lembrete"],
          ["Carrossel", "montado do zero, slide a slide", "pronto na identidade da marca"],
          ["Relatório", "planilha", "1 clique com resumo"],
        ],
      },
      faqTitle: "Perguntas de agências",
      faq: [
        { q: "Meus clientes veem a marca da Marqa?", a: "Não: eles veem o seu logo, as suas cores e o nome da agência. Domínio próprio ainda não está disponível." },
        { q: "Consigo usar meu time interno em vez de freelas?", a: "Sim. Você escolhe: marketplace de profissionais ou produção interna." },
        { q: "Como cobro dos meus clientes?", a: "Do seu jeito — e, se quiser, com a fatura Pix da Marqa: QR da sua chave, lembrete e confirmação. A relação comercial com o cliente é sua." },
        { q: "O cliente precisa criar conta pra aprovar?", a: "Não. Ele recebe um link e aprova pelo celular." },
        { q: "A Marqa cobra taxa sobre minhas faturas?", a: "Não. O Pix vai direto pra sua chave; você só confirma o recebimento." },
        { q: "Como a Marqa me ajuda a fechar cliente novo?", a: "A prospecção pesquisa empresas do seu nicho e a IA monta a proposta: dores, escopo, pacotes com preço e prazo de validade. Você manda um link; a pessoa aceita o pacote pelo celular e a marca já entra na sua carteira, com o login criado na hora." },
        { q: "Tem desconto por volume/tempo?", a: "Sim: pagando 3, 6 ou 12 meses de uma vez o desconto chega a 25%. Prefere mês a mês? Assine no cartão e cancele quando quiser." },
        { q: "Como uma agência entra?", a: "Criando a conta: cada agência ganha um espaço só dela, com clientes, carteira e página. Se o cadastro estiver fechado, peça acesso e respondemos por e-mail." },
      ],
      finalEyebrow: "Com a sua marca · Comece grátis",
      finalTitle: "Coloque sua agência num novo patamar",
      finalSub: "Ative sua marca e gere o primeiro kit hoje.",
      ctaFinal: "Começar como agência",
    },
    en: {
      eyebrow: "For agencies",
      h1a: "Scale your agency",
      h1b: "without scaling the team.",
      sub: "Deliver strategy, campaigns and content for more clients in minutes — with your brand. More output, more margin, more retention.",
      ctaPrimary: "Start as an agency",
      ctaSecondary: "See pricing",
      trust: "Your brand · No card to start",
      stats: [
        { n: 9, suf: "", label: "deliverables per client, in minutes" },
        { n: 30, suf: "", label: "days of posts per client, at once" },
        { n: 25, suf: "%", label: "off on the annual plan" },
      ],
      problemTitle: "What holds your agency back",
      problems: [
        "Every new client demands more headcount.",
        "A senior strategist is expensive and always the bottleneck.",
        "Freelance production is messy and risky.",
        "Clients don't see results and don't renew.",
        "Out-of-scope requests turn into free work.",
      ],
      solution:
        "With Marqa you multiply your team's capacity: AI does the heavy lifting of strategy and content, production stays organised from brief to client approval, and the monthly report proves the return so clients renew. Each client's package counts every post and turns extras into an approved price.",
      benefitsTitle: "Your entire operation, supercharged",
      benefitsSub: "From acquisition to retention, all in one place — with your identity.",
      benefits: [
        { icon: "layers", t: "Full kit per client", d: "Strategy, campaign, ROI, identity and social generated at once." },
        { icon: "palette", t: "Your brand", d: "Your logo, colours and agency name. Clients see your brand." },
        { icon: "users", t: "Professionals network", d: "AI match on portfolio and track record. Distribute production without bloating payroll." },
        { icon: "link", t: "Approval without a login", d: "The client approves on their phone, from a link. Change requests arrive right away, with history." },
        { icon: "package", t: "Scope that counts itself", d: "Each client's package counts every post and turns extras into an approved price before work starts." },
        { icon: "qr", t: "Pix invoices, no fees", d: "Fee invoices with a QR for your own Pix key and a ready reminder: payment lands straight in your account." },
        { icon: "chart", t: "Reports that prove results", d: "One-click monthly report with posts, sales, the link in bio and short links per post — and what works for each client." },
        { icon: "whatsapp", t: "AI WhatsApp attendant", d: "Answers each brand's customers through the official API, in the brand's tone, and hands over to a person when needed." },
        { icon: "radar", t: "An AI radar you can resell", d: "Simulate buying questions in an AI and show clients whether they come up — and what to do to show up more." },
        { icon: "target", t: "Audience panel and brand voice", d: "Test 2 or 3 versions of the copy against that client's strategy personas: the panel picks the strongest and names the objection it raises. And the guardian holds back whatever drifts from that brand's voice." },
        { icon: "trend", t: "Client pulse and NPS", d: "Clients rate every approved delivery and answer an NPS each quarter. Whoever is sliding, silent or a detractor surfaces on your Today — before the goodbye email." },
        { icon: "clock", t: "Hours and margin per client", d: "Log your team's hours and see the whole month: fee against cost, who is profitable, who is not and what is left on each account." },
      ],
      howTitle: "How an agency runs on Marqa",
      how: [
        { icon: "palette", t: "Activate your brand", d: "Upload logo and colors. The platform becomes yours in minutes." },
        { icon: "briefcase", t: "Win clients", d: "Send a proposal with scope and packages as a link: whoever accepts becomes a client, with the full kit generated by AI." },
        { icon: "users", t: "Produce and prove", d: "Connect professionals, deliver and show results with data." },
      ],
      showcase: {
        title: "What only Marqa does for your agency",
        sub: "From the client's request to money in your account, no spreadsheet in between.",
        items: [
          { demo: "approval", icon: "link", t: "Clients approve from a link — no password", d: "One WhatsApp link: the client approves on their phone and the approved post is scheduled right away.", href: "/criar-conta?type=agency", cta: "Start as an agency" },
          { demo: "scope", icon: "package", t: "Scope that counts itself", d: "The package counts every post. Over the deal? The client approves the price before you start.", href: "/criar-conta?type=agency", cta: "Start as an agency" },
          { demo: "invoice", icon: "qr", t: "Pix invoices, no fees", d: "A QR for your own Pix key and a ready reminder. Payment lands straight in your account.", href: "/criar-conta?type=agency", cta: "Start as an agency" },
          { demo: "radar", icon: "radar", t: "An AI radar you can resell", d: "Simulate buying questions in an AI and show clients whether they come up — and what to do to show up more.", href: "/criar-conta?type=agency", cta: "Start as an agency" },
        ],
      },
      timeline: {
        title: "A month on Marqa",
        sub: "Each client's cycle, from briefing to invoice.",
        steps: [
          { when: "Day 1", t: "The client talks through the briefing." },
          { when: "Day 2", t: "Kit and 30 days of posts on the calendar." },
          { when: "Every week", t: "An approval link on WhatsApp." },
          { when: "Mid-month", t: "An extra request? The package flags it and the client approves the price." },
          { when: "Day 30", t: "A report with what worked and the most-clicked links." },
          { when: "Day 1 again", t: "The month's Pix invoice is ready to send — the money lands straight in your account." },
        ],
      },
      compare: {
        title: "Today's way × With Marqa",
        head: ["Task", "Today", "With Marqa"],
        rows: [
          ["Approvals", "screenshots on WhatsApp", "a link with history"],
          ["Extras", "“we'll sort it out later”", "scope that counts itself"],
          ["Billing", "Pix by hand", "an invoice with QR and reminder"],
          ["Carousels", "built from scratch, slide by slide", "ready in the brand's look"],
          ["Reports", "a spreadsheet", "1 click, with a summary"],
        ],
      },
      faqTitle: "Agency questions",
      faq: [
        { q: "Do my clients see Marqa's brand?", a: "No: they see your logo, your colours and your agency name. Custom domains are not available yet." },
        { q: "Can I use my in-house team instead of freelancers?", a: "Yes. You choose: professionals marketplace or in-house production." },
        { q: "How do I bill my clients?", a: "Your way — and, if you like, with Marqa's Pix invoice: a QR for your own key, a reminder and confirmation. The commercial relationship with the client is yours." },
        { q: "Does the client need an account to approve?", a: "No. They get a link and approve on their phone." },
        { q: "Does Marqa take a cut of my invoices?", a: "No. Pix goes straight to your key; you just confirm you received it." },
        { q: "How does Marqa help me win new clients?", a: "Prospecting researches companies in your niche and the AI writes the proposal: pains, scope, packages with prices and an expiry date. You send a link; the person accepts a package on their phone and the brand lands in your portfolio, with the login created on the spot." },
        { q: "Any volume/term discount?", a: "Yes: paying 3, 6 or 12 months upfront saves up to 25%. Prefer month to month? Subscribe by card and cancel anytime." },
        { q: "How does an agency join?", a: "By creating an account: every agency gets a space of its own, with clients, wallet and page. If sign-up is closed, request access and we reply by email." },
      ],
      finalEyebrow: "Your brand · Start free",
      finalTitle: "Take your agency to the next level",
      finalSub: "Activate your brand and generate your first kit today.",
      ctaFinal: "Start as an agency",
    },
  },
};

// ==================== MARCAS ====================
export const CLIENT: LandingConfig = {
  signupType: "client",
  pricingType: "client",
  content: {
    pt: {
      eyebrow: "Para marcas",
      h1a: "Marketing de agência,",
      h1b: "sem o custo de uma.",
      sub: "Fale sobre sua marca. Receba estratégia, carrosséis e um mês de posts — sem precisar entender de marketing.",
      ctaPrimary: "Começar minha marca",
      ctaSecondary: "Ver planos",
      trust: "Grátis para começar · Sem cartão",
      stats: [
        { n: 9, suf: "", label: "materiais prontos pra publicar" },
        { n: 5, suf: "min", label: "para o primeiro kit" },
        { n: 0, suf: "", label: "reais para começar" },
      ],
      problemTitle: "Cuidar do próprio marketing é exaustivo",
      problems: [
        "Você não tem tempo (nem verba) pra uma agência.",
        "Falta estratégia — é tudo no achismo.",
        "O feed fica sem post e sem constância.",
        "Você não sabe se o que gasta traz retorno.",
      ],
      solution:
        "A Marqa é a sua equipe de marketing por IA: diagnóstico de mercado real, campanhas e conteúdo prontos no seu tom, e conexão com suas vendas pra você ver o que funciona.",
      benefitsTitle: "Sua marca, no ritmo certo",
      benefitsSub: "Do plano ao post — tudo pronto, tudo editável, tudo seu.",
      benefits: [
        { icon: "mic", t: "Briefing falado", d: "Conte sobre a marca falando, como numa conversa. A IA pergunta o que falta e preenche tudo." },
        { icon: "layers", t: "Carrossel pronto pra postar", d: "Slides com as cores e o logo da marca, prontos pra baixar ou agendar." },
        { icon: "link", t: "Link na bio que mostra o que dá clique", d: "Sua página de links e links curtos por post: você vê o que leva gente pro site." },
        { icon: "users", t: "Painel de público: teste o post antes de publicar", d: "Uma simulação com as personas da sua estratégia compara 2 ou 3 versões do texto, aponta a mais forte e diz a objeção que apareceu." },
        { icon: "edit", t: "Guardião da voz da marca", d: "Você diz o que a marca nunca fala, o que não pode faltar e quantos emojis cabem. Antes de publicar, o texto passa pelo check — e a IA reescreve no tom certo." },
        { icon: "calendar", t: "Calendário de 30 dias", d: "Um mês de posts planejado de uma vez, com data e horário, pronto pra editar e agendar." },
        { icon: "trend", t: "Seu pulso, e um NPS por trimestre", d: "Quando uma agência cuida da sua marca, você dá uma nota a cada entrega aprovada e um NPS por trimestre, pelo portal e sem reunião — ela vê na hora quando algo sai do tom." },
        { icon: "chart", t: "O que funciona pra sua marca", d: "Posts cruzados com cliques e vendas: melhor formato, dia e horário." },
        { icon: "radar", t: "Estratégia sob medida", d: "Pesquisa real do seu setor, personas e metas realistas pro seu orçamento." },
      ],
      howTitle: "Simples assim",
      how: [
        { icon: "clipboard", t: "Preencha o briefing", d: "Conte sobre o seu negócio — leva minutos." },
        { icon: "layers", t: "Gere o kit", d: "Estratégia, campanha, identidade e social num clique." },
        { icon: "check", t: "Publique e cresça", d: "Edite no seu tom, publique e acompanhe o resultado." },
      ],
      showcase: {
        title: "O que só a Marqa faz pela sua marca",
        sub: "Marketing de verdade sem precisar entender de marketing.",
        items: [
          { demo: "voice", icon: "mic", t: "Briefing falado", d: "Conte sobre a marca como numa conversa. Quando você para, a IA entende que é a vez dela.", href: "/criar-conta?type=client", cta: "Começar minha marca" },
          { demo: "carousel", icon: "layers", t: "Carrossel pronto pra postar", d: "Slides com as cores e o logo da marca. É só baixar e postar.", href: "/criar-conta?type=client", cta: "Começar minha marca" },
          { demo: "panel", icon: "users", t: "Teste o post antes de publicar", d: "Uma simulação com as personas da sua estratégia compara versões do texto e aponta a mais forte.", href: "/criar-conta?type=client", cta: "Começar minha marca" },
          { demo: "bio", icon: "link", t: "Link na bio que mostra o que dá clique", d: "Sua página de links e links curtos por post: você vê o que leva gente pro site.", href: "/criar-conta?type=client", cta: "Começar minha marca" },
        ],
      },
      faqTitle: "Perguntas de marcas",
      faq: [
        { q: "Serve pro meu tipo de negócio?", a: "Sim — produto ou serviço, qualquer setor. A IA pesquisa o SEU mercado." },
        { q: "Preciso saber de marketing?", a: "Não. A plataforma te guia do briefing ao post pronto." },
        { q: "Isso substitui uma agência?", a: "Pra começar, sim. Se um dia preferir que uma agência cuide da marca, troque o modo da conta com um clique: você passa a acompanhar e aprovar pelo portal." },
        { q: "É de graça mesmo?", a: "Você começa grátis, sem cartão, com 40 coins por mês (dá para o primeiro kit). Planos pagos trazem mais coins e IA de qualidade maior." },
        { q: "Como pago quando quiser evoluir?", a: "Pelo Mercado Pago, em reais: assinatura mensal no cartão (cancele quando quiser, vale até o fim do período) ou 1 a 12 meses à vista no Pix, cartão ou boleto, sem renovação." },
      ],
      finalEyebrow: "Grátis para começar",
      finalTitle: "Sua marca merece começar hoje",
      finalSub: "Crie sua conta e gere seu primeiro kit em minutos.",
      ctaFinal: "Começar minha marca",
    },
    en: {
      eyebrow: "For brands",
      h1a: "Agency-grade marketing,",
      h1b: "without the agency cost.",
      sub: "Talk about your brand. Get a strategy, carousels and a month of posts — no marketing know-how needed.",
      ctaPrimary: "Start my brand",
      ctaSecondary: "See pricing",
      trust: "Free to start · No card",
      stats: [
        { n: 9, suf: "", label: "assets ready to publish" },
        { n: 5, suf: "min", label: "to your first kit" },
        { n: 0, suf: "", label: "to get started" },
      ],
      problemTitle: "Running your own marketing is exhausting",
      problems: [
        "You have no time (or budget) for an agency.",
        "There's no strategy — it's all guesswork.",
        "The feed goes quiet and inconsistent.",
        "You don't know if what you spend brings returns.",
      ],
      solution:
        "Marqa is your AI marketing team: real market diagnosis, campaigns and content ready in your tone, and a connection to your sales so you see what works.",
      benefitsTitle: "Your brand, in the right rhythm",
      benefitsSub: "From plan to post — all ready, all editable, all yours.",
      benefits: [
        { icon: "mic", t: "Spoken briefing", d: "Talk about your brand like in a conversation. The AI asks what's missing and fills everything in." },
        { icon: "layers", t: "Carousels ready to post", d: "Slides in your brand's colors and logo, ready to download or schedule." },
        { icon: "link", t: "A link in bio that shows what gets clicks", d: "Your links page and short links per post: see what sends people to your site." },
        { icon: "users", t: "Audience panel: test the post before publishing", d: "A simulation with your strategy's personas compares 2 or 3 versions of the copy, points out the strongest and names the objection it raised." },
        { icon: "edit", t: "A guardian for your brand voice", d: "You set what the brand never says, what can never be missing and how many emojis fit. Before publishing, the copy goes through the check — and the AI rewrites it in the right tone." },
        { icon: "calendar", t: "A 30-day calendar", d: "A month of posts planned in one go, with date and time, ready to edit and schedule." },
        { icon: "trend", t: "Your pulse, and an NPS each quarter", d: "When an agency runs your brand, you rate every approved delivery and answer an NPS each quarter, from the portal and with no meeting — they see right away when something drifts." },
        { icon: "chart", t: "What works for your brand", d: "Posts matched against clicks and sales: best format, day and time." },
        { icon: "radar", t: "Tailored strategy", d: "Real research on your sector, personas and realistic goals for your budget." },
      ],
      howTitle: "It's that simple",
      how: [
        { icon: "clipboard", t: "Fill the brief", d: "Tell us about your business — takes minutes." },
        { icon: "layers", t: "Generate the kit", d: "Strategy, campaign, identity and social in a click." },
        { icon: "check", t: "Publish and grow", d: "Edit in your tone, publish and track results." },
      ],
      showcase: {
        title: "What only Marqa does for your brand",
        sub: "Real marketing without having to be a marketer.",
        items: [
          { demo: "voice", icon: "mic", t: "Spoken briefing", d: "Talk about your brand like in a conversation. When you stop, the AI knows it's its turn.", href: "/criar-conta?type=client", cta: "Start my brand" },
          { demo: "carousel", icon: "layers", t: "Carousels ready to post", d: "Slides in your brand's colors and logo. Just download and post.", href: "/criar-conta?type=client", cta: "Start my brand" },
          { demo: "panel", icon: "users", t: "Test the post before publishing", d: "A simulation with your strategy's personas compares versions of the copy and points out the strongest.", href: "/criar-conta?type=client", cta: "Start my brand" },
          { demo: "bio", icon: "link", t: "A link in bio that shows what gets clicks", d: "Your links page and short links per post: see what sends people to your site.", href: "/criar-conta?type=client", cta: "Start my brand" },
        ],
      },
      faqTitle: "Brand questions",
      faq: [
        { q: "Does it fit my type of business?", a: "Yes — product or service, any sector. The AI researches YOUR market." },
        { q: "Do I need to know marketing?", a: "No. The platform guides you from brief to ready-to-publish post." },
        { q: "Does this replace an agency?", a: "To get started, yes. If you'd rather have an agency run the brand later, switch the account mode in one click: you then follow and approve everything in the portal." },
        { q: "Is it really free?", a: "You start free, with no card, and get 40 coins a month (enough for your first kit). Paid plans add more coins and higher-quality AI." },
        { q: "How do I pay when I upgrade?", a: "Through Mercado Pago, billed in BRL: a monthly card subscription (cancel anytime, it lasts until the end of the period) or 1 to 12 months upfront by Pix, card or boleto, with no renewal." },
      ],
      finalEyebrow: "Free to start",
      finalTitle: "Your brand deserves to start today",
      finalSub: "Create your account and generate your first kit in minutes.",
      ctaFinal: "Start my brand",
    },
  },
};

// ==================== PROFISSIONAIS ====================
export const PRO: LandingConfig = {
  signupType: "professional",
  pricingType: "professional",
  content: {
    pt: {
      eyebrow: "Para profissionais",
      h1a: "Trabalhos reais.",
      h1b: "Portfólio que trabalha por você.",
      sub: "Fotógrafos e designers: monte seu perfil, receba demandas com match por IA que olha seu portfólio e acompanhe cada etapa até a aprovação. Suba de elo e ganhe visibilidade.",
      ctaPrimary: "Criar meu perfil",
      ctaSecondary: "Ver planos",
      trust: "Grátis para começar · Sem cartão",
      stats: [
        { n: 3, suf: "", label: "passos: perfil, candidatura, entrega" },
        { n: 4, suf: "", label: "elos: Bronze a Platina" },
        { n: 0, suf: "", label: "reais para criar o perfil" },
      ],
      problemTitle: "Ser freelancer bom não devia ser tão instável",
      problems: [
        "Caçar cliente toma mais tempo que produzir.",
        "Briefing vago que muda no meio do caminho.",
        "Feedback confuso gera retrabalho sem fim.",
        "Quem grita mais alto ganha — não quem entrega melhor.",
      ],
      solution:
        "Na Marqa o trabalho certo chega até você: match por IA que olha o seu portfólio, brief com referências e sketch, revisão objetiva e um elo que premia quem entrega bem.",
      benefitsTitle: "Feito pra você crescer",
      benefitsSub: "Mais tempo produzindo, menos tempo caçando — com segurança.",
      benefits: [
        { icon: "target", t: "Portfólio que o match da IA enxerga", d: "A IA olha as imagens do seu portfólio e o seu histórico antes de indicar você." },
        { icon: "money", t: "Cada etapa à vista", d: "Aceite, produção, revisão, aprovação e o pagamento combinado: você sabe onde a demanda está." },
        { icon: "check", t: "Entregas com marcações na imagem", d: "Comentários fixados no ponto da imagem + nota de IA. O que pedem é o que volta." },
        { icon: "chart", t: "Seus ganhos e seu elo num lugar só", d: "O que tem a receber, o que já foi pago e o seu elo (Bronze → Platina), que sobe com entregas bem avaliadas." },
        { icon: "user", t: "Perfil e portfólio", d: "Sua vitrine hospedada, sempre trabalhando por você." },
        { icon: "layers", t: "Candidaturas com status claro", d: "Mande um pitch curto e acompanhe: aguardando análise, aceita ou recusada." },
      ],
      howTitle: "Comece em minutos",
      how: [
        { icon: "user", t: "Crie seu perfil", d: "Skills, foco e portfólio — leva poucos minutos." },
        { icon: "target", t: "Candidate-se", d: "Veja oportunidades abertas e mande um pitch que convence." },
        { icon: "money", t: "Entregue e suba de elo", d: "Receba a revisão com pontos marcados na imagem e ganhe elo a cada aprovação." },
      ],
      showcase: {
        title: "O que a Marqa faz pelo seu trabalho",
        sub: "Menos caça a cliente, mais tempo produzindo.",
        items: [
          { demo: "portfolio", icon: "image", t: "Portfólio que o match da IA enxerga", d: "A IA olha as imagens do seu portfólio e o seu histórico antes de indicar você.", href: "/criar-conta?type=professional", cta: "Criar meu perfil" },
          { demo: "markup", icon: "check", t: "Entregas com marcações na imagem", d: "A agência comenta direto no ponto da imagem. O que pedem é o que volta.", href: "/criar-conta?type=professional", cta: "Criar meu perfil" },
          { demo: "tier", icon: "chart", t: "Seus ganhos e seu elo num lugar só", d: "O que tem a receber, o que já foi pago e o seu elo na mesma tela.", href: "/criar-conta?type=professional", cta: "Criar meu perfil" },
        ],
      },
      faqTitle: "Perguntas de profissionais",
      faq: [
        { q: "Como recebo pelo trabalho?", a: "O valor é combinado e pago diretamente pela agência ou marca que contratou. A Marqa mostra o status de cada etapa, mas não guarda nem repassa dinheiro." },
        { q: "Preciso pagar pra receber demandas?", a: "Não. Você cria o perfil grátis e se candidata às demandas abertas. O plano Pro traz mais coins de IA." },
        { q: "Como o match funciona?", a: "A IA cruza seu histórico e as imagens do seu portfólio com o brief da demanda — qualidade conta." },
        { q: "Trabalho com agência ou direto com o cliente?", a: "Os dois. As demandas podem vir de agências ou de marcas direto." },
      ],
      finalEyebrow: "Grátis para começar",
      finalTitle: "Seu próximo trabalho está aqui",
      finalSub: "Crie seu perfil e comece a receber demandas hoje.",
      ctaFinal: "Criar meu perfil",
    },
    en: {
      eyebrow: "For professionals",
      h1a: "Real work.",
      h1b: "A portfolio that works for you.",
      sub: "Photographers and designers: build your profile, get requests through an AI match that looks at your portfolio, and follow every step up to approval. Level up and gain visibility.",
      ctaPrimary: "Create my profile",
      ctaSecondary: "See pricing",
      trust: "Free to start · No card",
      stats: [
        { n: 3, suf: "", label: "steps: profile, application, delivery" },
        { n: 4, suf: "", label: "tiers: Bronze to Platinum" },
        { n: 0, suf: "", label: "to create your profile" },
      ],
      problemTitle: "Being a great freelancer shouldn't be so unstable",
      problems: [
        "Chasing clients takes more time than producing.",
        "Vague briefs that change halfway through.",
        "Confusing feedback creates endless rework.",
        "The loudest wins — not the one who delivers best.",
      ],
      solution:
        "On Marqa the right work comes to you: an AI match that looks at your portfolio, briefs with references and a sketch, objective reviews and a tier that rewards those who deliver well.",
      benefitsTitle: "Built for you to grow",
      benefitsSub: "More time producing, less time chasing — with security.",
      benefits: [
        { icon: "target", t: "A portfolio the AI match can see", d: "The AI looks at your portfolio images and your track record before recommending you." },
        { icon: "money", t: "Every step in view", d: "Acceptance, production, review, approval and the agreed payment: you always know where the job stands." },
        { icon: "check", t: "Deliveries with notes on the image", d: "Comments pinned to the spot on the image + AI score. What they ask for is what comes back." },
        { icon: "chart", t: "Your earnings and tier in one place", d: "What you're owed, what's been paid and your tier (Bronze → Platinum), which rises with well-rated deliveries." },
        { icon: "user", t: "Profile & portfolio", d: "Your hosted showcase, always working for you." },
        { icon: "layers", t: "Applications with a clear status", d: "Send a short pitch and follow it: under review, accepted or declined." },
      ],
      howTitle: "Start in minutes",
      how: [
        { icon: "user", t: "Create your profile", d: "Skills, focus and portfolio — takes a few minutes." },
        { icon: "target", t: "Apply", d: "See open opportunities and send a convincing pitch." },
        { icon: "money", t: "Deliver and level up", d: "Get reviews pinned on the image and move up a tier with every approval." },
      ],
      showcase: {
        title: "What Marqa does for your work",
        sub: "Less chasing clients, more time producing.",
        items: [
          { demo: "portfolio", icon: "image", t: "A portfolio the AI match can see", d: "The AI looks at your portfolio images and your track record before recommending you.", href: "/criar-conta?type=professional", cta: "Create my profile" },
          { demo: "markup", icon: "check", t: "Deliveries with notes on the image", d: "The agency comments right on the spot in the image. What they ask for is what comes back.", href: "/criar-conta?type=professional", cta: "Create my profile" },
          { demo: "tier", icon: "chart", t: "Your earnings and tier in one place", d: "What you're owed, what's been paid and your tier on the same screen.", href: "/criar-conta?type=professional", cta: "Create my profile" },
        ],
      },
      faqTitle: "Professional questions",
      faq: [
        { q: "How do I get paid?", a: "The fee is agreed and paid directly by the agency or brand that hired you. Marqa shows the status of each step but never holds or transfers money." },
        { q: "Do I need to pay to get requests?", a: "No. Create your profile for free and apply to open jobs. The Pro plan adds more AI coins." },
        { q: "How does the match work?", a: "The AI matches your track record and portfolio images against the request brief — quality counts." },
        { q: "Do I work with agencies or directly with clients?", a: "Both. Requests can come from agencies or brands directly." },
      ],
      finalEyebrow: "Free to start",
      finalTitle: "Your next job is here",
      finalSub: "Create your profile and start getting requests today.",
      ctaFinal: "Create my profile",
    },
  },
};

// Sem assinatura no cartão (Mercado Pago não configurado): volta ao texto do
// pré-pago. Cada chave precisa existir no conteúdo acima (teste unitário).
export const PREPAID_FALLBACK: Record<string, string> = {
  "Sem cartão para começar · Assinatura no cartão: cancele quando quiser": "Sem cartão para começar · Planos pré-pagos, sem renovação automática",
  "No card to start · Card subscription: cancel anytime": "No card to start · Prepaid plans, no auto-renewal",
  "Pelo Mercado Pago, em reais. Assinatura no cartão: renova sozinha, você cancela quando quiser e o plano vale até o fim do período pago. Ou pague 1, 3, 6 ou 12 meses à vista (Pix, cartão ou boleto), com desconto nos maiores e sem renovação.":
    "Pix, cartão ou boleto pelo Mercado Pago, em reais. Os planos são pré-pagos por 1, 3, 6 ou 12 meses, com desconto nos maiores, e não renovam sozinhos.",
  "Through Mercado Pago, billed in BRL. Card subscription: renews on its own, cancel anytime and the plan lasts until the end of the paid period. Or prepay 1, 3, 6 or 12 months (Pix, card or boleto), with discounts on longer periods and no renewal.":
    "Pix, card or boleto through Mercado Pago, billed in BRL. Plans are prepaid for 1, 3, 6 or 12 months, with discounts on longer periods, and never renew on their own.",
  "Sim: pagando 3, 6 ou 12 meses de uma vez o desconto chega a 25%. Prefere mês a mês? Assine no cartão e cancele quando quiser.":
    "Sim: pagando 3, 6 ou 12 meses de uma vez o desconto chega a 25%. É pré-pago e não renova sozinho.",
  "Yes: paying 3, 6 or 12 months upfront saves up to 25%. Prefer month to month? Subscribe by card and cancel anytime.":
    "Yes: paying 3, 6 or 12 months upfront saves up to 25%. It is prepaid and never renews on its own.",
  "Pelo Mercado Pago, em reais: assinatura mensal no cartão (cancele quando quiser, vale até o fim do período) ou 1 a 12 meses à vista no Pix, cartão ou boleto, sem renovação.":
    "Pix, cartão ou boleto pelo Mercado Pago, em reais. Pré-pago por 1 a 12 meses, com desconto nos maiores e sem renovação automática.",
  "Through Mercado Pago, billed in BRL: a monthly card subscription (cancel anytime, it lasts until the end of the period) or 1 to 12 months upfront by Pix, card or boleto, with no renewal.":
    "Pix, card or boleto through Mercado Pago, billed in BRL. Prepaid for 1 to 12 months, with discounts on longer periods and no auto-renewal.",
};

// Conteúdo da landing conforme a cobrança disponível neste servidor.
export function landingFor(config: LandingConfig, cardSubscription: boolean): LandingConfig {
  if (cardSubscription) return config;
  const swap = (text: string) => PREPAID_FALLBACK[text] ?? text;
  const content = {} as LandingConfig["content"];
  for (const lang of Object.keys(config.content) as Lang[]) {
    const c = config.content[lang];
    content[lang] = { ...c, trust: swap(c.trust), faq: c.faq.map((f) => ({ q: f.q, a: swap(f.a) })) };
  }
  return { ...config, content };
}
