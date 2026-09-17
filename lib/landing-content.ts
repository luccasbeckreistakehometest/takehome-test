import type { IconName } from "@/components/icons";
import type { AccountType } from "@/lib/plans";

export type Lang = "pt" | "en";

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
      trust: "Sem cartão para começar · Planos pré-pagos, sem renovação automática",
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
        { icon: "calendar", t: "Social & posts", d: "Calendário completo e posts prontos: feed, Stories, Reels, carrossel." },
        { icon: "users", t: "Marketplace de profissionais", d: "Match por IA de fotógrafos e designers, com o status de cada etapa até a aprovação." },
        { icon: "message", t: "WhatsApp & Instagram", d: "Pela API oficial: listas, agendamento e um atendente que rascunha respostas no tom da marca." },
        { icon: "chart", t: "Relatório mensal & vendas", d: "Relatório do mês com leitura da IA, pulso do cliente e vendas reais (GA4, Meta Ads, loja)." },
        { icon: "sparkle", t: "Com a marca da agência", d: "Logo, cores e nome da agência para os clientes e profissionais que ela convida." },
      ],
      howTitle: "Do briefing ao pronto, em 3 passos",
      how: [
        { icon: "clipboard", t: "Conte o briefing", d: "Uma vez só. É o que alimenta toda a IA da plataforma." },
        { icon: "sparkle", t: "A IA cria", d: "Estratégia, campanha, identidade e social — com pesquisa real e atual." },
        { icon: "check", t: "Aprove e publique", d: "Revise, ajuste e coloque no ar. Conecte profissionais e meça o retorno." },
      ],
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
        { q: "Quais formas de pagamento?", a: "Pix, cartão ou boleto pelo Mercado Pago, em reais. Os planos são pré-pagos por 1, 3, 6 ou 12 meses, com desconto nos maiores, e não renovam sozinhos." },
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
      trust: "No card to start · Prepaid plans, no auto-renewal",
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
        { icon: "calendar", t: "Social & posts", d: "Full calendar and ready posts: feed, Stories, Reels, carousel." },
        { icon: "users", t: "Professionals marketplace", d: "AI match of photographers and designers, with the status of every step up to approval." },
        { icon: "message", t: "WhatsApp & Instagram", d: "Through the official API: lists, scheduling and an assistant that drafts replies in the brand's tone." },
        { icon: "chart", t: "Monthly report & sales", d: "Monthly report with an AI summary, client pulse and real sales (GA4, Meta Ads, store)." },
        { icon: "sparkle", t: "Your agency's brand", d: "Logo, colours and agency name for the clients and professionals it invites." },
      ],
      howTitle: "From brief to done, in 3 steps",
      how: [
        { icon: "clipboard", t: "Share the brief", d: "Just once. It powers all the AI in the platform." },
        { icon: "sparkle", t: "AI creates", d: "Strategy, campaign, identity and social — with real, current research." },
        { icon: "check", t: "Approve & publish", d: "Review, tweak and go live. Connect professionals and measure the return." },
      ],
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
        { q: "Which payment methods?", a: "Pix, card or boleto through Mercado Pago, charged in Brazilian reais (BRL). Plans are prepaid for 1, 3, 6 or 12 months, with discounts on longer periods, and never renew on their own." },
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
      ],
      solution:
        "Com a Marqa você multiplica a capacidade da equipe: a IA faz o trabalho pesado de estratégia e conteúdo, a produção fica organizada do brief à aprovação do cliente, e o relatório mensal prova o retorno pro cliente renovar.",
      benefitsTitle: "A sua operação inteira, potencializada",
      benefitsSub: "Da captação à retenção, tudo num lugar só — com a sua identidade.",
      benefits: [
        { icon: "sparkle", t: "Kit completo por cliente", d: "Estratégia, campanha, ROI, identidade e social gerados de uma vez." },
        { icon: "palette", t: "Com a sua marca", d: "Seu logo, suas cores e o nome da agência. O cliente enxerga a sua marca." },
        { icon: "users", t: "Rede de profissionais", d: "Match por IA com portfólio e histórico. Distribua produção sem folha inchada." },
        { icon: "chart", t: "Relatório, pulso e margem", d: "Relatório do mês em 1 clique, NPS do cliente e horas e margem por conta." },
        { icon: "radar", t: "Prospecção", d: "A IA encontra leads reais do nicho e sugere a abordagem." },
        { icon: "check", t: "Aprovação que vira ação", d: "O cliente aprova no portal e o post entra no calendário como rascunho." },
      ],
      howTitle: "Como a agência opera na Marqa",
      how: [
        { icon: "palette", t: "Ative sua marca", d: "Suba logo e cores. A plataforma vira sua em minutos." },
        { icon: "briefcase", t: "Cadastre clientes", d: "Gere o kit completo com IA e impressione na primeira semana." },
        { icon: "users", t: "Produza e prove", d: "Conecte profissionais, entregue e mostre o resultado com dados." },
      ],
      faqTitle: "Perguntas de agências",
      faq: [
        { q: "Meus clientes veem a marca da Marqa?", a: "Não: eles veem o seu logo, as suas cores e o nome da agência. Domínio próprio ainda não está disponível." },
        { q: "Consigo usar meu time interno em vez de freelas?", a: "Sim. Você escolhe: marketplace de profissionais ou produção interna." },
        { q: "Como cobro dos meus clientes?", a: "Do seu jeito. A Marqa é a sua ferramenta; a relação comercial com o cliente é sua." },
        { q: "Tem desconto por volume/tempo?", a: "Sim: pagando 3, 6 ou 12 meses de uma vez o desconto chega a 25%. É pré-pago e não renova sozinho." },
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
      ],
      solution:
        "With Marqa you multiply your team's capacity: AI does the heavy lifting of strategy and content, production stays organised from brief to client approval, and the monthly report proves the return so clients renew.",
      benefitsTitle: "Your entire operation, supercharged",
      benefitsSub: "From acquisition to retention, all in one place — with your identity.",
      benefits: [
        { icon: "sparkle", t: "Full kit per client", d: "Strategy, campaign, ROI, identity and social generated at once." },
        { icon: "palette", t: "Your brand", d: "Your logo, colours and agency name. Clients see your brand." },
        { icon: "users", t: "Professionals network", d: "AI match on portfolio and track record. Distribute production without bloating payroll." },
        { icon: "chart", t: "Report, pulse and margin", d: "One-click monthly report, client NPS, and hours and margin per account." },
        { icon: "radar", t: "Prospecting", d: "AI finds real leads in your niche and suggests the approach." },
        { icon: "check", t: "Approvals that act", d: "The client approves in the portal and the post lands on the calendar as a draft." },
      ],
      howTitle: "How an agency runs on Marqa",
      how: [
        { icon: "palette", t: "Activate your brand", d: "Upload logo and colors. The platform becomes yours in minutes." },
        { icon: "briefcase", t: "Add clients", d: "Generate the full kit with AI and impress in the first week." },
        { icon: "users", t: "Produce and prove", d: "Connect professionals, deliver and show results with data." },
      ],
      faqTitle: "Agency questions",
      faq: [
        { q: "Do my clients see Marqa's brand?", a: "No: they see your logo, your colours and your agency name. Custom domains are not available yet." },
        { q: "Can I use my in-house team instead of freelancers?", a: "Yes. You choose: professionals marketplace or in-house production." },
        { q: "How do I bill my clients?", a: "Your way. Marqa is your tool; the commercial relationship with the client is yours." },
        { q: "Any volume/term discount?", a: "Yes: paying 3, 6 or 12 months upfront saves up to 25%. It is prepaid and never renews on its own." },
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
      sub: "Conte sobre o seu negócio uma vez e receba estratégia, campanhas, identidade e conteúdo sob medida — com IA e pesquisa real do seu mercado.",
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
        { icon: "radar", t: "Estratégia sob medida", d: "Pesquisa real do seu setor, personas e metas realistas pro seu orçamento." },
        { icon: "megaphone", t: "Campanhas acionáveis", d: "O que fazer, onde e como — sem enrolação." },
        { icon: "palette", t: "Identidade visual", d: "Conceitos de marca e paleta com a sua cara." },
        { icon: "calendar", t: "Calendário & posts", d: "Um mês de conteúdo pronto: feed, Stories, Reels." },
        { icon: "chart", t: "ROI & vendas", d: "Conecte suas vendas e veja o retorno de verdade." },
        { icon: "message", t: "Portal simples", d: "Acompanhe, aprove e peça produção num lugar só." },
      ],
      howTitle: "Simples assim",
      how: [
        { icon: "clipboard", t: "Preencha o briefing", d: "Conte sobre o seu negócio — leva minutos." },
        { icon: "sparkle", t: "Gere o kit", d: "Estratégia, campanha, identidade e social num clique." },
        { icon: "check", t: "Publique e cresça", d: "Edite no seu tom, publique e acompanhe o resultado." },
      ],
      faqTitle: "Perguntas de marcas",
      faq: [
        { q: "Serve pro meu tipo de negócio?", a: "Sim — produto ou serviço, qualquer setor. A IA pesquisa o SEU mercado." },
        { q: "Preciso saber de marketing?", a: "Não. A plataforma te guia do briefing ao post pronto." },
        { q: "É de graça mesmo?", a: "Você começa grátis, sem cartão, com 40 coins por mês (dá para o primeiro kit). Planos pagos trazem mais coins e IA de qualidade maior." },
        { q: "Como pago quando quiser evoluir?", a: "Pix, cartão ou boleto pelo Mercado Pago, em reais. Pré-pago por 1 a 12 meses, com desconto nos maiores e sem renovação automática." },
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
      sub: "Tell us about your business once and get tailored strategy, campaigns, identity and content — with AI and real research on your market.",
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
        { icon: "radar", t: "Tailored strategy", d: "Real research on your sector, personas and realistic goals for your budget." },
        { icon: "megaphone", t: "Actionable campaigns", d: "What to do, where and how — no fluff." },
        { icon: "palette", t: "Visual identity", d: "Brand concepts and palette with your look." },
        { icon: "calendar", t: "Calendar & posts", d: "A month of content ready: feed, Stories, Reels." },
        { icon: "chart", t: "ROI & sales", d: "Connect your sales and see the real return." },
        { icon: "message", t: "Simple portal", d: "Follow, approve and request production in one place." },
      ],
      howTitle: "It's that simple",
      how: [
        { icon: "clipboard", t: "Fill the brief", d: "Tell us about your business — takes minutes." },
        { icon: "sparkle", t: "Generate the kit", d: "Strategy, campaign, identity and social in a click." },
        { icon: "check", t: "Publish and grow", d: "Edit in your tone, publish and track results." },
      ],
      faqTitle: "Brand questions",
      faq: [
        { q: "Does it fit my type of business?", a: "Yes — product or service, any sector. The AI researches YOUR market." },
        { q: "Do I need to know marketing?", a: "No. The platform guides you from brief to ready-to-publish post." },
        { q: "Is it really free?", a: "You start free, with no card, and get 40 coins a month (enough for your first kit). Paid plans add more coins and higher-quality AI." },
        { q: "How do I pay when I upgrade?", a: "Pix, card or boleto through Mercado Pago, charged in Brazilian reais (BRL). Prepaid for 1 to 12 months, with discounts on longer periods and no auto-renewal." },
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
        { icon: "target", t: "Demandas por match de IA", d: "A IA considera seu histórico e as imagens do seu portfólio." },
        { icon: "money", t: "Cada etapa à vista", d: "Aceite, produção, revisão, aprovação e o pagamento combinado: você sabe onde a demanda está." },
        { icon: "check", t: "Revisão objetiva", d: "Comentários fixados na imagem + nota de IA. O que pedem é o que volta." },
        { icon: "chart", t: "Elo por mérito", d: "Entregas bem avaliadas sobem seu elo (Bronze → Platina) e sua visibilidade." },
        { icon: "user", t: "Perfil e portfólio", d: "Sua vitrine hospedada, sempre trabalhando por você." },
        { icon: "sparkle", t: "Candidatura com pitch", d: "Envie uma mensagem que convence junto da sua candidatura." },
      ],
      howTitle: "Comece em minutos",
      how: [
        { icon: "user", t: "Crie seu perfil", d: "Skills, foco e portfólio — leva poucos minutos." },
        { icon: "target", t: "Candidate-se", d: "Veja oportunidades abertas e mande um pitch que convence." },
        { icon: "money", t: "Entregue e suba de elo", d: "Receba a revisão com pontos marcados na imagem e ganhe elo a cada aprovação." },
      ],
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
        { icon: "target", t: "Requests via AI match", d: "The AI considers your track record and your portfolio images." },
        { icon: "money", t: "Every step in view", d: "Acceptance, production, review, approval and the agreed payment: you always know where the job stands." },
        { icon: "check", t: "Objective reviews", d: "Comments pinned on the image + AI score. What they ask is what comes back." },
        { icon: "chart", t: "Merit-based tiers", d: "Well-rated deliveries raise your tier (Bronze → Platinum) and visibility." },
        { icon: "user", t: "Profile & portfolio", d: "Your hosted showcase, always working for you." },
        { icon: "sparkle", t: "Apply with a pitch", d: "Send a convincing message along with your application." },
      ],
      howTitle: "Start in minutes",
      how: [
        { icon: "user", t: "Create your profile", d: "Skills, focus and portfolio — takes a few minutes." },
        { icon: "target", t: "Apply", d: "See open opportunities and send a convincing pitch." },
        { icon: "money", t: "Deliver and level up", d: "Get reviews pinned on the image and move up a tier with every approval." },
      ],
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
