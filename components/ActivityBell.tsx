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
        className="relative rounded-md border border-edge bg-surface-2 px-2.5 py-1 text-sm transition-colors hover:border-accent"
        title="Atividade"
      >
        🔔
        {unread > 0 && (
          <span className="absolute -right-1.5 -top-1.5 grid size-4 place-items-center rounded-full bg-accent text-[10px] font-bold text-accent-ink">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-50 max-h-96 w-80 overflow-y-auto rounded-xl border border-edge bg-surface p-2 shadow-2xl">
          {items.length === 0 ? (
            <p className="p-3 text-sm text-muted">Nada por aqui ainda.</p>
          ) : (
            items.map((item) => (
              <Link
                key={item.id}
                href={item.href || "#"}
                onClick={() => setOpen(false)}
                className="block rounded-md p-2.5 text-sm transition-colors hover:bg-surface-2"
              >
                <p>{item.text}</p>
                <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted">
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
      className="rounded-md border border-edge bg-surface-2 px-2.5 py-1 text-xs text-muted transition-colors hover:border-red-700 hover:text-red-400"
      title="Sair"
    >
      Sair ↩
    </button>
  );
}
