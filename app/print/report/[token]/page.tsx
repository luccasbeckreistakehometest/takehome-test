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

// O tema claro forçado saiu daqui: `.doc` (globals.css §10) já redeclara os
// papéis do tema claro, então a peça é papel nos dois temas e na impressão sem
// cada tela repetir um mapa de hex.

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

  if (notFound) return <p className="t3 py-24 text-center text-text-muted">Relatório não encontrado.</p>;
  if (!payload) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner label="Preparando documento..." />
      </div>
    );
  }
  return (
    // A versão pública do relatório é A PEÇA: capa com régua da marca, mancha
    // de 160mm igual à do papel e folha de impressão de verdade (§10). O botão
    // de PDF é a única coisa que não imprime.
    <article className="doc my-8 px-8 py-10 sm:px-12">
      <div className="no-print mb-6 flex justify-end">
        <button
          onClick={() => window.print()}
          className="t3 inline-flex h-10 items-center rounded-sm border border-transparent bg-brand-solid px-4 font-medium text-brand-ink transition-[filter] hover:brightness-95"
        >
          Salvar como PDF
        </button>
      </div>

      <div className="doc-cover">
        <div className="doc-rule" />
        <p className="t6 mt-4 text-n-500">{payload.agency.name}</p>
        <h1 className="d2 mt-3" style={{ ["--soft" as string]: 20 }} data-testid="print-title">
          Relatório mensal
        </h1>
        <p className="t1 mt-2 text-n-700">
          {payload.client.name} · {monthTitle(payload.report.month, lang)}
        </p>
        <p className="t5 tnum mt-6 text-n-500">
          Emitido em{" "}
          {new Date(payload.report.createdAt).toLocaleDateString(lang === "en" ? "en-US" : "pt-BR", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>

      <div className="mt-10">
        <MonthlyReportView data={payload.report.data} summary={payload.report.summary} lang={lang} />
      </div>

      <footer className="mt-12 border-t border-edge pt-3">
        <p className="t5 text-n-500">
          {payload.agency.name}
          {payload.agency.tagline ? ` — ${payload.agency.tagline}` : ""}
        </p>
      </footer>
    </article>
  );
}
