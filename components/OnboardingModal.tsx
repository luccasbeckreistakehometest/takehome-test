"use client";

import { useEffect, useState } from "react";
import { Icon, type IconName } from "./icons";

type Role = "agency" | "client" | "professional";

type Step = { icon: IconName; title: string; body: string; href?: string; cta?: string };

const FLOWS: Record<Role, { title: string; steps: Step[] }> = {
  agency: {
    title: "Bem-vindo à sua central",
    steps: [
      { icon: "palette", title: "Personalize sua marca", body: "Suba seu logo e cor em Configurações — seus clientes e profissionais convidados veem a plataforma com a sua identidade.", href: "/settings", cta: "Ir para Configurações" },
      { icon: "briefcase", title: "Adicione um cliente", body: "Cadastre uma conta e gere o kit completo (estratégia, campanhas, identidade, social) com IA.", href: "/clients/new", cta: "Novo cliente" },
      { icon: "users", title: "Convide profissionais", body: "Traga fotógrafos e designers com um link de convite — freelancers ou funcionários full-time.", href: "/settings", cta: "Gerar convite" },
      { icon: "chart", title: "Acompanhe tudo", body: "A página Insights mostra demandas, campanhas, receita e o elo da sua operação em um lugar só.", href: "/insights", cta: "Ver Insights" },
    ],
  },
  client: {
    title: "Vamos configurar sua marca",
    steps: [
      { icon: "clipboard", title: "Complete o briefing", body: "Conte sobre o seu negócio: é isso que alimenta toda a IA — estratégia, campanhas e materiais sob medida." },
      { icon: "sparkle", title: "Gere seu primeiro kit", body: "Com um clique a IA cria estratégia, plano de campanha, ROI, identidade e calendário social." },
      { icon: "message", title: "Fale com a agência", body: "Aprove entregas, peça produções e acompanhe reuniões pelo seu portal." },
    ],
  },
  professional: {
    title: "Seu perfil, suas oportunidades",
    steps: [
      { icon: "user", title: "Complete seu perfil", body: "Skills, foco de mercado e portfólio — quanto mais completo, melhor o match da IA com as demandas certas." },
      { icon: "target", title: "Veja oportunidades", body: "Demandas abertas aparecem no seu painel. Candidate-se com uma mensagem que convença a agência." },
      { icon: "money", title: "Suba de elo", body: "Entregas bem avaliadas pela IA elevam seu elo (Bronze → Platina) e sua visibilidade." },
    ],
  },
};

// Modal de onboarding por papel: aparece no primeiro acesso (?welcome=1 ou
// sem flag salva). Guiado, com CTAs. Fecha e marca como visto.
export default function OnboardingModal({
  role,
  welcomeOnly = false,
}: {
  role: Role;
  welcomeOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const key = `onboarded_${role}`;
    const welcome = new URLSearchParams(window.location.search).get("welcome");
    // welcomeOnly: só abre logo após o cadastro (evita disparar para quem só
    // está visitando o painel, ex.: agência vendo um profissional).
    // O servidor manda: quem já concluiu em outra máquina não vê de novo.
    let cancelled = false;
    fetch("/api/onboarding", { cache: "no-store" }).then((r) => r.json()).then((j) => {
      if (cancelled || j.tourCompleted) return;
      if (welcome === "1" || (!welcomeOnly && !localStorage.getItem(key))) {
        setOpen(true);
        fetch("/api/onboarding", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event: "welcome_open", meta: { role } }) }).catch(() => {});
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [role, welcomeOnly]);

  function close(reason: "skip" | "done" = "skip") {
    try {
      localStorage.setItem(`onboarded_${role}`, new Date().toISOString());
    } catch {
      /* ignore */
    }
    setOpen(false);
    // Agência: o modal apresenta, o tour mostra na tela. Demais papéis: o modal
    // já é o tour, então fica concluído aqui.
    if (role === "agency" && reason === "done") {
      fetch("/api/onboarding", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event: "welcome_done" }) }).catch(() => {});
      window.dispatchEvent(new Event("ah:tour-start"));
    } else {
      fetch("/api/onboarding", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ completed: true, event: reason === "done" ? "welcome_done" : "welcome_skip" }) }).catch(() => {});
    }
  }

  if (!open) return null;
  const flow = FLOWS[role];
  const current = flow.steps[step];
  const isLast = step === flow.steps.length - 1;

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/50 p-4 backdrop-blur-sm" data-testid="welcome">
      <div className="w-full max-w-lg animate-pop-in rounded-2xl border border-edge bg-surface p-6 shadow-2xl [transform-origin:center]">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">{flow.title}</p>
          <button onClick={() => close("skip")} className="text-muted transition-colors hover:text-foreground">
            <Icon name="x" size={18} />
          </button>
        </div>

        <div className="flex gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
            <Icon name={current.icon} size={24} />
          </span>
          <div>
            <h3 className="text-lg font-semibold">{current.title}</h3>
            <p className="mt-1 text-sm text-muted">{current.body}</p>
            {current.href && (
              <a
                href={current.href}
                className="mt-3 inline-block text-sm font-medium text-accent hover:underline"
              >
                {current.cta} →
              </a>
            )}
          </div>
        </div>

        {/* Progresso + navegação */}
        <div className="mt-6 flex items-center justify-between">
          <div className="flex gap-1.5">
            {flow.steps.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? "w-6 bg-accent" : "w-1.5 bg-edge"
                }`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => close("skip")} className="rounded-md px-3 py-1.5 text-sm text-muted hover:text-foreground" data-testid="welcome-skip">
              Pular
            </button>
            <button
              data-testid="welcome-next"
              onClick={() => (isLast ? close("done") : setStep((s) => s + 1))}
              className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90"
            >
              {isLast ? "Começar" : "Próximo"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
