import type { LegalDoc } from "./legal-types";

// Rascunho sólido para revisão do responsável (não é parecer jurídico).
// Identificação da empresa: só por variáveis de ambiente (ver lib/legal.ts).

export const TERMS_PT: LegalDoc = {
  slug: "termos",
  lang: "pt",
  title: "Termos de Uso",
  intro:
    "Estes termos regem o uso da Marqa, plataforma de marketing com inteligência artificial que conecta agências, marcas e profissionais criativos. Ao criar uma conta ou usar a plataforma, você concorda com eles.",
  sections: [
    {
      heading: "1. Quem somos e como falar com a gente",
      paragraphs: [
        "A Marqa é operada pelo responsável identificado no quadro \"Quem opera a Marqa\" desta página. Dúvidas, pedidos e reclamações chegam pelo formulário de contato do site, que fica registrado e é respondido por e-mail.",
      ],
    },
    {
      heading: "2. Contas",
      paragraphs: [
        "Para usar a plataforma você precisa de uma conta com e-mail válido. Você é responsável por manter a senha em sigilo e por tudo o que acontece na sua conta. Avise a gente pelo formulário de contato se suspeitar de uso indevido.",
        "Contas de marcas e profissionais podem ser criadas por uma agência. Nesse caso a agência recebe uma senha provisória, que deve ser trocada no primeiro acesso.",
        "O cadastro de agências pode depender de aprovação. Podemos suspender ou encerrar contas que violem estes termos, a lei ou que coloquem em risco outras pessoas ou a plataforma.",
      ],
    },
    {
      heading: "3. O que a plataforma faz",
      paragraphs: [
        "A Marqa organiza briefings, clientes, demandas de produção, calendário de conteúdo, aprovações e relatórios, e gera sugestões com inteligência artificial (estratégia, campanhas, textos, identidade visual, rascunhos de resposta, entre outros).",
        "O acompanhamento de pagamentos entre agência, marca e profissional dentro das demandas é apenas um registro de status: a Marqa não recebe, guarda nem repassa esses valores, e não atua como intermediadora ou garantidora desses pagamentos.",
        "Recursos que dependem de terceiros (WhatsApp e Instagram pela API oficial da Meta, Google Analytics, anúncios, voz por IA, geração de imagem) só funcionam quando a conta correspondente está configurada e ativa.",
      ],
    },
    {
      heading: "4. Conteúdo gerado por IA",
      paragraphs: [
        "O conteúdo gerado por IA é uma sugestão e pode conter erros, informações desatualizadas ou afirmações que precisam de comprovação. Revise tudo antes de publicar ou enviar a clientes. Você é responsável pelo uso que faz desse conteúdo, inclusive em anúncios e comunicações com consumidores.",
        "Não use a plataforma para gerar conteúdo ilegal, enganoso, discriminatório, que viole direitos de terceiros ou para enviar mensagens não solicitadas em massa (spam).",
      ],
    },
    {
      heading: "5. Seus dados e seu conteúdo",
      paragraphs: [
        "O conteúdo que você envia (briefings, arquivos, fotos, mensagens) continua sendo seu. Você nos autoriza a armazená-lo e processá-lo apenas para prestar o serviço, incluindo o envio aos provedores de IA descritos na Política de Privacidade.",
        "Você declara ter o direito de usar o que envia, inclusive imagens de pessoas, marcas e obras de terceiros.",
        "Você pode baixar seus dados e excluir sua conta a qualquer momento em Minha conta.",
      ],
    },
    {
      heading: "6. Planos, coins e pagamentos",
      paragraphs: [
        "Há duas formas de contratar um plano. No pagamento avulso (Pix, boleto ou cartão em uma vez) o plano é pré-pago por período (mensal, trimestral, semestral ou anual) e não renova automaticamente: ao fim do período, a conta volta para o plano grátis, sem cobrança nova.",
        "Na assinatura no cartão, você autoriza o Mercado Pago a cobrar o mesmo valor a cada período (mensal por padrão) até você cancelar. A cobrança acontece na data de renovação mostrada em Planos e o valor vigente é o da sua assinatura; se mudarmos o preço, avisamos antes e você pode cancelar. Cada conta tem no máximo uma assinatura no cartão: ao assinar outro plano, a assinatura anterior é cancelada quando a nova for aprovada.",
        "Para cancelar a renovação, é só clicar em \"Cancelar renovação\" na tela Planos — sem multa e sem precisar falar com ninguém. O plano continua valendo até o fim do período já pago e depois a conta volta para o grátis. Se uma cobrança não entrar, o acesso continua por até 3 dias enquanto o Mercado Pago tenta de novo.",
        "Cada plano inclui uma cota mensal de coins, renovada a cada mês do período pago e que não acumula de um mês para o outro. Coins comprados à parte não expiram enquanto a conta existir. Cada ação de IA consome uma quantidade de coins mostrada na plataforma; ações que falham não são cobradas.",
        "Os preços são em reais (R$) e os pagamentos são processados pelo Mercado Pago (Pix, cartão ou boleto). O plano ou os coins são liberados quando o Mercado Pago confirma o pagamento.",
        "Direito de arrependimento, reembolsos e estornos seguem a Política de Reembolso.",
      ],
    },
    {
      heading: "7. Uso justo e limites",
      paragraphs: [
        "Para manter a plataforma estável e os custos sob controle, aplicamos limites de uso por conta e por rede (por exemplo, número de pedidos de IA em alguns minutos) e um teto diário de uso de IA para toda a plataforma. Quando um limite é atingido, a IA pausa temporariamente e o restante da plataforma segue funcionando.",
      ],
    },
    {
      heading: "8. Disponibilidade",
      paragraphs: [
        "Trabalhamos para manter a Marqa disponível, mas podem ocorrer interrupções para manutenção ou por falhas de terceiros (hospedagem, provedores de IA, meios de pagamento). Mantemos cópias de segurança, mas recomendamos que você guarde cópias do que for importante (por exemplo, baixando seus dados).",
      ],
    },
    {
      heading: "9. Responsabilidade",
      paragraphs: [
        "Na medida permitida pela lei, a Marqa não responde por decisões de negócio tomadas com base no conteúdo gerado, por resultados de campanhas, por negociações entre usuários ou por indisponibilidade de serviços de terceiros. Nada nestes termos limita direitos garantidos pelo Código de Defesa do Consumidor.",
      ],
    },
    {
      heading: "10. Mudanças nestes termos",
      paragraphs: [
        "Podemos atualizar estes termos. Mudanças relevantes serão avisadas na plataforma. A data da versão em vigor aparece no topo desta página; o aceite registrado no cadastro guarda a versão aceita.",
      ],
    },
    {
      heading: "11. Lei e foro",
      paragraphs: [
        "Estes termos seguem as leis brasileiras. Se você for consumidor, pode propor ação no foro do seu domicílio.",
      ],
    },
  ],
};

