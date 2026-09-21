"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Activity } from "@/lib/marketplace-db";

// Central de atividade: sino com feed por papel
export default function ActivityBell({
  audience,
  clientId,
  professionalId,
}: {
  audience: "agency" | "client" | "professional";
  clientId?: string;
  professionalId?: string;
}) {
  const [items, setItems] = useState<Activity[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(() => {
    const params = new URLSearchParams({ audience });
    if (clientId) params.set("clientId", clientId);
    if (professionalId) params.set("professionalId", professionalId);
    api<Activity[]>(`/api/activities?${params}`).then(setItems).catch(() => {});
  }, [audience, clientId, professionalId]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [load]);

  const unread = items.filter((item) => !item.readAt).length;

  return (
    <div className="relative">
      <button
        onClick={async () => {
          const next = !open;
          setOpen(next);
          if (next && unread > 0) {
            await api("/api/activities", {
              method: "PATCH",
              body: JSON.stringify({ audience }),
            });
            load();
          }
        }}
        className="relative grid size-10 place-items-center rounded-sm text-text-muted transition-colors hover:bg-surface-sunken hover:text-text"
        title="Atividade"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-text text-[10px] font-medium text-canvas">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} />
          <div className="fixed right-4 top-16 z-[70] max-h-96 w-80 overflow-y-auto rounded-md border border-edge bg-surface p-2 shadow-e2 animate-pop-in [transform-origin:top_right]">
          {items.length === 0 ? (
            <p className="p-3 t3 text-text-muted">Nada por aqui ainda.</p>
          ) : (
            items.map((item) => (
              <Link
                key={item.id}
                href={item.href || "#"}
                onClick={() => setOpen(false)}
                className="block rounded-md p-2.5 t3 transition-colors hover:bg-surface-sunken"
              >
                <p>{item.text}</p>
                <p className="mt-0.5 t6 text-text-muted">
                  {new Date(item.createdAt).toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </Link>
            ))
          )}
          </div>
        </>
      )}
    </div>
  );
}

export function LogoutButton() {
  return (
    <button
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        window.location.href = "/login";
      }}
      className="rounded-md border border-edge bg-surface-sunken px-2.5 py-1 t5 text-text-muted transition-colors hover:border-negative/50 hover:text-negative"
      title="Sair"
    >
      Sair ↩
    </button>
  );
}
