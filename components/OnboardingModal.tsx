"use client";

import { useEffect, useState } from "react";
import { Icon, type IconName } from "./icons";
import { Button, Dialog } from "./ui";
import WelcomeLogin from "./WelcomeLogin";

type Role = "agency" | "client" | "managed" | "professional";

// Qual tour (lib/tour-steps) cada modal apresenta: o modal só abre para quem
// é daquele tipo — a agência olhando o workspace de um cliente não vê o da marca.
const KIND: Record<Role, string> = { agency: "agency", client: "brand", managed: "managed", professional: "professional" };

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
      { icon: "layers", title: "Gere seu primeiro kit", body: "Com um clique a IA cria estratégia, plano de campanha, ROI, identidade e calendário social." },
      { icon: "message", title: "Fale com a agência", body: "Aprove entregas, peça produções e acompanhe reuniões pelo seu portal." },
    ],
  },
  managed: {
    title: "Bem-vindo ao seu portal",
    steps: [
      { icon: "check", title: "Aprove sem complicação", body: "A agência manda as peças por aqui ou por um link no WhatsApp. Você olha, aprova ou pede ajuste." },
      { icon: "clipboard", title: "Seu pacote do mês", body: "Veja o que já foi produzido e peça novas produções. Extra só entra com valor aprovado por você." },
      { icon: "message", title: "Fale com a agência", body: "Mensagens, faturas com Pix e o relatório do mês ficam no mesmo lugar." },
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
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    const key = `onboarded_${role}`;
    const welcome = new URLSearchParams(window.location.search).get("welcome");
    // welcomeOnly: só abre logo após o cadastro (evita disparar para quem só
    // está visitando o painel, ex.: agência vendo um profissional).
    // O servidor manda: quem já concluiu em outra máquina não vê de novo.
    let cancelled = false;
    // logo após o cadastro, o seletor de modo da marca vem primeiro
    if (new URLSearchParams(window.location.search).get("choose") === "1") return;
    fetch("/api/onboarding", { cache: "no-store" }).then((r) => r.json()).then((j) => {
      if (cancelled || j.tourCompleted || j.kind !== KIND[role]) return;
      if (welcome === "1" || (!welcomeOnly && !localStorage.getItem(key))) {
        setOpen(true);
        setShowLogin(welcome === "1");
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
    // O modal apresenta, o tour mostra na tela (todos os papéis). Pular o
    // modal pula o tour também.
    if (reason === "done") {
      fetch("/api/onboarding", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event: "welcome_done" }) }).catch(() => {});
      window.dispatchEvent(new Event("ah:tour-start"));
    } else {
      fetch("/api/onboarding", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ completed: true, event: "welcome_skip" }) }).catch(() => {});
    }
  }

  const flow = FLOWS[role];
  if (!open) return null;
  const current = flow.steps[step];
  const isLast = step === flow.steps.length - 1;

  // Diálogo do sistema (§11.3): foco preso, Esc fecha, rótulo de papel.
  // Era um scrim de mão, sem role, sem aria-modal e sem saída pelo teclado —
  // e é a primeira tela que uma agência nova vê.
  return (
    <Dialog
      open={open}
      onClose={() => close("skip")}
      title={flow.title}
      eyebrow="Primeiros passos"
      size={640}
      testId="welcome"
      footer={
        <div className="flex w-full items-center justify-between gap-4">
          <div className="flex gap-1.5" aria-hidden="true">
            {flow.steps.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all duration-[var(--dur-1)] ${
                  i === step ? "w-6 bg-text" : "w-1.5 bg-edge"
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="quiet" onClick={() => close("skip")} data-testid="welcome-skip">
              Pular
            </Button>
            <Button data-testid="welcome-next" onClick={() => (isLast ? close("done") : setStep((s) => s + 1))}>
              {isLast ? "Começar" : "Próximo"}
            </Button>
          </div>
        </div>
      }
    >
      {showLogin && <WelcomeLogin />}
      <p className="t5 text-text-muted">
        Passo {step + 1} de {flow.steps.length}
      </p>
      <div className="mt-3 flex gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-sm bg-surface-sunken text-text">
          <Icon name={current.icon} size={24} />
        </span>
        <div className="min-w-0">
          <h3 className="t1 font-medium">{current.title}</h3>
          <p className="t3 measure-lede mt-2 text-text-muted">{current.body}</p>
          {current.href && (
            <a href={current.href} className="t3 mt-3 inline-block font-medium text-brand-text underline underline-offset-4">
              {current.cta}
            </a>
          )}
        </div>
      </div>
    </Dialog>
  );
}
