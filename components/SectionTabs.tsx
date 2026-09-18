"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SectionTab } from "@/lib/nav";

// Controle segmentado entre páginas irmãs (Agenda: conteúdo | reuniões;
// Resultados: insights | margem | cobranças). Cada aba é um link real.
export default function SectionTabs({ tabs, label }: { tabs: SectionTab[]; label: string }) {
  const pathname = usePathname();
  return (
    // Aba sublinhada (§11), não pílula: a pílula colorida era o mesmo desenho
    // do botão primário e competia com ele em toda tela de seção.
    <nav aria-label={label} className="mb-6 flex max-w-full flex-wrap gap-6 border-b border-edge">
      {tabs.map((tab) => {
        const active = pathname === tab.href || pathname?.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            data-testid={tab.testId}
            aria-current={active ? "page" : undefined}
            className={`t3 -mb-px border-b-2 py-2 transition-colors duration-[var(--dur-1)] ${
              active ? "border-text font-medium text-text" : "border-transparent text-text-muted hover:text-text"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
