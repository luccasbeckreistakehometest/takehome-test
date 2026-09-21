"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { Icon, type IconName } from "./icons";
import { Dialog } from "./ui";
import WelcomeLogin from "./WelcomeLogin";

type Mode = { self: boolean; icon: IconName; title: string; body: string; bullets: string[] };

const MODES: Mode[] = [
  {
    self: true,
    icon: "layers",
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

  // Diálogo do sistema (§11.3): foco preso, Esc fecha. Era um scrim de mão.
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Como você quer trabalhar?"
      eyebrow="Modo da marca"
      size={800}
      testId="marca-mode"
    >
      <WelcomeLogin />
      <p className="t3 measure-lede text-text-muted">
        Você pode mudar de ideia depois — é só um clique.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {MODES.map((m) => (
          <button
            key={String(m.self)}
            onClick={() => choose(m.self)}
            disabled={busy !== null}
            className="group flex flex-col rounded-md border border-edge bg-surface p-5 text-left transition-colors duration-[var(--dur-1)] hover:bg-surface-sunken disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-text-muted"
          >
            <span className="grid size-11 place-items-center rounded-sm bg-surface-sunken text-text">
              <Icon name={m.icon} size={22} />
            </span>
            <span className="t1 mt-3 font-medium">{m.title}</span>
            <span className="t3 mt-1 text-text-muted">{m.body}</span>
            <ul className="t5 mt-3 space-y-1.5 text-text-muted">
              {m.bullets.map((b) => (
                <li key={b} className="flex items-start gap-1.5">
                  <Icon name="check" size={14} className="mt-0.5 shrink-0 text-text-muted" />
                  {b}
                </li>
              ))}
            </ul>
            <span className="t3 mt-4 inline-flex items-center gap-1 font-medium text-text underline underline-offset-4 group-disabled:no-underline">
              {busy === m.self ? "Configurando…" : "Escolher"}
            </span>
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="t3 mt-3 text-negative">
          {error}
        </p>
      )}
    </Dialog>
  );
}