export const PRIVACY_PT: LegalDoc = {
  slug: "privacidade",
  lang: "pt",
  title: "Política de Privacidade",
  intro:
    "Esta política explica quais dados pessoais a Marqa trata, para quê, com quem compartilha e como você exerce seus direitos, conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018, LGPD).",
  sections: [
    {
      heading: "1. Controlador e encarregado",
      paragraphs: [
        "O controlador dos dados é o responsável identificado no quadro \"Quem opera a Marqa\" desta página. Para falar com o encarregado pelo tratamento de dados (DPO), use o formulário de contato escolhendo o assunto \"Privacidade e meus dados (LGPD)\".",
        "Quando uma agência cadastra os próprios clientes e profissionais na plataforma, a agência é controladora desses dados de trabalho e a Marqa atua como operadora, seguindo as instruções da agência.",
        "Marcas que se cadastram direto na Marqa, sem convite de uma agência, são atendidas pelo time da própria Marqa: esse time pode ver e editar os dados da marca para dar suporte e, se a marca escolher ter uma agência cuidando, para fazer as entregas. Nenhuma outra agência vê esses dados.",
      ],
    },
    {
      heading: "2. Dados que tratamos",
      bullets: [
        "Cadastro: nome, e-mail, usuário, senha (guardada só como hash), tipo de conta, data e versão do aceite dos termos, e a origem da visita (parâmetros utm) que trouxe você até o cadastro.",
        "Uso: registros de acesso, IP de origem (para segurança e limites de uso), eventos do primeiro acesso, preferências de tema e idioma.",
        "Medição própria das páginas públicas (sem cookie): página visitada, referência, parâmetros utm, tipo de dispositivo e um identificador que é o hash de um sal do dia + IP + navegador. O sal muda todo dia e não fica guardado com o evento, então o identificador não segue você de um dia para o outro. Guardamos também eventos da sua conta (cadastro, primeiro valor entregue, início de pagamento e pagamento aprovado).",
        "Cliques em links curtos (/l/...) e visitas às páginas de links da marca (/b/...): mesma medição sem cookie, feita para a agência dona do link saber o que funciona.",
        "Aprovação por link: o nome que a pessoa digita ao aprovar ou pedir ajuste, e a data da decisão.",
        "Conteúdo: briefings, arquivos e imagens enviados, entregáveis, comentários, mensagens, relatórios e respostas geradas por IA.",
        "Briefing falado: a transcrição do que você diz. A transcrição é feita pelo reconhecimento de voz do seu navegador (no Chrome, um serviço do Google); a Marqa recebe só o texto e não grava o áudio.",
        "Mensageria (quando conectada pela agência): nome e número/identificador de contatos e o texto das mensagens trocadas pelo WhatsApp/Instagram.",
        "Pagamentos: plano, valores, status e identificador da transação. Os dados do cartão ou do Pix ficam com o Mercado Pago; não os recebemos.",
        "Contato: nome, e-mail e mensagem enviados pelo formulário, e página pública da agência (nome e WhatsApp de quem pede orçamento).",
      ],
    },
    {
      heading: "3. Para que usamos e com qual base legal",
      bullets: [
        "Prestar o serviço contratado (contas, geração de conteúdo, aprovações, relatórios) — execução de contrato (art. 7º, V).",
        "Cobrar planos e coins e emitir registros financeiros — execução de contrato e cumprimento de obrigação legal (art. 7º, II e V).",
        "Segurança, prevenção a fraude e abuso, limites de uso e registros de acesso — legítimo interesse e obrigação legal do Marco Civil da Internet (art. 7º, II e IX).",
        "Responder contatos e pedidos de acesso — procedimentos preliminares a contrato e legítimo interesse (art. 7º, V e IX).",
        "Melhorar o produto com métricas agregadas de uso e medir a origem das visitas e cadastros, sem cookie e sem perfil de pessoa — legítimo interesse (art. 7º, IX).",
      ],
      paragraphs: ["Não vendemos dados pessoais e não usamos seus dados para publicidade de terceiros."],
    },
    {
      heading: "4. Com quem compartilhamos (suboperadores)",
      bullets: [
        "Anthropic (Estados Unidos) — modelos de IA que geram estratégias, textos e análises a partir do conteúdo enviado.",
        "Mercado Pago (Brasil) — processamento de pagamentos em reais. Stripe (Estados Unidos) pode ser usada para pagamentos em outras moedas quando estiver ativa.",
        "ElevenLabs e OpenAI (Estados Unidos) — conversão de texto em voz no briefing falado, quando a voz estiver ativa.",
        "Meta / WhatsApp e Instagram (Estados Unidos e outros países) — envio e recebimento de mensagens, quando a agência conecta a API oficial.",
        "Google (Estados Unidos) — dados do Google Analytics e geração de imagens, apenas quando a conta correspondente é conectada.",
        "Hostinger — hospedagem do servidor onde ficam o banco de dados e os arquivos.",
      ],
      paragraphs: [
        "Também podemos compartilhar dados quando exigido por lei ou por ordem de autoridade competente.",
      ],
    },
    {
      heading: "5. Transferência internacional",
      paragraphs: [
        "Alguns provedores acima tratam dados fora do Brasil. Essas transferências são feitas para cumprir o contrato com você (art. 33, II e IX da LGPD) e com provedores que adotam cláusulas contratuais e medidas de segurança compatíveis com a LGPD. Evite incluir dados sensíveis em briefings e mensagens.",
      ],
    },
    {
      heading: "6. Por quanto tempo guardamos",
      bullets: [
        "Dados da conta e conteúdo: enquanto a conta existir. Ao excluir a conta, apagamos os dados da conta e do espaço de trabalho próprio (marca que se cadastrou sozinha ou perfil de profissional).",
        "Registros financeiros: mantidos pelo prazo exigido pela legislação fiscal (em geral, 5 anos), sem vínculo com a pessoa após a exclusão da conta.",
        "Registros de acesso (data, hora e IP de logins): 6 meses, como exige o Marco Civil da Internet, e depois apagados.",
        "Eventos de medição das páginas públicas e de cliques em links: 90 dias na forma detalhada; depois disso fica só a contagem por dia, sem identificador.",
        "Mensagens de contato: até 2 anos depois de respondidas.",
        "Cópias de segurança: rotacionadas em poucas semanas; dados excluídos saem delas ao fim desse ciclo.",
      ],
    },
    {
      heading: "7. Seus direitos e como exercer",
      paragraphs: [
        "Você pode pedir confirmação e acesso aos dados, correção, anonimização, bloqueio ou eliminação, portabilidade, informação sobre compartilhamento e revogação de consentimento (art. 18 da LGPD).",
        "Em Minha conta você baixa seus dados em JSON e exclui a conta sozinho. Para os demais pedidos, use o formulário de contato com o assunto \"Privacidade e meus dados (LGPD)\"; respondemos em até 15 dias. Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).",
        "Se a sua conta foi criada por uma agência, alguns dados de trabalho pertencem a ela: podemos encaminhar seu pedido à agência.",
      ],
    },
    {
      heading: "8. Segurança",
      paragraphs: [
        "Usamos conexão criptografada (HTTPS), senhas com hash forte, sessões que expiram e podem ser revogadas, limites contra tentativas repetidas e controle de acesso por tipo de conta. Nenhum sistema é totalmente imune; se houver incidente relevante, avisaremos os afetados e a ANPD conforme a lei.",
      ],
    },
    {
      heading: "9. Cookies",
      paragraphs: [
        "Usamos apenas cookies essenciais (sessão de login) e armazenamento no navegador para preferências de tema e idioma e para guardar, durante a aba aberta, a origem (utm) da sua primeira visita. Nossa medição de audiência não usa cookie nem rastreador de terceiros. Detalhes na Política de Cookies.",
      ],
    },
    {
      heading: "10. Crianças e adolescentes",
      paragraphs: ["A Marqa é destinada a maiores de 18 anos e a empresas. Não coletamos intencionalmente dados de menores."],
    },
    {
      heading: "11. Atualizações",
      paragraphs: ["Esta política pode mudar. A data da versão em vigor aparece no topo; mudanças relevantes serão avisadas na plataforma."],
    },
  ],
};

