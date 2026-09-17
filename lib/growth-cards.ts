import type { IconName } from "@/components/icons";

// Cards do hub Crescimento (puro). `stat` mostra um número real da agência.
export type GrowthStats = {
  prospects: number;
  openProposals: number;
  acceptedProposals: number;
  leads: number;
  pagePublished: boolean;
  clicks30: number;
  bioPages: number;
};

export type GrowthCard = {
  key: string;
  icon: IconName;
  title: string;
  body: string;
  href: string;
  cta: string;
  stat: (s: GrowthStats) => string;
};

export const GROWTH_CARDS: GrowthCard[] = [
  {
    key: "prospecting",
    icon: "radar",
    title: "Prospecção",
    body: "A IA procura empresas do seu nicho e região, com motivo e primeira mensagem para cada uma.",
    href: "/prospecting",
    cta: "Buscar prospects",
    stat: (s) => (s.prospects ? `${s.prospects} prospects salvos` : "Nenhum prospect ainda"),
  },
  {
    key: "proposals",
    icon: "send",
    title: "Propostas",
    body: "Uma página com pitch, pacotes e prazo. O prospect aceita sem login e já vira cliente.",
    href: "/prospecting#propostas",
    cta: "Criar proposta",
    stat: (s) => `${s.openProposals} em aberto · ${s.acceptedProposals} aceitas`,
  },
  {
    key: "public-page",
    icon: "globe",
    title: "Página pública",
    body: "Serviços, trabalhos e depoimentos no seu endereço. O formulário vira prospect e avisa você.",
    href: "/settings#pagina-publica",
    cta: "Configurar página",
    stat: (s) => (s.pagePublished ? `Publicada · ${s.leads} pedidos recebidos` : "Ainda não publicada"),
  },
  {
    key: "links",
    icon: "link",
    title: "Links & bio",
    body: "Link curto com UTM em cada post e uma página de link na bio por cliente. Você vê o que dá clique.",
    href: "/links",
    cta: "Ver links",
    stat: (s) => `${s.clicks30} cliques em 30 dias · ${s.bioPages} bio(s) no ar`,
  },
];
