"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { TIER_COLORS, type Tier } from "@/lib/ranking";

// Ordem dos elos (baixo → alto). Só celebramos quando o rank atual é MAIOR
// que o último gravado — nunca em queda de elo, nunca no primeiro load.
const TIER_RANK: Record<Tier, number> = {
  Bronze: 0,
  Prata: 1,
  Ouro: 2,
  Platina: 3,
};

// Fecha sozinho depois de alguns segundos (além do botão de fechar).
const AUTO_DISMISS_MS = 6000;
const CONFETTI_COUNT = 44;

// Grava o elo atual sem quebrar em modo privado / storage indisponível.
function persist(key: string, tier: Tier) {
  try {
    window.localStorage.setItem(key, tier);
  } catch {
    /* localStorage indisponível — ignoramos silenciosamente */
  }
}

type ConfettiPiece = {
  left: number; // posição horizontal inicial (%)
  dx: number; // deriva horizontal (px)
  dy: number; // queda vertical (px)
  rot: number; // rotação total (deg)
  delay: number; // atraso (s)
  duration: number; // duração (s)
  size: number; // largura (px)
  color: string;
};

/**
 * Celebração de subida de elo (level-up).
 *
 * Compara o `tier` atual com o último valor salvo em `storageKey` no
 * localStorage. Se o elo atual for MAIOR (subiu), dispara um overlay animado
 * com confete CSS e a cor do novo elo. Ao fechar (ou após alguns segundos),
 * grava o novo elo para não repetir.
 *
 * Na PRIMEIRA vez que vê um elo (sem valor salvo) NÃO celebra — apenas grava,
 * evitando disparar no primeiro load de todo mundo.
 */
export default function LevelUpCelebration({
  tier,
  storageKey,
}: {
  tier: Tier;
  storageKey: string;
}) {
  const [visible, setVisible] = useState(false);
  const color = TIER_COLORS[tier];

  const dismiss = useCallback(() => {
    persist(storageKey, tier);
    setVisible(false);
  }, [storageKey, tier]);

  // Decide se celebra, comparando com o último elo gravado.
  useEffect(() => {
    if (typeof window === "undefined") return;

    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(storageKey);
    } catch {
      return; // storage indisponível: não celebra e não grava
    }

    // Primeira vez que vemos um elo: grava e não celebra.
    if (saved == null) {
      persist(storageKey, tier);
      return;
    }

    const savedRank = TIER_RANK[saved as Tier];
    // Valor salvo desconhecido/corrompido: ressincroniza sem celebrar.
    if (savedRank == null) {
      persist(storageKey, tier);
      return;
    }

    const currentRank = TIER_RANK[tier];
    if (currentRank > savedRank) {
      setVisible(true); // subiu de elo → celebra
    } else if (currentRank < savedRank) {
      persist(storageKey, tier); // caiu de elo (raro): só sincroniza
    }
    // igual: nada a fazer
  }, [tier, storageKey]);

  // Fecha sozinho depois de um tempo.
  useEffect(() => {
    if (!visible) return;
    const timer = window.setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [visible, dismiss]);

  // Partículas de confete: posição/cor/rotação randômicas, geradas no cliente
  // (o componente só monta o overlay após o efeito, então não há mismatch SSR).
  const pieces = useMemo<ConfettiPiece[]>(() => {
    const palette = [color, "#ffffff", "#c6f24e", ...Object.values(TIER_COLORS)];
    return Array.from({ length: CONFETTI_COUNT }, () => ({
      left: Math.random() * 100,
      dx: (Math.random() - 0.5) * 220,
      dy: 260 + Math.random() * 220,
      rot: (Math.random() - 0.5) * 720,
      delay: Math.random() * 0.5,
      duration: 1.6 + Math.random() * 1.4,
      size: 6 + Math.random() * 6,
      color: palette[Math.floor(Math.random() * palette.length)],
    }));
  }, [color]);

  if (!visible) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[80] flex items-start justify-center pt-24"
      role="status"
      aria-live="polite"
    >
      {/* Camada de confete (decorativa) */}
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        {pieces.map((p, i) => (
          <span
            key={i}
            className="levelup-confetti"
            style={
              {
                left: `${p.left}%`,
                width: `${p.size}px`,
                height: `${p.size * 0.42}px`,
                backgroundColor: p.color,
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.duration}s`,
                "--dx": `${p.dx}px`,
                "--dy": `${p.dy}px`,
                "--rot": `${p.rot}deg`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      {/* Toast da conquista */}
      <div
        className="animate-levelup pointer-events-auto relative flex max-w-sm items-center gap-3 rounded-2xl border bg-surface px-5 py-4"
        style={{ borderColor: color, boxShadow: `0 12px 44px ${color}44` }}
      >
        <span
          className="flex size-11 shrink-0 items-center justify-center rounded-full d4 font-bold"
          style={{ backgroundColor: `${color}22`, color, border: `2px solid ${color}` }}
          aria-hidden="true"
        ></span>
        <div className="min-w-0">
          <p className="t3 font-semibold text-text">
            Você subiu para <span style={{ color }}>{tier}</span>! </p>
          <p className="t5 text-text-muted">
            Continue assim para alcançar o próximo elo.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Fechar celebração"
          className="ml-1 shrink-0 rounded-md p-1 text-text-muted transition-colors hover:bg-surface-sunken hover:text-text"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