export const REFUNDS_PT: LegalDoc = {
  slug: "reembolso",
  lang: "pt",
  title: "Política de Reembolso e Cancelamento",
  intro: "Como funcionam arrependimento, reembolso e cancelamento de planos e pacotes de coins da Marqa.",
  sections: [
    {
      heading: "1. Direito de arrependimento (7 dias)",
      paragraphs: [
        "Como a contratação é feita pela internet, você pode desistir em até 7 dias corridos a partir do pagamento confirmado, com devolução integral do valor pago, conforme o art. 49 do Código de Defesa do Consumidor.",
        "Para pedir, use o formulário de contato com o assunto \"Pagamento, plano ou reembolso\", informando o e-mail da conta e, se tiver, o número do pagamento no Mercado Pago.",
      ],
    },
    {
      heading: "2. Como devolvemos",
      paragraphs: [
        "O estorno é feito pelo Mercado Pago no mesmo meio usado no pagamento: Pix volta para a conta de origem; cartão aparece como crédito na fatura (o prazo depende do emissor, em geral até duas faturas); boleto é devolvido por transferência para uma conta sua.",
        "Quando o estorno é confirmado, o plano pago volta para o grátis e os coins do pacote são retirados da carteira.",
      ],
    },
    {
      heading: "3. Assinatura no cartão: como cancelar",
      paragraphs: [
        "A assinatura no cartão renova sozinha a cada período até você cancelar. Para cancelar, entre em Planos e clique em \"Cancelar renovação\": nada mais é cobrado, o plano vale até o fim do período já pago e depois a conta volta para o grátis. Você também pode cancelar a autorização direto no Mercado Pago.",
        "O prazo de arrependimento de 7 dias vale para cada cobrança: se você cancelar em até 7 dias corridos de uma renovação, devolvemos o valor daquela cobrança e o plano volta para o grátis.",
        "Se a renovação não for paga, o acesso continua por até 3 dias enquanto o Mercado Pago tenta de novo; depois a conta volta para o plano grátis, sem cobrança pendente.",
      ],
    },
    {
      heading: "4. Depois dos 7 dias",
      paragraphs: [
        "Fora do prazo de arrependimento, não reembolsamos o período já iniciado nem coins já comprados, salvo falha nossa que impeça o uso do serviço, erro de cobrança ou quando a lei exigir. Nesses casos, fale com a gente pelo formulário de contato.",
      ],
    },
    {
      heading: "5. Ações de IA que falham",
      paragraphs: ["Se uma ação de IA falhar, os coins reservados para ela voltam automaticamente para a carteira."],
    },
    {
      heading: "6. Pagamentos entre agência, marca e profissional",
      paragraphs: [
        "Valores combinados entre agência, marca e profissional dentro das demandas são negociados e pagos diretamente entre eles. A Marqa não intermedeia nem reembolsa esses pagamentos.",
      ],
    },
  ],
};

