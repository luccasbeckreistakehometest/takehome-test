"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { ActivationRole, ActivationStep } from "@/lib/activation-rules";
import { ACTIVATION_EVENT } from "@/lib/activation-events";

import { Icon } from "./icons";

type Payload = {
  role: ActivationRole | null;
  steps: ActivationStep[];
  progress: { done: number; total: number; pct: number; complete: boolean } | null;
  dismissed: boolean;
};

// "Primeiros passos" do papel de quem está logado. Só aparece na tela do
// próprio papel (a agência vendo o portal de um cliente não vê o card dele)
// e marca sozinho quando a ação acontece (evento ah:activation).
export default function ActivationChecklist({ expect, intro }: { expect: ActivationRole; intro?: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");
  const timer = useRef<number | undefined>(undefined);

  const load = useCallback(() => {
    fetch("/api/onboarding/activation", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((payload: Payload | null) => {
        if (payload) setData(payload);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const refresh = () => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(load, 300);
    };
    window.addEventListener(ACTIVATION_EVENT, refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearTimeout(timer.current);
      window.removeEventListener(ACTIVATION_EVENT, refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [load]);

  async function dismiss() {
    setError("");
    const r = await fetch("/api/onboarding/activation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dismiss: true }) });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) return setError(body.error ?? "Não deu para fechar agora.");
    setData(body as Payload);
  }

  // mesma página: abre a aba ou rola até a seção sem recarregar
  function follow(event: React.MouseEvent<HTMLAnchorElement>, href: string) {
    const url = new URL(href, window.location.origin);
    if (url.pathname !== window.location.pathname) return;
    const tab = url.searchParams.get("tab");
    if (tab) {
      event.preventDefault();
      window.dispatchEvent(new CustomEvent("ah:workspace-tab", { detail: tab }));
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (url.hash) {
      const target = document.getElementById(url.hash.slice(1));
      if (target) {
        event.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }

  if (!data || data.role !== expect || data.dismissed || !data.progress) return null;
  const { progress } = data;

  return (
    // Lista de ativação: régua entre passos, marcador de estado em vez de
    // cartão dentro de cartão, e a barra de progresso como fio de 2px — não
    // como faixa laranja no meio da tela (§5.5: a marca já é o botão da capa).
    <section
      className="border-y border-edge py-4"
      data-testid="activation-checklist"
      data-role={data.role}
      data-done={progress.done}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="t6 text-text-muted">
          {progress.complete ? "Primeiros passos concluídos" : "Primeiros passos"}
        </p>
        <span className="t5 tnum text-text-muted" data-testid="activation-count">{`${progress.done} de ${progress.total}`}</span>
      </div>
      {intro && !progress.complete && <p className="t3 mt-1 text-text-muted">{intro}</p>}
      <div
        className="mt-3 h-0.5 bg-surface-sunken"
        role="progressbar"
        aria-valuenow={progress.pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progresso dos primeiros passos"
      >
        <div
          className="h-full bg-text transition-[width] duration-[var(--dur-3)] ease-[var(--ease)]"
          style={{ width: `${progress.pct}%` }}
        />
      </div>
      <ol className="mt-1 grid sm:grid-cols-2 sm:gap-x-8">
        {data.steps.map((step) => (
          <li
            key={step.key}
            data-testid="activation-step"
            data-key={step.key}
            data-done={step.done ? "true" : "false"}
            className="border-b border-rule"
          >
            <Link
              href={step.href as never}
              onClick={(e) => follow(e, step.href)}
              className="flex items-baseline gap-3 py-2.5"
            >
              <span
                className={`mt-1 grid size-4 shrink-0 place-items-center rounded-full border ${
                  step.done ? "border-text bg-text text-canvas" : "border-edge"
                }`}
                aria-hidden="true"
              >
                {step.done && <Icon name="check" size={16} className="size-3" />}
              </span>
              <span className="min-w-0">
                <span className={`t3 block font-medium ${step.done ? "text-text-faint line-through" : ""}`}>
                  {step.label}
                </span>
                <span className="t5 block text-text-muted">{step.hint}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
        <p className="t5 text-text-muted">
          {progress.complete
            ? "Tudo pronto — você já usou o essencial."
            : "Pode fechar quando quiser; os passos continuam marcando sozinhos."}
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="t5 font-medium underline-offset-4 hover:underline"
          data-testid="activation-dismiss"
        >
          {progress.complete ? "Fechar" : "Ocultar"}
        </button>
      </div>
      {error && <p className="t5 mt-2 text-negative">{error}</p>}
    </section>
  );
}
