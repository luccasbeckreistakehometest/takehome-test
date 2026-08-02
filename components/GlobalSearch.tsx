"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

type Result = { type: string; label: string; sublabel: string; href: string };

// Busca global ⌘K / Ctrl+K
export default function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((o) => !o);
        setQuery("");
        setResults([]);
      }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const search = useCallback((value: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      if (value.trim().length < 2) return setResults([]);
      setResults(await api<Result[]>(`/api/search?q=${encodeURIComponent(value)}`));
    }, 250);
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/60 pt-24"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-edge bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            search(e.target.value);
          }}
          placeholder="Buscar cliente, demanda, profissional, entregável..."
          className="w-full rounded-t-xl border-b border-edge bg-transparent px-4 py-3 text-sm outline-none"
        />
        <div className="max-h-80 overflow-y-auto p-2">
          {results.length === 0 ? (
            <p className="p-3 text-sm text-muted">
              {query.length < 2 ? "Digite para buscar (⌘K abre/fecha)" : "Nada encontrado."}
            </p>
          ) : (
            results.map((result, index) => (
              <button
                key={index}
                onClick={() => {
                  setOpen(false);
                  router.push(result.href);
                }}
                className="flex w-full items-center justify-between rounded-md p-2.5 text-left text-sm transition-colors hover:bg-surface-2"
              >
                <span>
                  <span className="font-medium">{result.label}</span>{" "}
                  <span className="text-xs text-muted">{result.sublabel}</span>
                </span>
                <span className="text-[10px] uppercase tracking-wide text-accent">
                  {result.type}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
