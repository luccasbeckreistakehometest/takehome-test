"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  STEPS_BY_ROLE,
  canShowMore,
  cardPlacement,
  isLastStep,
  stepPath,
  visibleTotal,
  type CardPlacement,
  type TourKind,
} from "@/lib/tour-steps";

// Tour guiado por papel (agência, marca autônoma, cliente gerenciado,
// profissional): destaca a tela real e navega sozinho entre as páginas.
// Progresso e conclusão vivem no servidor (/api/onboarding). No celular, ou
// quando a âncora não está visível, o card vira uma folha inferior.
type Rect = { top: number; left: number; width: number; height: number };
const NO_STEPS: never[] = [];

// páginas públicas nunca são sequestradas por um tour pela metade
const NO_RESUME = /^\/(aprovar|fatura|l|b|a|proposta|login|criar-conta|cadastro|convite|pedir-acesso)(\/|$)/;

function visibleAnchor(anchors: string[]): { el: HTMLElement; anchor: string } | null {
  for (const anchor of anchors) {
    for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${anchor}"]`)) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return { el, anchor };
    }
  }
  return null;
}

export default function Tour({ kind, refId }: { kind: TourKind | null; refId?: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [state, setState] = useState<"idle" | "running" | "done">("idle");
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [anchor, setAnchor] = useState("");
  const [placement, setPlacement] = useState<CardPlacement>({ mode: "sheet" });
  const cardRef = useRef<HTMLDivElement>(null);
  const scrolledFor = useRef(-1);
  const steps = kind ? STEPS_BY_ROLE[kind] : NO_STEPS;

  const save = useCallback((s: number, completed = false, event?: string) => {
    fetch("/api/onboarding", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ step: s, completed, event }) }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!kind) return;
    const onStart = () => {
      scrolledFor.current = -1;
      setStep(0);
      setState("running");
      save(0, false, "tour_start");
    };
    window.addEventListener("ah:tour-start", onStart);
    // retoma um tour deixado no meio
    if (!NO_RESUME.test(window.location.pathname)) {
      fetch("/api/onboarding", { cache: "no-store" })
        .then((r) => r.json())
        .then((j) => {
          if (j.tourCompleted) return setState((s) => (s === "running" ? s : "done"));
          if (j.tourStep > 0 && j.tourStep < STEPS_BY_ROLE[kind].length) {
            setStep(j.tourStep);
            setState("running");
          }
        })
        .catch(() => {});
    }
    return () => window.removeEventListener("ah:tour-start", onStart);
  }, [kind, save]);

  const measure = useCallback(() => {
    const current = steps[step];
    if (!current) return;
    const found = visibleAnchor(current.anchors);
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const card = cardRef.current ? { width: cardRef.current.offsetWidth || 360, height: cardRef.current.offsetHeight || 240 } : undefined;
    if (!found) {
      setRect(null);
      setAnchor("");
      setPlacement({ mode: "sheet" });
      return;
    }
    let r = found.el.getBoundingClientRect();
    const narrow = viewport.width < 640;
    // rola até a âncora uma vez por passo (no celular, acima da folha)
    if (scrolledFor.current !== step) {
      scrolledFor.current = step;
      const hidden = narrow ? r.top < 64 || r.bottom > viewport.height * 0.5 : r.top < 64 || r.bottom > viewport.height;
      if (hidden) {
        found.el.scrollIntoView({ block: narrow ? "start" : "center", inline: "nearest" });
        if (narrow) window.scrollBy(0, -72);
        r = found.el.getBoundingClientRect();
      }
    }
    const next = { top: r.top - 8, left: r.left - 8, width: r.width + 16, height: r.height + 16 };
    setRect(next);
    setAnchor(found.anchor);
    setPlacement(cardPlacement(next, viewport, card));
  }, [step, steps]);

  useLayoutEffect(() => {
    if (state !== "running" || !kind) return;
    const current = steps[step];
    if (!current) return;
    const wanted = stepPath(current, refId);
    if (pathname !== wanted) {
      router.push(wanted as never);
      return;
    }
    if (current.tab) window.dispatchEvent(new CustomEvent("ah:workspace-tab", { detail: current.tab }));
    if (current.anchors.some((a) => a.startsWith("diff-"))) window.dispatchEvent(new Event("ah:strip-expand"));
    const first = window.setTimeout(measure, 150);
    // telas que carregam dados: mede de novo quando a âncora aparece
    const second = window.setTimeout(measure, 900);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.clearTimeout(first);
      window.clearTimeout(second);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [state, step, pathname, measure, router, kind, refId, steps]);

  if (state !== "running" || !kind || !steps[step]) return null;
  const s = steps[step];
  const last = isLastStep(kind, step);
  const more = canShowMore(kind, step);
  const total = visibleTotal(kind, step);
  const go = (next: number) => {
    // a âncora do passo novo só aparece depois de medida (data-anchor vazio até lá)
    setAnchor("");
    setStep(next);
    save(next);
  };
  const finish = (event: "tour_done" | "tour_skip") => {
    setState("done");
    save(step, true, event);
  };

  const sheet = placement.mode === "sheet";
  const cardStyle =
    placement.mode === "below"
      ? { top: placement.top, left: placement.left }
      : placement.mode === "above"
        ? { bottom: placement.bottom, left: placement.left }
        : undefined;

  return (
    <>
      <div className={`pointer-events-none fixed inset-0 z-[90] ${rect ? "" : "bg-black/40"}`}>
        {rect && <div className="absolute rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,.6)] transition-all duration-200" style={rect} />}
      </div>
      <div
        ref={cardRef}
        role="dialog"
        aria-label={s.t}
        className={
          sheet
            ? "fixed inset-x-0 bottom-0 z-[91] max-h-[60dvh] overflow-y-auto rounded-t-2xl border border-edge bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl"
            : "fixed z-[91] w-[min(92vw,360px)] rounded-2xl border border-edge bg-surface p-5 shadow-2xl"
        }
        style={cardStyle}
        data-testid="tour-step"
        data-step={step}
        data-kind={kind}
        data-anchor={anchor}
        data-mode={placement.mode}
      >
        <p className="text-xs font-semibold uppercase tracking-widest text-text">{`${step + 1} / ${total}`}</p>
        <h3 className="mt-1 text-lg font-semibold">{s.t}</h3>
        <p className="mt-1 text-sm text-muted">{s.b}</p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <button onClick={() => finish("tour_skip")} className="text-sm text-muted hover:text-foreground" data-testid="tour-skip">
            Pular
          </button>
          <div className="flex flex-wrap justify-end gap-2">
            {step > 0 && (
              <button onClick={() => go(step - 1)} className="rounded-md border border-edge px-3 py-1.5 text-sm">
                Voltar
              </button>
            )}
            {more && (
              <button onClick={() => go(step + 1)} className="rounded-md border border-edge px-3 py-1.5 text-sm text-text" data-testid="tour-more">
                Ver todos os diferenciais
              </button>
            )}
            <button
              data-testid="tour-next"
              onClick={() => (last ? finish("tour_done") : go(step + 1))}
              className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-accent-ink"
            >
              {last ? "Entendi" : "Próximo"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
