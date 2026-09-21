"use client";

// Trilho da ferramenta — docs/DESIGN.md §4.1B.
//
// Antes: doze alvos de navegação, mais busca, notificações, trabalhos, tema,
// idioma, ajustes, menu de conta e um botão de entrar, todos espremidos numa
// barra de 56px. Um item ativo era uma pílula laranja e nada tinha grupo.
//
// Agora: 248px fixos à esquerda com os sete itens principais em dois blocos
// nomeados e os cinco secundários atrás de "Mais"; o item ativo é marcado por
// uma régua de 2px na borda interna (o único papel da cor da marca nesta tela)
// e por peso, não por uma pílula. Abaixo de 1024px o trilho vira gaveta, aberta
// pelo botão da barra superior.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./icons";
import { AGENCY_MORE_NAV, AGENCY_NAV_GROUPS, navItemActive } from "@/lib/nav";

export default function AppRail({ brandName }: { brandName: string }) {
  const pathname = usePathname() ?? "/";
  const [moreOpen, setMoreOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const moreActive = AGENCY_MORE_NAV.some((item) => navItemActive(item, pathname));

  // A gaveta fecha ao navegar — no clique, não num efeito disparado pela
  // mudança de rota: escrever estado dentro de efeito é exatamente o que o
  // compilador do React aponta, e o clique é o evento real.
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  useEffect(() => {
    const onOpen = () => setDrawerOpen(true);
    window.addEventListener("ah:rail-open", onOpen);
    return () => window.removeEventListener("ah:rail-open", onOpen);
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    const onDown = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [drawerOpen]);

  const itemClass = (active: boolean) =>
    `relative flex min-h-10 items-center gap-2.5 py-2 pl-4 pr-3 t3 transition-colors duration-[var(--dur-1)] ${
      active
        ? "font-medium text-text before:absolute before:inset-y-1 before:left-0 before:w-0.5 before:bg-brand-solid before:content-['']"
        : "text-text-muted hover:bg-surface-sunken hover:text-text"
    }`;

  const railBody = (
    <>
      <nav aria-label="Navegação" data-testid="agency-nav" className="flex flex-col">
        {AGENCY_NAV_GROUPS.map((group, gi) => (
          <div key={group.label} className={gi > 0 ? "mt-6" : ""}>
            <p className="t6 mb-1 px-4 text-text-muted">{group.label}</p>
            {group.items.map((item) => {
              const active = navItemActive(item, pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  data-tour={item.tour}
                  aria-current={active ? "page" : undefined}
                  onClick={closeDrawer}
                  className={itemClass(active)}
                >
                  <Icon name={item.icon} size={16} className="shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="mt-6">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen((v) => !v)}
          data-testid="nav-more"
          className={`t6 flex min-h-10 w-full items-center justify-between px-4 py-2 transition-colors hover:text-text ${
            moreActive ? "text-text" : "text-text-muted"
          }`}
        >
          Mais
          <Icon name={moreOpen ? "chevron-up" : "chevron-down"} size={16} />
        </button>
        {(moreOpen || moreActive) && (
          <div role="menu" className="flex flex-col">
            {AGENCY_MORE_NAV.map((item) => {
              const active = navItemActive(item, pathname);
              return (
                <Link
                  key={item.href}
                  role="menuitem"
                  href={item.href}
                  data-tour={item.tour}
                  aria-current={active ? "page" : undefined}
                  onClick={closeDrawer}
                  className={itemClass(active)}
                >
                  <Icon name={item.icon} size={16} className="shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Trilho fixo — desktop */}
      <aside
        className="app-rail no-print hidden shrink-0 border-r border-rule bg-surface lg:flex lg:flex-col"
        data-testid="app-rail"
      >
        <div className="sticky top-0 max-h-dvh overflow-y-auto py-5">
          <p className="t6 mb-5 truncate px-4 text-text-muted">{brandName}</p>
          {railBody}
        </div>
      </aside>

      {/* Gaveta — abaixo de 1024px */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="scrim absolute inset-0" aria-hidden />
          <div
            ref={drawerRef}
            role="dialog"
            aria-label="Navegação principal"
            className="animate-pop-in absolute inset-y-0 left-0 w-[17rem] overflow-y-auto border-r border-edge bg-surface py-5 shadow-e2"
          >
            <div className="mb-5 flex items-center justify-between px-4">
              <p className="t6 truncate text-text-muted">{brandName}</p>
              <button
                type="button"
                aria-label="Fechar navegação"
                onClick={closeDrawer}
                className="grid size-10 place-items-center rounded-sm text-text-muted hover:bg-surface-sunken"
              >
                <Icon name="x" size={16} />
              </button>
            </div>
            {railBody}
          </div>
        </div>
      )}
    </>
  );
}

/** Botão da barra superior que abre a gaveta (só existe abaixo de 1024px). */
export function RailToggle() {
  return (
    <button
      type="button"
      aria-label="Menu de navegação"
      data-testid="nav-mobile"
      onClick={() => window.dispatchEvent(new Event("ah:rail-open"))}
      className="grid size-10 shrink-0 place-items-center rounded-sm text-text-muted transition-colors hover:bg-surface-sunken hover:text-text lg:hidden"
    >
      <Icon name="menu" size={20} />
    </button>
  );
}
