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
