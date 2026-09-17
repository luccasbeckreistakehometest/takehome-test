"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

// Tour guiado da agência no primeiro acesso: destaca a navegação real e leva
// até o cadastro de cliente para mostrar o briefing falado. Progresso e
// conclusão vivem no servidor (/api/onboarding) — não repete em outra máquina.
type Step = { anchor: string; path: string; t: string; b: string };
const STEPS: Step[] = [
  { anchor: "nav-home", path: "/", t: "Hoje", b: "Sua central: o que precisa de decisão agora — candidaturas, entregas para revisar, clientes sem resposta, posts na hora." },
  { anchor: "nav-clients", path: "/", t: "Clientes", b: "Cada cliente tem briefing, kit de IA (estratégia, campanhas, identidade, social), demandas e portal próprio." },
  { anchor: "briefing-mode", path: "/clients/new", t: "Briefing falado", b: "Aqui você pode falar em vez de digitar: a IA escuta, pergunta o que faltar e preenche o cadastro para você revisar." },
  { anchor: "nav-production", path: "/clients/new", t: "Produção", b: "Demandas em kanban: da abertura ao pagamento, com freelancers ou equipe interna." },
  { anchor: "nav-insights", path: "/clients/new", t: "Insights", b: "Receita, campanhas, elo da agência e o que a IA recomenda fazer a seguir." },
  // Diferenciais: cada um tem um card na Hoje que leva até onde a feature vive
  { anchor: "diff-report", path: "/", t: "Relatório mensal em 1 clique", b: "Dentro de cada cliente, o botão Relatório mensal junta entregas, aprovações, posts, métricas e vendas do mês e a IA escreve o resumo — com link para o portal e para imprimir." },
  { anchor: "diff-approval", path: "/", t: "Aprovação que dispara ação", b: "Quando o cliente aprova uma peça no portal, ela vira rascunho no calendário e você recebe o aviso no WhatsApp. As regras ficam em Configurações." },
  { anchor: "diff-attendant", path: "/", t: "Atendente de WhatsApp com IA", b: "Na aba Atendente de cada cliente: rascunho ou automático, horário comercial, limite por contato e passagem para humano. Nunca inventa preço." },
  { anchor: "diff-proposal", path: "/", t: "Proposta pública em 5 minutos", b: "Em Prospecção, cada prospect ganha uma página com pitch, pacotes e prazo. Ele aceita sem login e já vira cliente com acesso ao portal." },
  { anchor: "nav-calendar", path: "/", t: "Calendário de conteúdo", b: "Semana ou mês por cliente, status com um clique e aviso dos dias sem conteúdo." },
  { anchor: "diff-public-page", path: "/", t: "Página pública da agência", b: "Em Configurações → Página pública você liga /a/sua-agencia: serviços, trabalhos que o cliente autorizou, clientes e depoimentos. O formulário vira prospect e avisa você no sino e no WhatsApp." },
  { anchor: "diff-pulse", path: "/", t: "Pulso do cliente e NPS", b: "No portal, o cliente responde 😞😐😀 depois de cada aprovação e uma vez por mês, e o NPS a cada trimestre. A Hoje mostra quem está em risco (nota caindo, 😞, silêncio) e o relatório mensal traz os números." },
  { anchor: "diff-margin", path: "/", t: "Horas e margem por cliente", b: "Na aba Horas de cada cliente você aponta tempo (cronômetro ou à mão) por demanda. Em Horas & margem, cada cliente aparece com fee, horas, custo e margem do mês — quem dá prejuízo fica em vermelho, com CSV para a contabilidade." },
  { anchor: "diff-brand-voice", path: "/", t: "Guardião da voz da marca", b: "No calendário e no atendente, o botão Checar voz da marca compara o texto com o briefing e as regras do cliente (termos proibidos, CTA, hashtags, emojis, alegações sem fonte) e dá uma nota de tom. Reescrever no tom corrige em 1 clique. As regras ficam na aba Briefing." },
  { anchor: "diff-campaign", path: "/", t: "Campanha de 30 dias", b: "Na aba 30 dias de cada cliente: objetivo, canais e data de início. A IA planeja as semanas e escreve cada post; tudo entra no calendário como rascunho nos dias livres, e você aceita ou pula um a um." },
  { anchor: "diff-learnings", path: "/", t: "O que funciona pra este cliente", b: "No Dashboard de cada cliente, os posts publicados são cruzados com as vendas e métricas dos dias seguintes: melhor formato, dia e horário e o que menos rende, com uma leitura de 3 linhas da IA. Com poucos dados, a tela diz o que falta. Os números também entram no relatório mensal." },
];
type Rect = { top: number; left: number; width: number; height: number };

