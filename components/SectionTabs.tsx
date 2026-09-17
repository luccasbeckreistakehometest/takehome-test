"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SectionTab } from "@/lib/nav";

// Controle segmentado entre páginas irmãs (Agenda: conteúdo | reuniões;
// Resultados: insights | margem | cobranças). Cada aba é um link real.
export default function SectionTabs({ tabs, label }: { tabs: SectionTab[]; label: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="mb-6 inline-flex max-w-full flex-wrap gap-1 rounded-full border border-edge bg-surface-2 p-1">
      {tabs.map((tab) => {
        const active = pathname === tab.href || pathname?.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            data-testid={tab.testId}
            aria-current={active ? "page" : undefined}
            className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
              active ? "bg-accent font-medium text-accent-ink" : "text-muted hover:text-foreground"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
