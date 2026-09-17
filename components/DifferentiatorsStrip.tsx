"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "./icons";
import { STRIP_ITEMS } from "@/lib/differentiators";

const COLLAPSED = 8;

export default function DifferentiatorsStrip() {
  const [expanded, setExpanded] = useState(false);
  // o tour guiado abre a lista inteira quando chega aos diferenciais
  useEffect(() => {
    const open = () => setExpanded(true);
    window.addEventListener("ah:strip-expand", open);
    return () => window.removeEventListener("ah:strip-expand", open);
  }, []);
  const items = expanded ? STRIP_ITEMS : STRIP_ITEMS.slice(0, COLLAPSED);
  return (
    <div className="space-y-2">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" data-testid="differentiators">
        {items.map((item) => (
          <Link
            key={item.anchor}
            href={item.href as never}
            data-tour={item.anchor}
            data-testid="differentiator"
            className="group flex flex-col gap-2 rounded-xl border border-edge bg-surface p-4 transition-colors hover:border-accent/60"
          >
            <span className="flex items-center justify-between gap-2">
              <span className="grid size-9 place-items-center rounded-lg bg-accent/10 text-accent">
                <Icon name={item.icon} size={18} />
              </span>
              {item.isNew && <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">Novo</span>}
            </span>
            <p className="font-[family-name:var(--font-display)] text-sm font-semibold leading-tight">{item.title}</p>
            <p className="flex-1 text-xs text-muted">{item.body}</p>
            <span className="text-xs font-medium text-accent group-hover:underline">{item.cta} →</span>
          </Link>
        ))}
      </div>
      {STRIP_ITEMS.length > COLLAPSED && (
        <button type="button" onClick={() => setExpanded((v) => !v)} className="text-sm font-medium text-accent hover:underline" data-testid="differentiators-toggle">
          {expanded ? "Mostrar menos" : `Ver todos os diferenciais (${STRIP_ITEMS.length})`}
        </button>
      )}
    </div>
  );
}
