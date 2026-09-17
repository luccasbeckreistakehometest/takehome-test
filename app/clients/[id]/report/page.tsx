"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useUiLang } from "@/lib/i18n";
import { currentMonth, shiftMonth, type MonthlyReportData } from "@/lib/report-aggregate";
import type { MonthlyReport } from "@/lib/reports-db";
import MonthlyReportView, { monthTitle } from "@/components/MonthlyReportView";
import { Button, Card, CopyButton, ErrorBox, Spinner } from "@/components/ui";
import { Icon } from "@/components/icons";

type Payload = {
  client: { id: string; name: string; language: "pt-BR" | "en" };
  month: string;
  data: MonthlyReportData;
  report: MonthlyReport | null;
  history: { month: string; token: string; createdAt: string }[];
};

// Relatório mensal em 1 clique (visão da agência): escolhe o mês, vê os
// números ao vivo, gera o resumo executivo com IA e compartilha com o cliente
// (portal ou link imprimível).
export default function ClientMonthlyReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const lang = useUiLang();
  const [month, setMonth] = useState<string>(() => currentMonth());
  const [payload, setPayload] = useState<Payload | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("month");
    if (wanted && /^\d{4}-\d{2}$/.test(wanted)) setTimeout(() => setMonth(wanted), 0);
    setTimeout(() => setOrigin(window.location.origin), 0);
  }, []);

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

  const printUrl = payload?.report ? `${origin}/print/report/${payload.report.token}` : "";
  const portalUrl = `${origin}/portal/client/${id}/report?month=${month}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href={`/clients/${id}`} className="text-sm text-accent hover:underline">
            ← Voltar ao cliente
          </Link>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">
            Relatório mensal
          </h1>
          {payload && <p className="mt-1 text-sm text-muted">{payload.client.name}</p>}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
            className="grid size-9 place-items-center rounded-md border border-edge bg-surface-2 hover:border-accent"
            aria-label="Mês anterior"
            data-testid="report-prev"
          >
            ‹
          </button>
          <span className="min-w-40 text-center font-medium" data-testid="report-month">
            {monthTitle(month, lang)}
          </span>
          <button
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
            className="grid size-9 place-items-center rounded-md border border-edge bg-surface-2 hover:border-accent"
            aria-label="Próximo mês"
            data-testid="report-next"
          >
            ›
          </button>
        </div>
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted">
          <p>
            Os números vêm da própria conta: entregas e aprovações, posts, métricas e vendas do mês. A IA escreve o resumo executivo e as recomendações.
          </p>
          {payload?.report && (
            <p className="mt-1 text-xs">
              Resumo gerado em{" "}
              {new Date(payload.report.createdAt).toLocaleString(lang === "en" ? "en-US" : "pt-BR")}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={generate} disabled={generating} data-testid="report-generate">
            <Icon name="sparkle" size={15} />
            {generating ? "Gerando resumo..." : payload?.report ? "Regerar resumo com IA" : "Gerar resumo com IA"}
          </Button>
          {payload?.report && (
            <>
              <a
                href={`/print/report/${payload.report.token}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-edge bg-surface-2 px-3 py-2 text-sm hover:border-accent"
                data-testid="report-print-link"
              >
                <Icon name="doc" size={15} /> Versão para imprimir / PDF
              </a>
              <CopyButton text={printUrl} label="Copiar link público" />
              <CopyButton text={portalUrl} label="Copiar link do portal" />
            </>
          )}
        </div>
      </Card>

      {error && <ErrorBox message={error} />}
      {generating && <Spinner label="A IA está lendo os números do mês e escrevendo o resumo..." />}

      {!payload ? (
        <div className="grid place-items-center py-16">
          <Spinner label="Carregando o mês..." />
        </div>
      ) : (
        <MonthlyReportView data={payload.data} summary={payload.report?.summary ?? null} lang={lang} />
      )}

      {payload && payload.history.length > 0 && (
        <Card>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Relatórios já gerados</p>
          <div className="flex flex-wrap gap-2">
            {payload.history.map((h) => (
              <button
                key={h.month}
                onClick={() => setMonth(h.month)}
                className={`rounded-md border px-3 py-1 text-sm ${h.month === month ? "border-accent text-accent" : "border-edge text-muted hover:border-accent"}`}
              >
                {monthTitle(h.month, lang)}
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
