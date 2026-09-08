// Monta 3 brochures de venda (agência, cliente, profissional) em HTML e
// renderiza cada um em PDF. Cobre TODAS as seções do sistema, com screenshots
// reais em PT-BR (cliente demo Ateliê Amora). Design escuro premium.
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const pitchDir = path.join(root, "pitch");
const ACCENT = "#c6f24e";

const CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  :root { --accent: ${ACCENT}; }
  html, body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; color: #e9eaee; background: #0b0c10; }
  .page { width: 210mm; min-height: 297mm; padding: 17mm 15mm; position: relative; page-break-after: always; overflow: hidden; background: #0b0c10; }
  .page:last-child { page-break-after: auto; }
  .cover { display: flex; flex-direction: column; justify-content: center; background:
      radial-gradient(120% 80% at 100% 0%, rgba(198,242,78,0.15), transparent 55%),
      radial-gradient(90% 70% at 0% 100%, rgba(198,242,78,0.08), transparent 50%), #0b0c10; }
  .cover .badge { display: inline-block; align-self: flex-start; border: 1px solid var(--accent); color: var(--accent);
      border-radius: 999px; padding: 6px 16px; font-size: 12px; letter-spacing: .18em; text-transform: uppercase; font-weight: 700; }
  .cover h1 { font-size: 50px; line-height: 1.06; margin-top: 24px; font-weight: 800; letter-spacing: -0.02em; }
  .cover h1 .hl { color: var(--accent); }
  .cover .sub { font-size: 18px; color: #b6bac6; margin-top: 20px; max-width: 155mm; line-height: 1.5; }
  .cover .foot { position: absolute; bottom: 17mm; left: 15mm; right: 15mm; display: flex; justify-content: space-between;
      align-items: center; color: #8b90a0; font-size: 13px; border-top: 1px solid #262a35; padding-top: 14px; }
  .cover .logo { font-weight: 800; font-size: 18px; }
  .cover .logo b { color: var(--accent); }
  .kicker { color: var(--accent); font-size: 11.5px; letter-spacing: .18em; text-transform: uppercase; font-weight: 700; }
  h2 { font-size: 27px; font-weight: 800; letter-spacing: -0.015em; margin-top: 7px; line-height: 1.14; }
  .lead { font-size: 14px; color: #c3c7d1; line-height: 1.55; margin-top: 12px; max-width: 178mm; }
  .why { margin-top: 12px; border-left: 3px solid var(--accent); padding: 3px 0 3px 13px; }
  .why .lbl { color: var(--accent); font-weight: 700; font-size: 12.5px; }
  .why p { font-size: 13px; color: #d4d7de; line-height: 1.5; margin-top: 2px; }
  ul.bul { margin-top: 12px; list-style: none; display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px; }
  ul.bul li { font-size: 12.5px; color: #d4d7de; line-height: 1.35; padding-left: 18px; position: relative; }
  ul.bul li::before { content: "✓"; position: absolute; left: 0; color: var(--accent); font-weight: 800; }
  .shot { margin-top: 16px; border: 1px solid #2b2f3a; border-radius: 11px; overflow: hidden; box-shadow: 0 16px 44px rgba(0,0,0,.5); }
  .shot img { width: 100%; display: block; }
  .shots2 { display: grid; grid-template-columns: 1fr 1fr; gap: 11px; margin-top: 16px; }
  .shots2 .shot { margin-top: 0; }
  .caption { color: #8b90a0; font-size: 11px; margin-top: 7px; text-align: center; }
  .pfoot { position: absolute; bottom: 11mm; left: 15mm; right: 15mm; display: flex; justify-content: space-between;
      color: #666c7c; font-size: 10.5px; border-top: 1px solid #1c2029; padding-top: 7px; }
  .pfoot b { color: var(--accent); }
  .cta { display: flex; flex-direction: column; justify-content: center; background:
      radial-gradient(100% 70% at 0% 0%, rgba(198,242,78,0.12), transparent 55%), #0b0c10; }
  .cta h2 { font-size: 38px; }
  .cta .steps { margin-top: 24px; display: grid; gap: 13px; }
  .cta .step { display: flex; gap: 13px; align-items: flex-start; }
  .cta .num { flex: 0 0 32px; height: 32px; border-radius: 999px; background: var(--accent); color: #141605;
      font-weight: 800; display: grid; place-items: center; font-size: 14px; }
  .cta .step p { font-size: 14px; color: #d4d7de; line-height: 1.45; padding-top: 5px; }
  .cta .big { margin-top: 28px; background: var(--accent); color: #141605; font-weight: 800; font-size: 16px;
      border-radius: 11px; padding: 15px 20px; align-self: flex-start; }
`;

const cover = ({ badge, title, sub }) => `<section class="page cover">
  <span class="badge">${badge}</span><h1>${title}</h1><p class="sub">${sub}</p>
  <div class="foot"><span class="logo"><b>Agency</b>Hub</span><span>Apresentação da plataforma · ${new Date().getFullYear()}</span></div></section>`;

const feat = ({ kicker, title, lead, why, bullets, shots, caption, n }) => {
  const s = shots.length === 1
    ? `<div class="shot"><img src="shots/${shots[0]}.png"/></div>`
    : `<div class="shots2">${shots.map((x) => `<div class="shot"><img src="shots/${x}.png"/></div>`).join("")}</div>`;
  return `<section class="page"><span class="kicker">${kicker}</span><h2>${title}</h2>
    <p class="lead">${lead}</p>
    ${why ? `<div class="why"><span class="lbl">Por que importa: </span><p>${why}</p></div>` : ""}
    ${bullets?.length ? `<ul class="bul">${bullets.map((b) => `<li>${b}</li>`).join("")}</ul>` : ""}
    ${s}${caption ? `<p class="caption">${caption}</p>` : ""}
    <div class="pfoot"><span><b>AgencyHub</b></span><span>${n}</span></div></section>`;
};

const cta = ({ title, steps, big }) => `<section class="page cta"><span class="kicker">Vamos começar</span><h2>${title}</h2>
  <div class="steps">${steps.map((s, i) => `<div class="step"><div class="num">${i + 1}</div><p>${s}</p></div>`).join("")}</div>
  <div class="big">${big}</div><div class="pfoot"><span><b>AgencyHub</b></span><span></span></div></section>`;

const doc = (title, pages) =>
  `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${title}</title><style>${CSS}</style></head><body>${pages.join("")}</body></html>`;

const AMORA = "As telas mostram um cliente real de demonstração (Ateliê Amora) com conteúdo gerado pela IA em português.";

// ==================== AGÊNCIA ====================
const agency = [
  cover({
    badge: "Para agências",
    title: `A sua agência,<br><span class="hl">centralizada e acelerada por IA.</span>`,
    sub: "Uma plataforma whitelabel que reúne clientes, profissionais e produção — e gera estratégia, campanhas, identidade e social em minutos, com a sua marca. Mais entregas, mais margem, mais retenção.",
  }),
  feat({ n: "01 · Central", kicker: "Central operacional", title: "Tudo que precisa da sua ação, num lugar",
    lead: "A home “Hoje” concentra o que importa agora: candidaturas de profissionais, entregas para revisar, aprovações de cliente, posts na hora de publicar e reuniões do dia.",
    why: "Agência é operação. A plataforma te diz o próximo passo, e o elo da agência gamifica a evolução para reter o time e mostrar progresso.",
    bullets: ["Fila única de pendências", "Elo da agência (Bronze → Platina)", "Carteira de clientes com status", "Métricas de retenção ao vivo"],
    shots: ["ag-home"], caption: "Home operacional com a marca da agência (whitelabel)." }),
  feat({ n: "02 · IA", kicker: "Kit de IA — Estratégia & Radar", title: "Semanas de trabalho estratégico em minutos",
    lead: "A partir de um briefing, a IA gera um deep dive estratégico com pesquisa real de mercado — tendências, personas, concorrentes e metas SMART — e um radar que capta as mudanças do mercado ao longo do tempo.",
    why: "É o que mais custa tempo de um estrategista sênior, com fontes reais e consistência. Você escala o número de clientes sem escalar a equipe na mesma proporção.",
    bullets: ["Pesquisa real na web (dados atuais)", "Personas de quem realmente compra", "Radar de mercado contínuo", "Estratégia viva alimenta todo o resto"],
    shots: ["am-strategy", "am-radar"], caption: "Estratégia & deep dive (esq.) e radar de mercado (dir.)." }),
  feat({ n: "03 · IA", kicker: "Campanha & ROI", title: "Do plano ao retorno projetado",
    lead: "Plano de campanha acionável com canais, mensagens e influenciadores reais, e uma projeção de ROI com antes/depois, metas e roadmap — depois você lança os números reais para comparar.",
    why: "Retenção de cliente vive de mostrar resultado. Quando a agência prova o retorno com dados, a renovação vira consequência.",
    bullets: ["Plano de campanha acionável", "Recomendação de influenciadores", "ROI projetado × real", "Roadmap por período"],
    shots: ["am-campaign", "am-roi"], caption: "Plano de campanha (esq.) e projeção de ROI (dir.)." }),
  feat({ n: "04 · IA", kicker: "Identidade, Social & Posts", title: "Marca e conteúdo prontos para publicar",
    lead: "Conceitos de identidade visual e paleta, calendário social completo e lotes de posts (feed, Stories, Reels, carrossel) — tudo editável e no idioma do cliente.",
    why: "O cliente vê valor tangível na primeira semana. Material pronto encurta o ciclo do briefing à publicação e reduz retrabalho.",
    bullets: ["Identidade visual e paleta", "Calendário social por período", "Posts com formato e legenda", "Edição inline, multi-idioma"],
    shots: ["am-identity", "am-social"], caption: "Identidade visual (esq.) e calendário social (dir.)." }),
  feat({ n: "05 · IA", kicker: "Ofertas & Relatórios", title: "Novas oportunidades e relatórios automáticos",
    lead: "A IA sugere novas ofertas e campanhas com base nas capacidades da conta, e gera relatórios executivos automáticos a partir dos dados reais da plataforma — na visão certa para cada público.",
    why: "Você amplia o ticket do cliente com propostas relevantes, e economiza horas de montagem de relatório que ninguém gosta de fazer.",
    bullets: ["Ofertas sugeridas pela IA", "Relatório executivo automático", "Baseado em dados reais da conta", "Pronto para enviar ao cliente"],
    shots: ["am-ofertas", "am-relatorio"], caption: "Oportunidades de oferta (esq.) e relatório executivo (dir.)." }),
  feat({ n: "06 · Novos negócios", kicker: "Prospecção & Ideias", title: "Encha o funil com leads e ideias reais",
    lead: "A prospecção pesquisa a web e traz empresas reais do nicho e região que são potenciais clientes — com o porquê do fit e a abordagem sugerida. E o motor de ideias propõe novas campanhas e ações para cada conta.",
    why: "Agência que não prospecta vive de indicação. Aqui a plataforma abastece o funil e ainda sugere o próximo trabalho para os clientes que você já tem.",
    bullets: ["Leads reais via pesquisa na web", "Fit + abordagem de venda", "Ideias acionáveis por conta", "Ideia → briefing → demanda"],
    shots: ["ag-prospecting", "ag-ideas"], caption: "Prospecção de novos clientes (esq.) e motor de ideias (dir.)." }),
  feat({ n: "07 · Produção", kicker: "Marketplace, Produção & Revisões", title: "Conecte profissionais e produza com segurança",
    lead: "Publique demandas e a IA faz o match de fotógrafos e designers pelo histórico real e pelo portfólio (visão). Gerencie no kanban, revise com anotações fixadas na imagem, nota de IA (0–100) e comentários, e libere o pagamento via escrow na aprovação.",
    why: "Você entrega produção sem folha inchada. As revisões objetivas (pin na imagem + nota + comentário) cortam idas e vindas, e o escrow protege os dois lados.",
    bullets: ["Match por histórico + portfólio (IA)", "Kanban com drag & drop", "Revisão: pin na imagem + nota IA", "Escrow (pagamento garantido)"],
    shots: ["am-demandas", "ag-production"], caption: "Demandas e marketplace (esq.) e kanban de produção (dir.)." }),
  feat({ n: "08 · Dados", kicker: "Insights & Vendas", title: "A operação inteira em números",
    lead: "Funil de demandas, ritmo da semana, receita rastreada, prazos em atraso e ranking de clientes e profissionais. Conecte GA4, Meta Ads e as vendas reais do cliente (loja, marketplace) para medir o impacto de verdade.",
    why: "Decisão boa precisa de visão. Você prioriza onde há dinheiro e risco, e prova o resultado com dados reais de venda — não com achismo.",
    bullets: ["Funil de demandas e receita (KPI)", "Prazos em atraso destacados", "Conexão GA4 / Meta Ads", "Vendas reais (produto ou serviço)"],
    shots: ["ag-insights", "am-vendas"], caption: "Insights da agência (esq.) e vendas & dados do cliente (dir.)." }),
  feat({ n: "09 · Relacionamento", kicker: "Mensagens & Agenda", title: "WhatsApp, Instagram e reuniões no piloto automático",
    lead: "Central de mensagens com contatos, listas de transmissão, agendamento e rascunho por IA — envie pela API oficial ou pela sua sessão logada e receba as respostas na plataforma. E a agenda organiza reuniões com recomendações e links de calendário.",
    why: "Prospecção e follow-up são onde a receita vaza. Automatizar o envio (sem parecer spam) e centralizar reuniões mantém o relacionamento vivo sem consumir o time.",
    bullets: ["Listas de transmissão + individuais", "Rascunho de mensagem por IA", "Caixa de entrada (respostas)", "Agenda com reuniões e lembretes"],
    shots: ["ag-messages", "ag-agenda"], caption: "Central de mensagens (esq.) e agenda (dir.)." }),
  feat({ n: "10 · Negócio", kicker: "Whitelabel & Monetização", title: "A plataforma com a sua marca — e planos que dão lucro",
    lead: "Suba seu logo e cores: clientes e profissionais que você convida veem a plataforma como sua. E você trabalha com planos por tipo de conta (mensal a anual, com desconto progressivo) e créditos avulsos, com margem.",
    why: "Whitelabel te posiciona como dono da tecnologia, não como revendedor. Os planos transformam a IA em receita recorrente previsível.",
    bullets: ["Logo, cor e identidade próprios", "Convites com a sua marca", "Planos mensal → anual (-25%)", "Créditos avulsos on-demand"],
    shots: ["ag-settings", "ag-plans"], caption: "Whitelabel em Configurações (esq.) e planos (dir.)." }),
  cta({ title: "Pronto para escalar sua agência?",
    steps: [
      "Ative sua marca: suba logo e cores em Configurações — a plataforma vira sua em minutos.",
      "Cadastre o primeiro cliente e gere o kit completo com IA para ver o valor na hora.",
      "Convide seus profissionais e comece a distribuir produção com pagamento garantido.",
    ],
    big: "Comece hoje — sua agência, acelerada por IA." }),
];

// ==================== CLIENTE ====================
const client = [
  cover({
    badge: "Para sua marca",
    title: `Marketing de agência,<br><span class="hl">sem o custo de uma agência.</span>`,
    sub: "Conte sobre o seu negócio uma vez e receba estratégia, campanhas, identidade visual e conteúdo social sob medida — com IA e pesquisa real de mercado. Acompanhe, aprove e veja o retorno.",
  }),
  feat({ n: "01 · Portal", kicker: "Seu portal", title: "Acompanhe sua marca em um só lugar",
    lead: "No seu portal você vê tudo que está sendo construído para a sua marca, aprova entregas, pede novas produções e conversa com a equipe — sem trocar mil e-mails.",
    why: "Você fica no controle sem virar gestor de projeto. Transparência total sobre o que acontece e o que precisa da sua decisão.",
    bullets: ["Visão do que está em andamento", "Aprovação de entregas com 1 clique", "Solicitar produção quando quiser", "Conversa e histórico"],
    shots: ["portal-client"], caption: "Portal do cliente." }),
  feat({ n: "02 · Estratégia", kicker: "Estratégia & Radar", title: "Um diagnóstico de mercado feito para você",
    lead: "A IA pesquisa o seu segmento na web — tendências atuais, personas de quem compra, concorrentes e metas realistas para o seu orçamento — e mantém um radar do que muda no mercado.",
    why: "Decisão de marketing sem pesquisa é aposta. Você começa de um diagnóstico com dados reais, não de achismo.",
    bullets: ["Pesquisa real e atual do setor", "Personas de quem realmente compra", "Análise de concorrentes", "Radar de tendências"],
    shots: ["am-strategy", "am-radar"], caption: "Estratégia & deep dive (esq.) e radar de mercado (dir.)." }),
  feat({ n: "03 · Execução", kicker: "Campanha, Identidade & Social", title: "Do plano ao post, tudo pronto",
    lead: "Plano de campanha acionável, identidade visual, calendário social e posts prontos (feed, Stories, Reels) — no seu idioma e no tom da sua marca. Tudo editável.",
    why: "Ideia que não vira execução não vende. Você sai com material pronto para publicar, não com um PDF que ninguém aplica.",
    bullets: ["Plano de campanha acionável", "Identidade visual e paleta", "Calendário social + posts prontos", "Edição livre, no seu tom"],
    shots: ["am-campaign", "am-identity"], caption: "Plano de campanha (esq.) e identidade visual (dir.)." }),
  feat({ n: "04 · Conteúdo", kicker: "Calendário & Posts", title: "Um mês de conteúdo, sem apagão de ideias",
    lead: "Calendário social completo com temas por dia e lotes de posts prontos por formato — feed, Stories, Reels e carrossel — com legenda e hashtags.",
    why: "Consistência é o que constrói audiência. Ter o mês planejado e os posts prontos elimina a maior dor de quem cuida do próprio marketing.",
    bullets: ["Calendário por período", "Posts por formato (Stories/Reels)", "Legendas e hashtags prontas", "Tudo editável"],
    shots: ["am-social", "am-posts"], caption: "Calendário social (esq.) e lote de posts (dir.)." }),
  feat({ n: "05 · Retorno", kicker: "ROI & Vendas", title: "Saiba quanto o marketing te devolve",
    lead: "A plataforma projeta o retorno esperado com metas e roadmap, e conecta suas vendas reais (loja, marketplace, GA4) para comparar o previsto com o que realmente aconteceu.",
    why: "Marketing precisa pagar a conta. Ver o ROI projetado × real coloca cada real investido sob a luz — você investe onde funciona.",
    bullets: ["Projeção de retorno com metas", "Conexão com suas vendas reais", "Produto ou serviço (qualquer setor)", "Impacto visível nos números"],
    shots: ["am-roi", "am-vendas"], caption: "ROI projetado (esq.) e vendas & dados conectados (dir.)." }),
  feat({ n: "06 · Produção", kicker: "Demandas & Revisões", title: "Peça produção e revise sem ruído",
    lead: "Precisa de um ensaio, um design ou uma arte? Abra uma demanda e a plataforma conecta o profissional certo. Na entrega, você revisa fixando comentários no ponto exato da imagem e aprova com um clique.",
    why: "Revisão por áudio e print no WhatsApp gera retrabalho. Aqui o feedback é objetivo e rastreável — o que você pede é o que volta.",
    bullets: ["Abra demandas quando quiser", "Profissional certo por IA", "Revisão com pin na imagem", "Aprovação e pagamento seguro"],
    shots: ["am-demandas"], caption: "Demandas e produção conectadas à sua conta." }),
  cta({ title: "Sua marca merece começar agora",
    steps: [
      "Preencha um briefing rápido sobre o seu negócio — é o que alimenta toda a IA.",
      "Gere seu primeiro kit: estratégia, campanha, identidade e social de uma vez.",
      "Acompanhe, aprove e conecte suas vendas para ver o retorno real.",
    ],
    big: "Comece grátis — sua marca, acelerada por IA." }),
];

// ==================== PROFISSIONAL ====================
const professional = [
  cover({
    badge: "Para profissionais",
    title: `Trabalhos reais.<br><span class="hl">Pagamento garantido.</span>`,
    sub: "Fotógrafos e designers: monte seu perfil, receba demandas com match por IA que olha seu portfólio, candidate-se com um pitch e seja pago com segurança via escrow. Suba de elo e ganhe visibilidade.",
  }),
  feat({ n: "01 · Perfil", kicker: "Seu perfil", title: "Seu portfólio trabalhando por você",
    lead: "Monte um perfil com skills, foco de mercado e portfólio hospedado. Seu elo (Bronze → Platina) cresce com entregas bem avaliadas — mérito real, não quem grita mais alto.",
    why: "Você é escolhido pela qualidade do trabalho, não por quem tem o maior orçamento de anúncio. Quanto melhor entrega, mais visível fica.",
    bullets: ["Perfil com skills e foco", "Portfólio hospedado", "Elo por mérito (Bronze → Platina)", "Ganhos e histórico"],
    shots: ["pro-profile"], caption: "Perfil do profissional com elo e estatísticas." }),
  feat({ n: "02 · Oportunidades", kicker: "Demandas & Match", title: "Demandas reais, e você se candidata com um pitch",
    lead: "Demandas abertas aparecem no seu painel. Você se candidata enviando uma mensagem que convence — e a IA faz o match pelo seu histórico e pelas imagens do seu portfólio.",
    why: "Menos tempo caçando cliente, mais tempo produzindo. O match por qualidade coloca o trabalho certo na sua frente — e o pitch te dá a chance de brilhar.",
    bullets: ["Demandas abertas no seu painel", "Candidatura com mensagem (pitch)", "Match por histórico + portfólio", "Direto com agência ou cliente"],
    shots: ["am-demandas"], caption: "Uma demanda no marketplace, com match e candidaturas." }),
  feat({ n: "03 · Segurança", kicker: "Revisões, Escrow & Elo", title: "Pagamento garantido e reputação que abre portas",
    lead: "O pagamento fica reservado em escrow antes de você começar e é liberado na aprovação. A revisão é objetiva — comentários fixados na imagem e nota de IA (0–100) — e cada bom trabalho eleva seu elo e sua visibilidade.",
    why: "Você produz sem medo de calote, com feedback claro do que ajustar, e cada entrega vira reputação que atrai a próxima. É crescimento composto.",
    bullets: ["Escrow: pagamento garantido", "Revisão objetiva (pin + nota IA)", "Elo que aumenta sua visibilidade", "Ganhos organizados no perfil"],
    shots: ["pro-profile"], caption: "Ganhos, reputação e elo do profissional." }),
  cta({ title: "Seu próximo trabalho está aqui",
    steps: [
      "Crie seu perfil e suba seu portfólio — leva poucos minutos.",
      "Veja as oportunidades abertas e candidate-se com um pitch que convence.",
      "Entregue com qualidade, receba com segurança e suba de elo.",
    ],
    big: "Crie seu perfil grátis e comece a receber demandas." }),
];

const docs = [
  { file: "agencyhub-para-agencias", title: "AgencyHub — Para Agências", pages: agency },
  { file: "agencyhub-para-clientes", title: "AgencyHub — Para sua Marca", pages: client },
  { file: "agencyhub-para-profissionais", title: "AgencyHub — Para Profissionais", pages: professional },
];

async function run() {
  for (const d of docs) fs.writeFileSync(path.join(pitchDir, `${d.file}.html`), doc(d.title, d.pages));
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage();
  for (const d of docs) {
    await page.goto("file://" + path.join(pitchDir, `${d.file}.html`), { waitUntil: "networkidle" });
    await page.pdf({ path: path.join(pitchDir, `${d.file}.pdf`), format: "A4", printBackground: true,
      margin: { top: "0", bottom: "0", left: "0", right: "0" } });
    console.log("  ✓", d.file + ".pdf");
  }
  await browser.close();
  console.log("\nNota:", AMORA);
  console.log("PDFs em pitch/");
}
run().catch((e) => { console.error("ERRO:", e?.message ?? e); process.exit(1); });
