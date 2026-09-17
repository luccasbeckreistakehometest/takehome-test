"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./icons";
import { AGENCY_MORE_NAV, AGENCY_PRIMARY_NAV, navItemActive } from "@/lib/nav";

// Navegação da agência: 7 itens principais + "Mais". No celular, um menu só
// com tudo (principais e extras).
export default function AgencyNav() {
  const pathname = usePathname() ?? "/";
  const [moreOpen, setMoreOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const mobileRef = useRef<HTMLDivElement>(null);
  const moreActive = AGENCY_MORE_NAV.some((item) => navItemActive(item, pathname));

  useEffect(() => {
    if (!moreOpen && !mobileOpen) return;
    const onDoc = (event: MouseEvent) => {
      const target = event.target as Node;
      if (moreRef.current && !moreRef.current.contains(target)) setMoreOpen(false);
      if (mobileRef.current && !mobileRef.current.contains(target)) setMobileOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMoreOpen(false);
      setMobileOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [moreOpen, mobileOpen]);

  const linkClass = (active: boolean) =>
    `group flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 transition-colors hover:bg-surface-2 hover:text-foreground ${
      active ? "bg-surface-2 text-foreground" : ""
    }`;

  return (
    <>
      <nav aria-label="Navegação" className="hidden items-center gap-0.5 lg:flex" data-testid="agency-nav">
        {AGENCY_PRIMARY_NAV.map((item) => {
          const active = navItemActive(item, pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              data-tour={item.tour}
              aria-current={active ? "page" : undefined}
              className={linkClass(active)}
            >
              <Icon name={item.icon} size={16} className={`transition-opacity group-hover:opacity-100 ${active ? "text-accent" : "opacity-70"}`} />
              {item.label}
            </Link>
          );
        })}
        <div className="relative" ref={moreRef}>
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((v) => !v)}
            data-testid="nav-more"
            className={linkClass(moreActive)}
          >
            Mais
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          {moreOpen && (
            <div role="menu" className="absolute right-0 top-10 z-50 w-56 rounded-xl border border-edge bg-surface p-1.5 shadow-2xl">
              {AGENCY_MORE_NAV.map((item) => (
                <Link
                  key={item.href}
                  role="menuitem"
                  href={item.href}
                  data-tour={item.tour}
                  onClick={() => setMoreOpen(false)}
                  className="flex items-center gap-2.5 rounded-md px-3 py-2 transition-colors hover:bg-surface-2 hover:text-foreground"
                >
                  <Icon name={item.icon} size={16} />
                  {item.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </nav>

      <div className="relative lg:hidden" ref={mobileRef}>
        <button
          type="button"
          aria-label="Menu de navegação"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((v) => !v)}
          data-testid="nav-mobile"
          className="grid size-8 place-items-center rounded-md hover:bg-surface-2"
        >
          <Icon name="kanban" size={18} />
        </button>
        {mobileOpen && (
          <nav
            aria-label="Navegação principal"
            className="absolute right-0 top-10 z-50 max-h-[75vh] w-60 overflow-y-auto rounded-xl border border-edge bg-surface p-1.5 shadow-2xl"
          >
            {AGENCY_PRIMARY_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-2.5 rounded-md px-3 py-2 transition-colors hover:bg-surface-2 hover:text-foreground ${
                  navItemActive(item, pathname) ? "text-accent" : ""
                }`}
              >
                <Icon name={item.icon} size={16} />
                {item.label}
              </Link>
            ))}
            <p className="mx-3 mb-1 mt-2 border-t border-edge pt-2 text-[11px] uppercase tracking-wider text-muted">Mais</p>
            {AGENCY_MORE_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2.5 rounded-md px-3 py-2 transition-colors hover:bg-surface-2 hover:text-foreground"
              >
                <Icon name={item.icon} size={16} />
                {item.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </>
  );
}
