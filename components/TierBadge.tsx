"use client";

import { TIER_COLORS, type TierInfo } from "@/lib/ranking";


export default function TierBadge({
  info,
  detailed = false,
}: {
  info: TierInfo;
  detailed?: boolean;
}) {
  const color = TIER_COLORS[info.tier];
  return (
    <span className="inline-flex flex-col gap-0.5">
      <span
        className="inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold"
        style={{ borderColor: color, color }}
        title={`${info.reason} · ${info.nextStep}`}
      >
        <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
        {info.tier}
      </span>
      {detailed && (
        <span className="text-xs text-muted">
          {info.reason} · <span className="text-foreground/70">{info.nextStep}</span>
        </span>
      )}
    </span>
  );
}

// Barra de progresso rumo ao próximo elo + métricas que movem o ponteiro.
// É o mecanismo de retenção: sempre mostra o que falta para subir.
export function TierProgress({
  info,
  compact = false,
}: {
  info: TierInfo;
  compact?: boolean;
}) {
  const color = TIER_COLORS[info.tier];
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-muted">
        <span>Progresso para o próximo elo</span>
        <span className="font-semibold text-foreground">{info.progress}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.max(info.progress, 2)}%`, backgroundColor: color }}
        />
      </div>
      <p className="text-xs text-muted">{info.nextStep}</p>
      {!compact && info.metrics?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {info.metrics.map((metric) => (
            <span
              key={metric.label}
              className="rounded-md border border-edge bg-surface-2 px-2 py-1 text-[11px] text-muted"
            >
              {metric.label}:{" "}
              <span className="font-semibold text-foreground">{metric.value}</span>
              {metric.target != null && <span> / {metric.target}</span>}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
