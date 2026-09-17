"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useUiLang } from "@/lib/i18n";
import { currentMonth, shiftMonth, type MonthlyReportData } from "@/lib/report-aggregate";
import type { MonthlyReport } from "@/lib/reports-db";
import MonthlyReportView, { monthTitle } from "@/components/MonthlyReportView";
import { Button, Card, ErrorBox, Spinner } from "@/components/ui";

type Payload = {
  client: { id: string; name: string; language: "pt-BR" | "en" };
  month: string;
  data: MonthlyReportData;
  report: MonthlyReport | null;
  history: { month: string; token: string; createdAt: string }[];
};

// Relatório mensal na visão do cliente: os mesmos números, o resumo que a
// agência gerou e o botão de PDF. Marca autônoma pode gerar o próprio.
export default function PortalMonthlyReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const lang = useUiLang();
  const [month, setMonth] = useState<string>(() => currentMonth());
  const [payload, setPayload] = useState<Payload | null>(null);
  const [selfServe, setSelfServe] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("month");
    if (wanted && /^\d{4}-\d{2}$/.test(wanted)) setTimeout(() => setMonth(wanted), 0);
    api<{ selfServe: boolean }>(`/api/clients/${id}`).then((c) => setSelfServe(c.selfServe)).catch(() => {});
  }, [id]);

  const load = useCallback(() => {
    api<Payload>(`/api/clients/${id}/report?month=${month}`)
      .then((p) => {
        setPayload(p);
        setError("");
      })
      .catch((e) => setError(e.message));
  }, [id, month]);

  useEffect(() => {
    load();
  }, [load]);

  async function generate() {
    setGenerating(true);
    setError("");
    try {
      await api(`/api/clients/${id}/report`, { method: "POST", body: JSON.stringify({ month }) });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao gerar o relatório");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href={`/portal/client/${id}`} className="text-sm text-accent hover:underline">
            ← Voltar ao portal
          </Link>
          <p className="mt-2 text-xs uppercase tracking-widest text-accent">Portal do cliente</p>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">
            Relatório mensal
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setMonth((m) => shiftMonth(m, -1))} className="grid size-9 place-items-center rounded-md border border-edge bg-surface-2 hover:border-accent" aria-label="Mês anterior">
            ‹
          </button>
          <span className="min-w-40 text-center font-medium" data-testid="report-month">{monthTitle(month, lang)}</span>
          <button onClick={() => setMonth((m) => shiftMonth(m, 1))} className="grid size-9 place-items-center rounded-md border border-edge bg-surface-2 hover:border-accent" aria-label="Próximo mês">
            ›
          </button>
        </div>
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {payload?.report
            ? "Aqui está o que aconteceu na sua conta neste mês, com o resumo e as recomendações da equipe."
            : selfServe
              ? "Gere o resumo executivo deste mês com um clique."
              : "Sua agência ainda não gerou o resumo deste mês — os números abaixo já são os reais."}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {selfServe && (
            <Button onClick={generate} disabled={generating}>
              {generating ? "Gerando resumo..." : "Gerar resumo com IA"}
            </Button>
          )}
          {payload?.report && (
            <a
              href={`/print/report/${payload.report.token}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-edge bg-surface-2 px-3 py-2 text-sm hover:border-accent"
            >
              📄 Salvar em PDF
            </a>
          )}
        </div>
      </Card>

      {error && <ErrorBox message={error} />}
      {!payload ? (
        <div className="grid place-items-center py-16">
          <Spinner label="Carregando o mês..." />
        </div>
      ) : (
        <MonthlyReportView data={payload.data} summary={payload.report?.summary ?? null} lang={lang} />
      )}
    </div>
  );
}
