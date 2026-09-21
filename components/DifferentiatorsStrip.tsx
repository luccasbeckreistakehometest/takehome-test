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
    // Índice de novidades, não oito cartões iguais: numeral tabular, régua entre
    // linhas, duas colunas e nenhum selo colorido — "novo" é uma palavra.
    <section className="border-b border-edge pb-2">
      <div className="grid sm:grid-cols-2 sm:gap-x-10" data-testid="differentiators">
        {items.map((item, i) => (
          <Link
            key={item.anchor}
            href={item.href as never}
            data-tour={item.anchor}
            data-testid="differentiator"
            className="group flex items-baseline gap-3 border-t border-rule py-3"
          >
            <span className="idx t5 w-6 shrink-0">{String(i + 1).padStart(2, "0")}</span>
            <span className="min-w-0 flex-1">
              <span className="t3 block font-medium">
                {item.title}
                {item.isNew && <span className="t6 ml-2 align-middle text-text-muted">novo</span>}
              </span>
              <span className="t5 measure-prose mt-0.5 block text-text-muted">{item.body}</span>
              <span className="t5 mt-1 inline-flex items-center gap-1 font-medium underline-offset-4 group-hover:underline">
                {item.cta}
                <Icon name="arrow-right" size={16} />
              </span>
            </span>
          </Link>
        ))}
      </div>
      {STRIP_ITEMS.length > COLLAPSED && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="t5 mt-3 inline-flex min-h-10 items-center font-medium underline-offset-4 hover:underline"
          data-testid="differentiators-toggle"
        >
          {expanded ? "Mostrar menos" : `Ver todos os diferenciais (${STRIP_ITEMS.length})`}
        </button>
      )}
    </section>
  );
}