export const COOKIES_PT: LegalDoc = {
  slug: "cookies",
  lang: "pt",
  title: "Política de Cookies",
  intro: "A Marqa usa somente o necessário para funcionar. Por isso não exibimos banner de consentimento.",
  sections: [
    {
      heading: "Cookies essenciais",
      bullets: [
        "agencyhub_session — mantém você conectado. Criptograficamente assinado, acessível só pelo servidor (HttpOnly), enviado apenas por HTTPS em produção, expira em até 30 dias ou quando você sai.",
      ],
    },
    {
      heading: "Armazenamento local do navegador",
      bullets: [
        "Tema claro/escuro e idioma da interface.",
        "Marcações de telas de boas-vindas e celebrações já vistas.",
        "marqa_ft — a origem (utm) da sua primeira visita, guardada só enquanto a aba fica aberta e enviada junto se você criar conta.",
      ],
      paragraphs: ["Esses dados ficam só no seu navegador e não são usados para rastrear você."],
    },
    {
      heading: "Medição de audiência sem cookie",
      paragraphs: [
        "Contamos visitas às páginas públicas, cliques em links curtos (/l/...) e visitas às páginas de links das marcas (/b/...) no nosso próprio servidor, sem cookie: o visitante é identificado por um hash de um sal do dia + IP + navegador, que muda todo dia. Os eventos detalhados ficam 90 dias; depois disso só a contagem por dia.",
      ],
    },
    {
      heading: "O que não usamos",
      paragraphs: [
        "Não usamos cookies de publicidade, pixels de redes sociais nem ferramentas de rastreamento de terceiros. Se isso mudar, pediremos seu consentimento antes.",
        "Você pode apagar cookies e dados do site nas configurações do navegador; ao apagar o cookie de sessão, será preciso entrar de novo.",
      ],
    },
  ],
};
