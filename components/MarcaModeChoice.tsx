"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { Icon, type IconName } from "./icons";
import WelcomeLogin from "./WelcomeLogin";

type Mode = { self: boolean; icon: IconName; title: string; body: string; bullets: string[] };

const MODES: Mode[] = [
  {
    self: true,
    icon: "sparkle",
    title: "Faço eu mesmo",
    body: "Modo autônomo — você no controle, com a IA de copiloto.",
    bullets: [
      "A IA cria estratégia, campanhas, conteúdo e identidade da sua marca",
      "Publique e agende posts, gere materiais e acompanhe resultados",
      "Ideal para quem quer velocidade e independência",
    ],
  },
  {
    self: false,
    icon: "users",
    title: "Quero uma agência",
    body: "Uma agência cuida da sua marca — você acompanha e aprova.",
    bullets: [
      "A agência produz por você; você acompanha tudo pelo portal",
      "Aprove entregas, converse e peça novas produções",
      "Ideal para quem quer terceirizar a operação",
    ],
  },
];

// Seletor simples do modo da marca. A própria decisão reemite a sessão no
// backend, então o redirect já cai no lugar certo (workspace x portal).
export default function MarcaModeChoice({
  id,
  open,
  onClose,
}: {
  id: string;
  open: boolean;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState<boolean | null>(null);
  const [error, setError] = useState("");

  async function choose(self: boolean) {
    setBusy(self);
    setError("");
    try {
      const r = await api<{ home: string }>(`/api/clients/${id}/mode`, {
        method: "POST",
        body: JSON.stringify({ selfServe: self }),
      });
      window.location.href = r.home;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar");
      setBusy(null);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl animate-pop-in rounded-2xl border border-edge bg-surface p-6 shadow-2xl [transform-origin:center]">
        <div className="mb-1 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-widest text-text">
            Como você quer trabalhar?
          </p>
          <button onClick={onClose} aria-label="Fechar" className="text-muted transition-colors hover:text-foreground">
            <Icon name="x" size={18} />
          </button>
        </div>
        <WelcomeLogin />
        <p className="mb-5 text-sm text-muted">
          Você pode mudar de ideia depois — é só um clique.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          {MODES.map((m) => (
            <button
              key={String(m.self)}
              onClick={() => choose(m.self)}
              disabled={busy !== null}
              className="group flex flex-col rounded-xl border border-edge bg-surface-2 p-5 text-left transition-all hover:-translate-y-0.5 hover:border-edge disabled:opacity-60"
            >
              <span className="grid size-11 place-items-center rounded-xl bg-surface-sunken text-text transition-colors group-hover:bg-surface-sunken group-hover:text-text-ink">
                <Icon name={m.icon} size={22} />
              </span>
              <span className="mt-3 text-lg font-semibold">{m.title}</span>
              <span className="mt-1 text-sm text-muted">{m.body}</span>
              <ul className="mt-3 space-y-1.5 text-xs text-muted">
                {m.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-1.5">
                    <Icon name="check" size={13} className="mt-0.5 shrink-0 text-text" />
                    {b}
                  </li>
                ))}
              </ul>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-text">
                {busy === m.self ? "Configurando…" : "Escolher"} →
              </span>
            </button>
          ))}
        </div>
        {error && <p className="mt-3 text-sm text-negative">{error}</p>}
      </div>
    </div>
  );
}
