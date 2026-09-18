"use client";

import { use, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useUiLang } from "@/lib/i18n";
import type { MonthlyReport } from "@/lib/reports-db";
import MonthlyReportView, { monthTitle } from "@/components/MonthlyReportView";
import { Spinner } from "@/components/ui";

type Payload = {
  report: MonthlyReport;
  client: { name: string; language: "pt-BR" | "en" };
  agency: { name: string; accentColor: string; tagline: string };
};

// Tema claro para impressão/PDF — mesmo padrão de /print/[id]
const PRINT_THEME: Record<string, string> = {
  "--background": "#ffffff",
  "--surface": "#ffffff",
  "--surface-2": "#f4f5f7",
  "--edge": "#d9dce2",
  "--foreground": "#16181d",
  "--muted": "#4b5058",
  "--accent-ink": "#ffffff",
};

// Versão imprimível/compartilhável do relatório mensal (link por token, sem
// login). Cabeçalho com a marca da agência, tema claro e botão de PDF.
export default function PrintMonthlyReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const lang = useUiLang();
  const [payload, setPayload] = useState<Payload | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    api<Payload>(`/api/reports/${token}`).then(setPayload).catch(() => setNotFound(true));
  }, [token]);

  if (notFound) return <p className="py-24 text-center text-muted">Relatório não encontrado.</p>;
  if (!payload) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner label="Preparando documento..." />
      </div>
    );
  }
  const theme = { ...PRINT_THEME, "--accent": payload.agency.accentColor || "#3f6212" };
  return (
    <div style={theme as React.CSSProperties} className="rounded-xl bg-background p-6 text-foreground">
      <button
        onClick={() => window.print()}
        className="fixed bottom-6 right-6 z-50 rounded-full bg-accent px-5 py-3 font-medium text-accent-ink shadow-lg transition-opacity hover:opacity-90 print:hidden"
      >Salvar como PDF
      </button>
      <div className="mb-6 border-b-2 border-foreground pb-4">
        <p className="text-xs font-bold uppercase tracking-widest text-text">{payload.agency.name}</p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold" data-testid="print-title">
          <span>Relatório mensal</span> — {monthTitle(payload.report.month, lang)}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {payload.client.name} ·{" "}
          {new Date(payload.report.createdAt).toLocaleDateString(lang === "en" ? "en-US" : "pt-BR", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>
      <MonthlyReportView data={payload.report.data} summary={payload.report.summary} lang={lang} />
    </div>
  );
}
