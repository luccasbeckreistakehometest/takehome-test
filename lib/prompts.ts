import type { Client, GenerationType } from "./types";
import {
  campaignPlanSchema,
  marketPulseSchema,
  postBatchSchema,
  productRecsSchema,
  roiProjectionSchema,
  socialCalendarSchema,
  strategyAnalysisSchema,
  visualIdentitySchema,
} from "./schemas";
import { clientReportSchema } from "./marketplace-schemas";

function agencySystem(client: Client): string {
  const language =
    client.language === "en"
      ? "Write every deliverable in English (US)."
      : "Escreva todos os entregáveis em português do Brasil.";
  return `Você é o estrategista-chefe de uma agência de marketing full-service, com 15 anos de experiência em branding, performance, growth e social media. Você produz entregáveis prontos para apresentar ao cliente: específicos, acionáveis e fundamentados no briefing — nunca genéricos. ${language} Quando o briefing não cobrir algum ponto, tome decisões plausíveis para o segmento em vez de deixar lacunas.

Escreva como um profissional humano sênior escreveria — direto, específico e com opinião — nunca com cara de texto de IA. Evite: clichês de assistente ("Claro!", "Com certeza", "Vale ressaltar", "É importante notar", "No cenário atual", "game-changer"), excesso de exclamações, adjetivos vazios ("incrível", "poderoso") e recomendações que serviriam para qualquer empresa. Nunca mencione que você é uma IA, nem faça referência a prompts, briefings "fornecidos" ou dados "disponibilizados" — escreva como quem conhece o cliente e vai apresentar o material pessoalmente na reunião.`;
}

export function clientContext(client: Client): string {
  const field = (label: string, value: string) =>
    value.trim() ? `${label}: ${value.trim()}` : null;
  const lines = [
    field("Cliente", client.name),
    field("Segmento", client.industry),
    field("Sobre a empresa", client.description),
    field("Público-alvo", client.audience),
    field("Tom de voz", client.tone),
    field("Objetivos de marketing", client.goals),
    field("Verba mensal", client.budget),
    client.channels.length ? `Canais ativos: ${client.channels.join(", ")}` : null,
    field("Diferenciais", client.differentials),
    field("Recursos e capacidade produtiva", client.capabilities),
    field("Concorrentes", client.competitors),
    field("Cores/identidade atual", client.brandColors),
    field("Site", client.website),
    field("Instagram", client.instagram),
    field("Observações", client.notes),
    `País / mercado-alvo: ${client.country || "Brasil"}`,
    `Idioma dos entregáveis: ${client.language === "en" ? "inglês (US)" : "português (BR)"}`,
  ].filter(Boolean);
  return `<briefing_do_cliente>\n${lines.join("\n")}\n</briefing_do_cliente>`;
}

export type GenerationContext = {
  // Conteúdo (truncado) da análise estratégica mais recente do cliente,
  // para que os demais entregáveis evoluam junto com o mercado.
  strategy?: string;
};

export type GenerationSpec = {
  title: string;
  system: string;
  prompt: string;
  schema?: Record<string, unknown>;
  maxTokens?: number;
  useWebSearch?: boolean;
  // premium = Opus sempre; standard = Sonnet quando o modo econômico está ativo
  tier?: "premium" | "standard";
};

