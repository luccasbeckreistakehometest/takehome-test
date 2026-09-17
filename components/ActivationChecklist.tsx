"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { ActivationRole, ActivationStep } from "@/lib/activation-rules";
import { ACTIVATION_EVENT } from "@/lib/activation-events";
import { Card, SectionTitle } from "./ui";
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
    <Card className="space-y-3" data-testid="activation-checklist" data-role={data.role} data-done={progress.done}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionTitle>{progress.complete ? "Primeiros passos concluídos" : "Primeiros passos"}</SectionTitle>
        <span className="text-xs font-medium text-muted" data-testid="activation-count">{`${progress.done} de ${progress.total}`}</span>
      </div>
      {intro && !progress.complete && <p className="-mt-1 text-sm text-muted">{intro}</p>}
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={progress.pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso dos primeiros passos">
        <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${progress.pct}%` }} />
      </div>
      <ol className="grid gap-2 sm:grid-cols-2">
        {data.steps.map((step) => (
          <li key={step.key} data-testid="activation-step" data-key={step.key} data-done={step.done ? "true" : "false"}>
            <Link
              href={step.href as never}
              onClick={(e) => follow(e, step.href)}
              className={`flex h-full gap-3 rounded-lg border p-3 transition-colors ${
                step.done ? "border-edge bg-surface-2/60" : "border-edge bg-surface-2 hover:border-accent/60"
              }`}
            >
              <span
                className={`grid size-6 shrink-0 place-items-center rounded-full border text-accent-ink ${
                  step.done ? "border-accent bg-accent" : "border-edge bg-surface"
                }`}
                aria-hidden="true"
              >
                {step.done && <Icon name="check" size={14} />}
              </span>
              <span>
                <span className={`block text-sm font-medium ${step.done ? "text-muted line-through" : ""}`}>{step.label}</span>
                <span className="block text-xs text-muted">{step.hint}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
      {progress.complete && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted">Tudo pronto — você já usou o essencial.</p>
          <button type="button" onClick={dismiss} className="text-sm font-medium text-accent hover:underline" data-testid="activation-dismiss">
            Fechar
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </Card>
  );
}
