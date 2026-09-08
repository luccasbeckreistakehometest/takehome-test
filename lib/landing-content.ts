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
      sub: "A Marqa conecta agência, marca e profissionais numa plataforma whitelabel — e gera estratégia, campanhas, identidade e conteúdo com IA e pesquisa real de mercado.",
      ctaPrimary: "Criar conta grátis",
      ctaSecondary: "Escolher meu caminho",
      trust: "Sem cartão para começar · Cancele quando quiser",
      stats: [
        { n: 9, suf: "", label: "entregáveis de IA por cliente" },
        { n: 3, suf: "", label: "públicos numa só plataforma" },
        { n: 10, suf: "+", label: "ferramentas integradas" },
      ],
      problemTitle: "Marketing bom trava sempre nos mesmos gargalos",
      problems: [
        "Estratégia leva semanas — e sai cara.",
        "Conteúdo atrasa e o calendário fica vazio.",
        "Encontrar (e pagar) bons profissionais é um caos.",
        "Ninguém prova o retorno do que foi investido.",
      ],
      solution:
        "A Marqa resolve os quatro de uma vez: IA que cria com pesquisa real, produção conectada com pagamento garantido, e dados de venda pra provar o resultado.",
      benefitsTitle: "Tudo que uma operação de marketing precisa",
      benefitsSub: "Um kit completo por cliente, mais o ecossistema para produzir e vender.",
      benefits: [
        { icon: "radar", t: "Estratégia com pesquisa real", d: "Deep dive de mercado: tendências, personas, concorrentes e metas SMART." },
        { icon: "megaphone", t: "Campanhas prontas", d: "Plano acionável com canais, mensagens e influenciadores reais." },
        { icon: "palette", t: "Identidade visual", d: "Conceitos de marca, paleta e direção de arte no tom certo." },
        { icon: "calendar", t: "Social & posts", d: "Calendário completo e posts prontos: feed, Stories, Reels, carrossel." },
        { icon: "users", t: "Marketplace de profissionais", d: "Match por IA de fotógrafos e designers, com pagamento garantido (escrow)." },
        { icon: "message", t: "Mensagens WhatsApp & IG", d: "Listas de transmissão, agendamento e rascunho por IA." },
        { icon: "chart", t: "Insights & vendas", d: "Funil, receita e conexão com GA4, Meta Ads e suas vendas reais." },
        { icon: "sparkle", t: "100% Whitelabel", d: "A plataforma com a sua marca: logo, cores e domínio próprios." },
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
        { icon: "user", t: "Para profissionais", d: "Receba demandas reais com match por IA e pagamento garantido.", href: "/para-profissionais", cta: "Ver para profissionais" },
      ],
      faqTitle: "Perguntas frequentes",
      faq: [
        { q: "Preciso pagar pra começar?", a: "Não. Você cria sua conta grátis e já gera seu primeiro kit. Evolui pra um plano quando quiser." },
        { q: "A IA gera em português?", a: "Sim — no idioma e no tom da sua marca. Os entregáveis saem prontos pra editar e publicar." },
        { q: "Como funciona o pagamento dos profissionais?", a: "Via escrow: o valor fica reservado antes do trabalho começar e é liberado na aprovação. Protege os dois lados." },
        { q: "Posso usar com a minha marca?", a: "Sim. É whitelabel: você sobe seu logo, suas cores e usa seu domínio. Seus clientes veem a sua marca." },
        { q: "Quais formas de pagamento?", a: "Pix, cartão de crédito (Visa, Mastercard, Elo) e boleto. Planos mensais a anuais, com desconto progressivo." },
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
      sub: "Marqa connects agency, brand and professionals in one whitelabel platform — and generates strategy, campaigns, identity and content with AI and real market research.",
      ctaPrimary: "Start for free",
      ctaSecondary: "Choose my path",
      trust: "No card to start · Cancel anytime",
      stats: [
        { n: 9, suf: "", label: "AI deliverables per client" },
        { n: 3, suf: "", label: "audiences in one platform" },
        { n: 10, suf: "+", label: "integrated tools" },
      ],
      problemTitle: "Great marketing always stalls at the same bottlenecks",
      problems: [
        "Strategy takes weeks — and it's expensive.",
        "Content is late and the calendar stays empty.",
        "Finding (and paying) good professionals is chaos.",
        "Nobody proves the return on what was spent.",
      ],
      solution:
        "Marqa solves all four at once: AI that creates with real research, connected production with guaranteed payment, and sales data to prove results.",
      benefitsTitle: "Everything a marketing operation needs",
      benefitsSub: "A full kit per client, plus the ecosystem to produce and sell.",
      benefits: [
        { icon: "radar", t: "Strategy with real research", d: "Market deep dive: trends, personas, competitors and SMART goals." },
        { icon: "megaphone", t: "Ready campaigns", d: "Actionable plan with channels, messaging and real influencers." },
        { icon: "palette", t: "Visual identity", d: "Brand concepts, palette and art direction in the right tone." },
        { icon: "calendar", t: "Social & posts", d: "Full calendar and ready posts: feed, Stories, Reels, carousel." },
        { icon: "users", t: "Professionals marketplace", d: "AI match of photographers and designers, with guaranteed payment (escrow)." },
        { icon: "message", t: "WhatsApp & IG messaging", d: "Broadcast lists, scheduling and AI-drafted messages." },
        { icon: "chart", t: "Insights & sales", d: "Funnel, revenue and connection to GA4, Meta Ads and your real sales." },
        { icon: "sparkle", t: "100% Whitelabel", d: "The platform with your brand: your logo, colors and domain." },
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
        { icon: "user", t: "For professionals", d: "Get real work via AI match and guaranteed payment.", href: "/para-profissionais", cta: "See for professionals" },
      ],
      faqTitle: "Frequently asked questions",
      faq: [
        { q: "Do I need to pay to start?", a: "No. Create your account for free and generate your first kit. Upgrade to a plan whenever you want." },
        { q: "Does the AI write in my language?", a: "Yes — in your language and your brand's tone. Deliverables come ready to edit and publish." },
        { q: "How do professionals get paid?", a: "Via escrow: the amount is held before work starts and released on approval. It protects both sides." },
        { q: "Can I use my own brand?", a: "Yes. It's whitelabel: upload your logo, colors and use your domain. Your clients see your brand." },
        { q: "Which payment methods?", a: "Pix, credit card (Visa, Mastercard, Elo) and boleto. Monthly to annual plans, with progressive discounts." },
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
      trust: "Whitelabel · Sem cartão para começar",
      stats: [
        { n: 9, suf: "", label: "entregáveis por cliente, em minutos" },
        { n: 100, suf: "%", label: "com a sua marca (whitelabel)" },
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
        "Com a Marqa você multiplica a capacidade da equipe: a IA faz o trabalho pesado de estratégia e conteúdo, o marketplace organiza a produção com pagamento garantido, e os relatórios provam o retorno pro cliente renovar.",
      benefitsTitle: "A sua operação inteira, potencializada",
      benefitsSub: "Da captação à retenção, tudo num lugar só — com a sua identidade.",
      benefits: [
        { icon: "sparkle", t: "Kit completo por cliente", d: "Estratégia, campanha, ROI, identidade e social gerados de uma vez." },
        { icon: "palette", t: "Whitelabel de verdade", d: "Seu logo, suas cores, seu domínio. O cliente enxerga a sua marca." },
        { icon: "users", t: "Rede de profissionais", d: "Match por IA + escrow. Distribua produção sem folha inchada." },
        { icon: "chart", t: "Insights & retenção", d: "Prove o ROI com dados reais e renove clientes com naturalidade." },
        { icon: "radar", t: "Prospecção", d: "A IA encontra leads reais do nicho e sugere a abordagem." },
        { icon: "money", t: "Planos que dão lucro", d: "Revenda a IA como serviço recorrente, com margem." },
      ],
      howTitle: "Como a agência opera na Marqa",
      how: [
        { icon: "palette", t: "Ative sua marca", d: "Suba logo e cores. A plataforma vira sua em minutos." },
        { icon: "briefcase", t: "Cadastre clientes", d: "Gere o kit completo com IA e impressione na primeira semana." },
        { icon: "users", t: "Produza e prove", d: "Conecte profissionais, entregue e mostre o resultado com dados." },
      ],
      faqTitle: "Perguntas de agências",
      faq: [
        { q: "Meus clientes veem a marca da Marqa?", a: "Não — eles veem a SUA marca. É whitelabel: logo, cores e domínio próprios." },
        { q: "Consigo usar meu time interno em vez de freelas?", a: "Sim. Você escolhe: marketplace de profissionais ou produção interna." },
        { q: "Como cobro dos meus clientes?", a: "Do seu jeito. A Marqa é a sua ferramenta; a relação comercial com o cliente é sua." },
        { q: "Tem desconto por volume/tempo?", a: "Sim: planos trimestrais, semestrais e anuais com desconto progressivo (até 25%)." },
      ],
      finalEyebrow: "Whitelabel · Comece grátis",
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
      trust: "Whitelabel · No card to start",
      stats: [
        { n: 9, suf: "", label: "deliverables per client, in minutes" },
        { n: 100, suf: "%", label: "with your brand (whitelabel)" },
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
        "With Marqa you multiply your team's capacity: AI does the heavy lifting of strategy and content, the marketplace organizes production with guaranteed payment, and reports prove the return so clients renew.",
      benefitsTitle: "Your entire operation, supercharged",
      benefitsSub: "From acquisition to retention, all in one place — with your identity.",
      benefits: [
        { icon: "sparkle", t: "Full kit per client", d: "Strategy, campaign, ROI, identity and social generated at once." },
        { icon: "palette", t: "True whitelabel", d: "Your logo, colors, domain. Clients see your brand." },
        { icon: "users", t: "Professionals network", d: "AI match + escrow. Distribute production without bloating payroll." },
        { icon: "chart", t: "Insights & retention", d: "Prove ROI with real data and renew clients naturally." },
        { icon: "radar", t: "Prospecting", d: "AI finds real leads in your niche and suggests the approach." },
        { icon: "money", t: "Plans that profit", d: "Resell AI as a recurring service, with margin." },
      ],
      howTitle: "How an agency runs on Marqa",
      how: [
        { icon: "palette", t: "Activate your brand", d: "Upload logo and colors. The platform becomes yours in minutes." },
        { icon: "briefcase", t: "Add clients", d: "Generate the full kit with AI and impress in the first week." },
        { icon: "users", t: "Produce and prove", d: "Connect professionals, deliver and show results with data." },
      ],
      faqTitle: "Agency questions",
      faq: [
        { q: "Do my clients see Marqa's brand?", a: "No — they see YOUR brand. It's whitelabel: your logo, colors and domain." },
        { q: "Can I use my in-house team instead of freelancers?", a: "Yes. You choose: professionals marketplace or in-house production." },
        { q: "How do I bill my clients?", a: "Your way. Marqa is your tool; the commercial relationship with the client is yours." },
        { q: "Any volume/term discount?", a: "Yes: quarterly, semiannual and annual plans with progressive discounts (up to 25%)." },
      ],
      finalEyebrow: "Whitelabel · Start free",
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
        { q: "É de graça mesmo?", a: "Você começa grátis e gera seu primeiro kit sem cartão. Planos pagos destravam mais IA e recursos." },
        { q: "Como pago quando quiser evoluir?", a: "Pix, cartão ou boleto. Mensal a anual, com desconto." },
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
        { q: "Is it really free?", a: "You start free and generate your first kit with no card. Paid plans unlock more AI and features." },
        { q: "How do I pay when I upgrade?", a: "Pix, card or boleto. Monthly to annual, with discounts." },
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
      h1b: "Pagamento garantido.",
      sub: "Fotógrafos e designers: monte seu perfil, receba demandas com match por IA que olha seu portfólio e seja pago com segurança via escrow. Suba de elo e ganhe visibilidade.",
      ctaPrimary: "Criar meu perfil",
      ctaSecondary: "Ver planos",
      trust: "Grátis para começar · Pagamento protegido",
      stats: [
        { n: 100, suf: "%", label: "do pagamento garantido (escrow)" },
        { n: 4, suf: "", label: "elos: Bronze a Platina" },
        { n: 0, suf: "", label: "reais para criar o perfil" },
      ],
      problemTitle: "Ser freelancer bom não devia ser tão instável",
      problems: [
        "Caçar cliente toma mais tempo que produzir.",
        "Medo de calote depois de entregar.",
        "Feedback confuso gera retrabalho sem fim.",
        "Quem grita mais alto ganha — não quem entrega melhor.",
      ],
      solution:
        "Na Marqa o trabalho certo chega até você: match por IA que olha o seu portfólio, pagamento reservado antes de começar, revisão objetiva e um elo que premia quem entrega bem.",
      benefitsTitle: "Feito pra você crescer",
      benefitsSub: "Mais tempo produzindo, menos tempo caçando — com segurança.",
      benefits: [
        { icon: "target", t: "Demandas por match de IA", d: "A IA considera seu histórico e as imagens do seu portfólio." },
        { icon: "money", t: "Pagamento garantido", d: "Escrow: o valor fica reservado antes do trabalho e liberado na aprovação." },
        { icon: "check", t: "Revisão objetiva", d: "Comentários fixados na imagem + nota de IA. O que pedem é o que volta." },
        { icon: "chart", t: "Elo por mérito", d: "Entregas bem avaliadas sobem seu elo (Bronze → Platina) e sua visibilidade." },
        { icon: "user", t: "Perfil e portfólio", d: "Sua vitrine hospedada, sempre trabalhando por você." },
        { icon: "sparkle", t: "Candidatura com pitch", d: "Envie uma mensagem que convence junto da sua candidatura." },
      ],
      howTitle: "Comece em minutos",
      how: [
        { icon: "user", t: "Crie seu perfil", d: "Skills, foco e portfólio — leva poucos minutos." },
        { icon: "target", t: "Candidate-se", d: "Veja oportunidades abertas e mande um pitch que convence." },
        { icon: "money", t: "Entregue e receba", d: "Produza com segurança, receba na aprovação e suba de elo." },
      ],
      faqTitle: "Perguntas de profissionais",
      faq: [
        { q: "Como sei que vou receber?", a: "O pagamento fica reservado em escrow antes de você começar e é liberado quando a entrega é aprovada." },
        { q: "Preciso pagar pra receber demandas?", a: "Não. Você cria o perfil grátis. O plano Pro dá candidaturas ilimitadas e destaque no match." },
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
      h1b: "Guaranteed payment.",
      sub: "Photographers and designers: build your profile, get requests via AI match that looks at your portfolio, and get paid securely via escrow. Level up and gain visibility.",
      ctaPrimary: "Create my profile",
      ctaSecondary: "See pricing",
      trust: "Free to start · Protected payment",
      stats: [
        { n: 100, suf: "%", label: "of payment guaranteed (escrow)" },
        { n: 4, suf: "", label: "tiers: Bronze to Platinum" },
        { n: 0, suf: "", label: "to create your profile" },
      ],
      problemTitle: "Being a great freelancer shouldn't be so unstable",
      problems: [
        "Chasing clients takes more time than producing.",
        "Fear of not getting paid after delivering.",
        "Confusing feedback creates endless rework.",
        "The loudest wins — not the one who delivers best.",
      ],
      solution:
        "On Marqa the right work comes to you: AI match that looks at your portfolio, payment held before you start, objective reviews and a tier that rewards those who deliver well.",
      benefitsTitle: "Built for you to grow",
      benefitsSub: "More time producing, less time chasing — with security.",
      benefits: [
        { icon: "target", t: "Requests via AI match", d: "The AI considers your track record and your portfolio images." },
        { icon: "money", t: "Guaranteed payment", d: "Escrow: the amount is held before work and released on approval." },
        { icon: "check", t: "Objective reviews", d: "Comments pinned on the image + AI score. What they ask is what comes back." },
        { icon: "chart", t: "Merit-based tiers", d: "Well-rated deliveries raise your tier (Bronze → Platinum) and visibility." },
        { icon: "user", t: "Profile & portfolio", d: "Your hosted showcase, always working for you." },
        { icon: "sparkle", t: "Apply with a pitch", d: "Send a convincing message along with your application." },
      ],
      howTitle: "Start in minutes",
      how: [
        { icon: "user", t: "Create your profile", d: "Skills, focus and portfolio — takes a few minutes." },
        { icon: "target", t: "Apply", d: "See open opportunities and send a convincing pitch." },
        { icon: "money", t: "Deliver and get paid", d: "Produce safely, get paid on approval and level up." },
      ],
      faqTitle: "Professional questions",
      faq: [
        { q: "How do I know I'll get paid?", a: "The payment is held in escrow before you start and released once the delivery is approved." },
        { q: "Do I need to pay to get requests?", a: "No. Create your profile for free. The Pro plan gives unlimited applications and match highlight." },
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