export default function Tour({ role }: { role?: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [state, setState] = useState<"idle" | "running" | "done">("idle");
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  const save = useCallback((s: number, completed = false, event?: string) => {
    fetch("/api/onboarding", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ step: s, completed, event }) }).catch(() => {});
  }, []);

  useEffect(() => {
    if (role !== "agency") return;
    const onStart = () => { setStep(0); setState("running"); save(0, false, "tour_start"); };
    window.addEventListener("ah:tour-start", onStart);
    // retoma um tour deixado no meio
    fetch("/api/onboarding", { cache: "no-store" }).then((r) => r.json()).then((j) => {
      if (j.tourCompleted) return setState("done");
      if (j.tourStep > 0 && j.tourStep < STEPS.length) { setStep(j.tourStep); setState("running"); }
    }).catch(() => {});
    return () => window.removeEventListener("ah:tour-start", onStart);
  }, [role, save]);

  const measure = useCallback(() => {
    const el = document.querySelector<HTMLElement>(`[data-tour="${STEPS[step].anchor}"]`);
    if (!el) return setRect(null);
    let r = el.getBoundingClientRect();
    // âncoras abaixo da dobra (cards dos diferenciais) entram na tela antes de medir
    if (r.top < 0 || r.bottom > window.innerHeight) {
      el.scrollIntoView({ block: "center" });
      r = el.getBoundingClientRect();
    }
    setRect({ top: r.top - 8, left: r.left - 8, width: r.width + 16, height: r.height + 16 });
  }, [step]);

  useLayoutEffect(() => {
    if (state !== "running") return;
    const wanted = STEPS[step].path;
    if (pathname !== wanted) { router.push(wanted as never); return; }
    const id = window.setTimeout(measure, 150);
    window.addEventListener("resize", measure); window.addEventListener("scroll", measure, true);
    return () => { window.clearTimeout(id); window.removeEventListener("resize", measure); window.removeEventListener("scroll", measure, true); };
  }, [state, step, pathname, measure, router]);

  if (state !== "running") return null;
  const s = STEPS[step];
  const last = step === STEPS.length - 1;
  const cardStyle = rect
    ? { top: Math.min(window.innerHeight - 220, rect.top + rect.height + 12), left: Math.max(12, Math.min(rect.left, window.innerWidth - 372)) }
    : { bottom: 20, left: 20 };
  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-[90]">
        <div className="absolute rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,.6)] transition-all duration-200" style={rect ? rect : { top: -9999, left: -9999, width: 0, height: 0 }} />
      </div>
      <div className="fixed z-[91] w-[min(92vw,360px)] rounded-2xl border border-edge bg-surface p-5 shadow-2xl" style={cardStyle} data-testid="tour-step" data-step={step}>
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">{step + 1} / {STEPS.length}</p>
        <h3 className="mt-1 text-lg font-semibold">{s.t}</h3>
        <p className="mt-1 text-sm text-muted">{s.b}</p>
        <div className="mt-4 flex items-center justify-between">
          <button onClick={() => { setState("done"); save(step, true, "tour_skip"); }} className="text-sm text-muted hover:text-foreground">Pular</button>
          <div className="flex gap-2">
            {step > 0 && <button onClick={() => { setStep(step - 1); save(step - 1); }} className="rounded-md border border-edge px-3 py-1.5 text-sm">Voltar</button>}
            <button data-testid="tour-next" onClick={() => { if (last) { setState("done"); save(step, true, "tour_done"); } else { setStep(step + 1); save(step + 1); } }} className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-accent-ink">{last ? "Entendi" : "Próximo"}</button>
          </div>
        </div>
      </div>
    </>
  );
}
