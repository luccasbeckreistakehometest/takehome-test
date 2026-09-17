"use client";

import Link from "next/link";
import { Icon, type IconName } from "./icons";

// Os diferenciais da plataforma, visíveis na Hoje — cada card é âncora do
// tour guiado e leva para onde a feature vive.
const ITEMS: { anchor: string; icon: IconName; title: string; body: string; href: string; cta: string }[] = [
  {
    anchor: "diff-report",
    icon: "doc",
    title: "Relatório mensal em 1 clique",
    body: "Entregas, aprovações, posts, métricas e vendas do mês com resumo da IA — imprimível e compartilhável no portal.",
    href: "/clients",
    cta: "Escolher cliente",
  },
  {
    anchor: "diff-approval",
    icon: "check",
    title: "Aprovação que dispara ação",
    body: "Cliente aprovou no portal? Peça social vira rascunho no calendário e você recebe o aviso no WhatsApp.",
    href: "/settings",
    cta: "Ver regras",
  },
  {
    anchor: "diff-attendant",
    icon: "whatsapp",
    title: "Atendente de WhatsApp com IA",
    body: "Responde os clientes de cada marca 24/7 na voz dela, sem inventar preço, e chama uma pessoa quando precisa.",
    href: "/clients",
    cta: "Configurar por cliente",
  },
  {
    anchor: "diff-proposal",
    icon: "send",
    title: "Proposta pública em 5 minutos",
    body: "De um prospect a uma página com pitch, pacotes e prazo. Ele aceita sem login e já vira cliente.",
    href: "/prospecting",
    cta: "Abrir prospecção",
  },
  {
    anchor: "diff-calendar",
    icon: "calendar",
    title: "Calendário de conteúdo",
    body: "Semana ou mês por cliente, status com um clique e aviso dos dias sem conteúdo.",
    href: "/calendar",
    cta: "Abrir calendário",
  },
  {
    anchor: "diff-public-page",
    icon: "globe",
    title: "Página pública da agência",
    body: "Portfólio, clientes e depoimentos em /a/sua-agencia, com formulário que vira prospect e avisa você na hora.",
    href: "/settings#pagina-publica",
    cta: "Configurar página",
  },
  {
    anchor: "diff-pulse",
    icon: "target",
    title: "Pulso do cliente e NPS",
    body: "Depois de cada aprovação e uma vez por mês o cliente responde em 1 clique; a cada trimestre, o NPS. Quem está esfriando aparece aqui.",
    href: "/insights#pulso",
    cta: "Ver quem está em risco",
  },
  {
    anchor: "diff-margin",
    icon: "clock",
    title: "Horas e margem por cliente",
    body: "Cronômetro por demanda, custo/hora da equipe e fee mensal: quanto cada cliente rende de verdade — e quem dá prejuízo.",
    href: "/finance",
    cta: "Ver margem do mês",
  },
  {
    anchor: "diff-brand-voice",
    icon: "sparkle",
    title: "Guardião da voz da marca",
    body: "Antes de agendar um post ou enviar uma resposta, um clique checa tom, termos proibidos, CTA, hashtags e alegações sem fonte — e reescreve no tom.",
    href: "/calendar",
    cta: "Checar um post",
  },
  {
    anchor: "diff-campaign",
    icon: "megaphone",
    title: "Campanha de 30 dias",
    body: "Briefing + objetivo + canais viram um mês inteiro de posts escritos (gancho, legenda, CTA, brief da imagem), já no calendário como rascunho.",
    href: "/clients",
    cta: "Gerar em um cliente",
  },
];

export default function DifferentiatorsStrip() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" data-testid="differentiators">
      {ITEMS.map((item) => (
        <Link
          key={item.anchor}
          href={item.href}
          data-tour={item.anchor}
          className="group flex flex-col gap-2 rounded-xl border border-edge bg-surface p-4 transition-colors hover:border-accent/60"
        >
          <span className="grid size-9 place-items-center rounded-lg bg-accent/10 text-accent">
            <Icon name={item.icon} size={18} />
          </span>
          <p className="font-[family-name:var(--font-display)] text-sm font-semibold leading-tight">{item.title}</p>
          <p className="flex-1 text-xs text-muted">{item.body}</p>
          <span className="text-xs font-medium text-accent group-hover:underline">{item.cta} →</span>
        </Link>
      ))}
    </div>
  );
}