export function buildGenerationSpec(
  type: GenerationType,
  client: Client,
  params: Record<string, unknown>,
  context: GenerationContext = {}
): GenerationSpec {
  const briefing = clientContext(client);
  const system = agencySystem(client);
  const p = (key: string, fallback = "") => {
    const value = params[key];
    return typeof value === "string" && value.trim() ? value.trim() : fallback;
  };
  const num = (key: string, fallback: number) => {
    const value = Number(params[key]);
    return Number.isFinite(value) && value > 0 ? Math.round(value) : fallback;
  };

  const strategyBlock = context.strategy
    ? `\n\n<estrategia_vigente>\n${context.strategy}\n</estrategia_vigente>\nAlinhe este entregável à estratégia vigente acima (personas, metas e recomendações), a menos que os ajustes solicitados digam o contrário.`
    : "";

  // Refinamento com input humano: feedback da equipe + versão anterior
  const feedback = p("feedback");
  const previous = p("previous");
  const refinementBlock = `${
    previous
      ? `\n\n<versao_anterior>\n${previous.slice(0, 12000)}\n</versao_anterior>\nEvolua a partir da versão anterior em vez de recomeçar do zero: mantenha o que funciona e melhore o resto.`
      : ""
  }${
    feedback
      ? `\n\nAjustes solicitados pela equipe (prioridade máxima): ${feedback}`
      : ""
  }`;

  const spec = ((): GenerationSpec => {
    switch (type) {
      case "strategy_analysis": {
        const focus = p("focus");
        return {
          title: "Estratégia & Deep Dive",
          system,
          schema: strategyAnalysisSchema,
          useWebSearch: true,
          tier: "premium",
          maxTokens: 36000,
          prompt: `${briefing}

Faça um deep dive estratégico completo deste cliente, fundamentado em pesquisa real na web (use a busca para dados atuais do segmento, tendências e concorrentes — cite as fontes no campo "source").${focus ? ` Foco especial solicitado pela agência: ${focus}.` : ""}

Foco geográfico: pesquise prioritariamente o mercado de ${client.country || "Brasil"} (concorrentes, comportamento do consumidor, dados locais). Complemente com o que está acontecendo no exterior nesse segmento — movimentos que ainda não chegaram a ${client.country || "Brasil"} e que podem virar tendência lá; quando citar um insight internacional, sinalize a origem e por que tende a migrar para o mercado-alvo.

Requisitos:
- Sumário executivo direto ao ponto.
- 4 a 6 tendências atuais do mercado deste segmento, cada uma com implicação prática para o cliente e fonte da informação.
- 2 a 4 personas de target buyers com perfil detalhado, dores, desejos, canais onde estão e gatilhos de compra.
- Análise dos principais concorrentes (os citados no briefing + os que você encontrar na pesquisa): posicionamento, forças, fraquezas e a oportunidade que abrem para o cliente.
- "Best fits": as apostas de marketing com melhor encaixe para este cliente agora, priorizadas (alta/média/baixa) e justificadas.
- Metas SMART: objetivo, métrica, alvo numérico e prazo.`,
        };
      }

      case "market_pulse": {
        return {
          title: `Radar de mercado — ${new Date().toLocaleDateString("pt-BR")}`,
          system,
          schema: marketPulseSchema,
          useWebSearch: true,
          tier: "standard",
          maxTokens: 24000,
          prompt: `${briefing}

Você é o radar diário desta conta. Pesquise na web o que mudou RECENTEMENTE (últimos dias/semanas) no mercado deste cliente: notícias do segmento, movimentos de concorrentes, mudanças de plataforma/algoritmo, trends de conteúdo e comportamento do consumidor. Priorize o mercado de ${client.country || "Brasil"}, mas inclua também movimentos internacionais do segmento que ainda não chegaram lá e podem virar tendência — sinalizando a origem.

Requisitos:
- Resumo do momento em um parágrafo.
- 3 a 6 destaques recentes com fonte, o que mudou e por que importa para este cliente.
- Mudanças de tendência (subindo/descendo/estável) com ação recomendada para cada uma.
- Recomendações de ajuste na estratégia vigente, com urgência (agir agora / esta semana / monitorar) e justificativa.
- Watchlist: o que acompanhar nos próximos dias.`,
        };
      }

      case "campaign_plan": {
        const month = p("month", "o próximo mês");
        const focus = p("focus");
        return {
          title: `Plano de campanha — ${month}`,
          system,
          schema: campaignPlanSchema,
          useWebSearch: true,
          tier: "standard",
          prompt: `${briefing}

Monte o plano de campanha mensal deste cliente para ${month}.${focus ? ` Foco especial solicitado pela agência: ${focus}.` : ""}

Requisitos:
- Tema central criativo e coerente com o posicionamento do cliente.
- 3 a 5 objetivos, cada um com KPI mensurável e meta numérica realista para o porte do cliente.
- Plano semana a semana (4 a 5 semanas) com ações concretas e executáveis.
- Estratégia por canal (use os canais ativos do briefing; sugira no máximo 1 canal novo se fizer sentido).
- Distribuição de verba em percentuais que somem 100%, com justificativa.
- Riscos/pontos de atenção do mês.
- Influenciadores: SE (e somente se) parceria com influenciadores/creators fizer sentido neste plano, use a busca na web (com moderação, no máximo 4 buscas) para encontrar 2 a 4 influenciadores REAIS do nicho/região do cliente na rede recomendada — com @handle, URL do perfil, faixa de seguidores, por que tem fit com a marca e e-mail de contato público se encontrar (senão deixe vazio). Se não fizer sentido para o mês, retorne a lista vazia e não faça nenhuma busca.`,
        };
      }

      case "roi_projection": {
        const timeframe = p("timeframe", "6 meses");
        const baseline = p("baseline");
        return {
          title: `ROI & Roadmap — ${timeframe}`,
          system,
          schema: roiProjectionSchema,
          tier: "standard",
          prompt: `${briefing}

Monte a projeção de ROI e o roadmap de marketing deste cliente para os próximos ${timeframe}.${baseline ? `\nMétricas atuais informadas pela equipe (use como "antes"): ${baseline}` : "\nO briefing não traz métricas atuais: estime um baseline realista para o porte/segmento do cliente e deixe isso claro nas premissas."}

Requisitos:
- Premissas explícitas e conservadoras (deixe claro que são projeções, não garantias).
- Quebra do investimento mensal por item (mídia, produção, ferramentas, gestão...), coerente com a verba do briefing.
- Tabela de métricas antes → depois (ex.: tráfego, leads/mês, taxa de conversão, CAC, ticket médio, receita atribuída), com uplift esperado.
- Cálculo de ROI: investimento total no período, retorno projetado, ROI em %, payback e explicação da conta em linguagem simples.
- Roadmap por fases (ex.: fundação, tração, escala) com período, marcos concretos e impacto esperado de cada fase.
- Use a moeda do país do cliente (${client.country || "Brasil"}) e valores realistas para aquele mercado.`,
        };
      }

      case "social_calendar": {
        const month = p("month", "o próximo mês");
        const perWeek = num("postsPerWeek", 3);
        return {
          title: `Calendário social — ${month}`,
          system,
          schema: socialCalendarSchema,
          tier: "standard",
          maxTokens: 32000,
          prompt: `${briefing}

Crie o calendário de conteúdo de redes sociais deste cliente para ${month}, com ${perWeek} posts por semana (aprox. ${perWeek * 4} posts no total).

Requisitos:
- Distribua os posts ao longo do mês (campo "day" = dia do mês) e entre os canais ativos do cliente.
- Varie os formatos (carrossel, reels/vídeo curto, estático, stories, live etc.) conforme o canal.
- Cada post precisa de: legenda completa pronta para publicar (com emojis na medida do tom de voz), hashtags relevantes (5 a 10), direção de arte objetiva para o designer e CTA claro.
- Equilibre pilares de conteúdo: educar, engajar, prova social e conversão.`,
        };
      }

      case "post_batch": {
        const topic = p("topic", "um tema relevante para o negócio");
        const channel = p("channel", "Instagram");
        const format = p("format", "Feed");
        const quantity = Math.min(num("quantity", 3), 10);
        const formatNote =
          format === "Stories"
            ? `\n- Formato STORIES: cada variação é uma sequência de 3 a 5 telas — descreva tela a tela (texto na tela, visual, sticker interativo como enquete/quiz/caixa de perguntas quando fizer sentido) e o CTA final (link/arrasta pra cima).`
            : format === "Reels"
              ? `\n- Formato REELS: roteiro com gancho nos 2 primeiros segundos, cenas descritas, texto em tela, áudio/trend sugerido e CTA.`
              : format === "Carrossel"
                ? `\n- Formato CARROSSEL: descreva card a card (5 a 8 cards), com o texto de cada um e a direção de arte da sequência.`
                : "";
        return {
          title: `Posts — ${topic} (${format})`,
          system,
          schema: postBatchSchema,
          tier: "standard",
          maxTokens: 16000,
          prompt: `${briefing}

Crie ${quantity} variações de post em formato ${format} para ${channel} sobre: ${topic}.${formatNote}

Requisitos:
- Cada variação com um ângulo criativo diferente (nomeie o ângulo no campo "variation": ex. dor do cliente, prova social, bastidores, dado surpreendente...).
- Hook forte na primeira linha, legenda completa pronta para publicar no tom de voz do cliente, hashtags e CTA.
- Direção de arte objetiva para o designer executar sem reunião.`,
        };
      }

      case "visual_identity": {
        const direction = p("direction");
        return {
          title: "Identidade visual",
          system,
          schema: visualIdentitySchema,
          tier: "premium",
          maxTokens: 40000,
          prompt: `${briefing}

Desenvolva a proposta de identidade visual e verbal deste cliente.${direction ? ` Direcionamento da agência: ${direction}.` : ""}

Requisitos:
- Essência da marca em um parágrafo (posicionamento + personalidade).
- 5 opções de slogan.
- 3 conceitos de logo, cada um com nome, justificativa e o código SVG completo (viewBox="0 0 240 80", vetorial limpo, usando as cores da paleta proposta, com o nome da marca em <text> ou formas tipográficas; sem imagens externas).
- Paleta de 4 a 6 cores com hex, nome criativo e uso de cada uma (se o briefing citar cores atuais, evolua a partir delas).
- Tipografia: papel (título/corpo/destaque), fonte principal (Google Fonts) e alternativa de sistema, com observações de uso.
- Tom de voz: descrição, 4 a 6 "faça" e 4 a 6 "não faça".
- Aplicações prioritárias (onde a identidade deve aparecer primeiro).`,
        };
      }

      case "product_recs": {
        return {
          title: "Oportunidades de oferta",
          system,
          schema: productRecsSchema,
          useWebSearch: true,
          tier: "standard",
          maxTokens: 24000,
          prompt: `${briefing}

Cruze o que este cliente TEM (recursos, capacidade produtiva, equipe, equipamentos, serviços possíveis — veja "Recursos e capacidade produtiva" no briefing) com as tendências atuais do mercado de ${client.country || "Brasil"} (pesquise na web; complemente com movimentos do exterior que tendem a chegar lá) e recomende o que ele deveria passar a produzir/ofertar.

Adapte o tipo de recomendação ao negócio — isso é obrigatório:
- Indústria/confecção/fabricação: produtos em tendência que a capacidade instalada declarada permite produzir (ex.: com os tecidos, máquinas e cores disponíveis).
- Serviços e profissionais liberais (médicos, advogados, consultores...): NÃO recomende "produtos para investir" — recomende serviços/áreas da própria atuação a enfatizar, reposicionar ou lançar.
- Varejo/food: mix de produtos ou itens de cardápio em alta que fazem sentido para a operação atual.

Requisitos:
- 3 a 6 oportunidades, cada uma com: o que é, a tendência real que a sustenta (com fonte da pesquisa), por que é viável com a capacidade declarada (cite os recursos do briefing), como começar, esforço (baixo/médio/alto) e potencial.
- NUNCA recomende algo fora da capacidade declarada — se o briefing não declara capacidade, derive do segmento e sinalize a suposição.
- "repositioning": 2 a 4 recomendações de ênfase/reposicionamento do que o cliente JÁ faz (áreas subaproveitadas que o mercado está valorizando).`,
        };
      }

      case "client_report": {
        const period = p("period", "o último mês");
        const platformData = p("platformData", "Sem dados adicionais da plataforma.");
        const audienceLabel =
          p("audienceRole") === "professional"
            ? "para os profissionais terceirizados envolvidos (foco no que produzir e nos padrões de qualidade)"
            : p("audienceRole") === "client"
              ? "para o cliente final (linguagem de negócio, sem jargão de agência)"
              : "para o time interno da agência (visão completa e crítica)";
        return {
          title: `Relatório executivo — ${period}`,
          system,
          schema: clientReportSchema,
          tier: "standard",
          maxTokens: 16000,
          prompt: `${briefing}

<dados_da_plataforma>
${platformData}
</dados_da_plataforma>

Escreva o relatório executivo desta conta referente a ${period}, ${audienceLabel}.

Requisitos:
- Sumário executivo honesto: o que foi feito, o que avançou e o que travou.
- Destaques (conquistas concretas, com números quando os dados permitirem).
- Workstreams: uma linha por frente (estratégia, campanhas, social, demandas com profissionais, landing pages...), com status e detalhe.
- Visão de qualidade: use as notas das análises de arte e o andamento das demandas nos dados da plataforma.
- Próximos passos priorizados e riscos/pendências.
- Baseie-se APENAS nos dados fornecidos — não invente resultados que não estão lá.`,
        };
      }

      case "landing_page": {
        const objective = p("objective", "gerar leads");
        const offer = p("offer", "o principal produto/serviço do cliente");
        const cta = p("cta", client.language === "en" ? "Contact us" : "Fale conosco");
        const style = p("style");
        return {
          title: `Landing page — ${offer}`,
          system: `${system}

Você também é um desenvolvedor front-end sênior especializado em landing pages de alta conversão. Você entrega um único arquivo HTML completo, válido e autocontido (CSS e JS inline), responsivo mobile-first, sem dependências externas além de Google Fonts. Design profissional e específico para a marca — nunca aparência genérica de template.`,
          maxTokens: 64000,
          prompt: `${briefing}

Crie a landing page completa deste cliente.

Especificação:
- Objetivo da página: ${objective}.
- Oferta/produto em destaque: ${offer}.
- CTA principal: "${cta}".${style ? `\n- Direção visual solicitada: ${style}.` : ""}
- Estrutura mínima: hero com headline forte e CTA, seção de benefícios, como funciona / serviços, prova social (depoimentos plausíveis, sinalizados como exemplo), FAQ (4-6 perguntas), CTA final e rodapé com dados do cliente.
- Formulário de contato (nome, e-mail, telefone, mensagem) com validação simples em JS e mensagem de sucesso simulada (sem backend).
- Responsiva (mobile-first), semântica (header/main/section/footer), meta tags de SEO e Open Graph preenchidas, favicon em emoji via data URI.
- Use as cores da marca do briefing (ou derive uma paleta coerente), micro-interações sutis em CSS e hierarquia tipográfica clara.
- Todos os textos no idioma do cliente, específicos para este cliente (nada de lorem ipsum).

Responda APENAS com o documento HTML, começando em <!doctype html>. Não use markdown.`,
        };
      }
    }
  })();

  // Estratégia vigente alimenta os entregáveis táticos; radar e a própria
  // estratégia fazem pesquisa própria e não precisam dela duplicada.
  const usesStrategy = !["strategy_analysis"].includes(type);
  return {
    ...spec,
    prompt: `${spec.prompt}${usesStrategy ? strategyBlock : ""}${refinementBlock}`,
  };
}
