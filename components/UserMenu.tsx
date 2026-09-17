"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "./icons";

// Menu da conta (todas as larguras de tela): minha conta, planos e sair.
// showPlans: false para quem não compra nada (marca gerenciada, profissional).
export default function UserMenu({ name, role, showPlans = true }: { name: string; role: string; showPlans?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.replace(new URL("/login", window.location.origin).href);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="Menu da conta"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="user-menu"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-surface-2 hover:text-foreground"
        data-testid="user-menu"
      >
        <Icon name="user" size={17} />
        <span className="hidden max-w-32 truncate sm:inline">{name}</span>
      </button>
      {open && (
        <div
          id="user-menu"
          role="menu"
          className="absolute right-0 top-10 z-50 w-56 rounded-xl border border-edge bg-surface p-1.5 text-sm shadow-2xl"
        >
          <p className="truncate px-3 py-1.5 text-xs text-muted">{name}</p>
          <Link role="menuitem" href="/conta" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-surface-2">
            <Icon name="settings" size={15} /> Minha conta
          </Link>
          {role === "admin" ? (
            <Link role="menuitem" href="/admin" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-surface-2">
              <Icon name="chart" size={15} /> Admin
            </Link>
          ) : showPlans ? (
            <Link role="menuitem" href="/plans" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-surface-2">
              <Icon name="sparkle" size={15} /> Planos & coins
            </Link>
          ) : null}
          {role !== "admin" && (
            <button
              role="menuitem"
              type="button"
              onClick={() => {
                setOpen(false);
                window.dispatchEvent(new Event("ah:tour-start"));
              }}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left hover:bg-surface-2"
              data-testid="tour-restart"
            >
              <Icon name="sparkle" size={15} /> Refazer tour
            </button>
          )}
          <Link role="menuitem" href="/contato" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-surface-2">
            <Icon name="mail" size={15} /> Ajuda e contato
          </Link>
          <button
            role="menuitem"
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-red-500 hover:bg-surface-2"
            data-testid="logout"
          >
            <Icon name="logout" size={15} /> Sair
          </button>
        </div>
      )}
    </div>
  );
}
