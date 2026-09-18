"use client";

import { TIER_COLORS, type TierInfo } from "@/lib/ranking";
import LevelUpCelebration from "./LevelUpCelebration";


export default function TierBadge({
  info,
  detailed = false,
  celebrate = false,
  celebrateKey,
}: {
  info: TierInfo;
  detailed?: boolean;
  // Liga a celebração de subida de elo. Requer também `celebrateKey`.
  celebrate?: boolean;
  // Chave única por entidade no localStorage (ex.: `levelup_client_<id>`).
  celebrateKey?: string;
}) {
  // O elo é um DADO, não um estado de sistema: o metal fica no ponto de 8px —
  // o único lugar onde uma cor fora da rampa é legítima — e o rótulo é tinta.
  // Antes a pílula inteira era do metal, e "Bronze" saía a 2,6:1 no claro.
  const color = TIER_COLORS[info.tier];
  return (
    <>
      {celebrate && celebrateKey && (
        <LevelUpCelebration tier={info.tier} storageKey={celebrateKey} />
      )}
      <span className="inline-flex flex-col gap-0.5">
        <span
          className="t5 inline-flex w-fit items-center gap-1.5 rounded-xs border border-rule px-2 py-0.5 font-medium"
          title={`${info.reason} · ${info.nextStep}`}
        >
          <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
          {info.tier}
        </span>
        {detailed && (
          <span className="t5 text-text-muted">
            {info.reason} · <span className="text-text">{info.nextStep}</span>
          </span>
        )}
      </span>
    </>
  );
}

// Barra de progresso rumo ao próximo elo + métricas que movem o ponteiro.
// É o mecanismo de retenção: sempre mostra o que falta para subir.
export function TierProgress({
  info,
  compact = false,
  celebrate = false,
  celebrateKey,
}: {
  info: TierInfo;
  compact?: boolean;
  // Liga a celebração de subida de elo. Requer também `celebrateKey`.
  celebrate?: boolean;
  // Chave única por entidade no localStorage (ex.: `levelup_agency`).
  celebrateKey?: string;
}) {
  return (
    <div>
      {celebrate && celebrateKey && (
        <LevelUpCelebration tier={info.tier} storageKey={celebrateKey} />
      )}
      <div className="t5 flex items-baseline justify-between text-text-muted">
        <span>Progresso para o próximo elo</span>
        <span className="tnum font-medium text-text">{info.progress}%</span>
      </div>
      <div className="mt-1 h-0.5 overflow-hidden bg-surface-sunken">
        <div
          className="h-full bg-text transition-[width] duration-[var(--dur-3)] ease-[var(--ease)]"
          style={{ width: `${Math.max(info.progress, 2)}%` }}
        />
      </div>
      <p className="t5 mt-1 text-text-muted">{info.nextStep}</p>
      {!compact && info.metrics?.length > 0 && (
        <dl className="mt-2">
          {info.metrics.map((metric) => (
            <div
              key={metric.label}
              className="flex items-baseline justify-between gap-3 border-b border-rule py-1"
            >
              <dt className="t5 text-text-muted">{metric.label}</dt>
              <dd className="t5 tnum font-medium">
                {metric.value}
                {metric.target != null && <span className="text-text-muted"> / {metric.target}</span>}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
