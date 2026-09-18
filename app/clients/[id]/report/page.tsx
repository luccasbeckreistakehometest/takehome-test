"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useUiLang } from "@/lib/i18n";
import { currentMonth, shiftMonth, type MonthlyReportData } from "@/lib/report-aggregate";
import type { MonthlyReport } from "@/lib/reports-db";
import MonthlyReportView, { monthTitle } from "@/components/MonthlyReportView";
import { buttonClass } from "@/lib/button-class";
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
    // A tela da agência é a PRÉ-VISUALIZAÇÃO da peça: controles em cima, num
    // bloco que não imprime, e o documento na mancha de 160mm — a mesma do
    // papel. Antes o relatório era uma pilha de cartões de largura total, e a
    // versão de impressão era outra tela.
    <div>
      <div className="no-print">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-edge pb-5">
          <div>
            <Link href={`/clients/${id}`} className="t5 text-text-muted underline-offset-4 hover:underline">
              Voltar ao cliente
            </Link>
            <h1 className="d3 mt-2">Relatório mensal</h1>
            {payload && <p className="t5 mt-1 text-text-muted">{payload.client.name}</p>}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMonth((m) => shiftMonth(m, -1))}
              className="grid size-9 place-items-center rounded-sm border border-edge text-text-muted hover:bg-surface-sunken"
              aria-label="Mês anterior"
              data-testid="report-prev"
            >
              <Icon name="chevron-left" size={16} />
            </button>
            <span className="t3 min-w-40 text-center font-medium" data-testid="report-month">
              {monthTitle(month, lang)}
            </span>
            <button
              onClick={() => setMonth((m) => shiftMonth(m, 1))}
              className="grid size-9 place-items-center rounded-sm border border-edge text-text-muted hover:bg-surface-sunken"
              aria-label="Próximo mês"
              data-testid="report-next"
            >
              <Icon name="chevron-right" size={16} />
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <div className="measure-prose">
            <p className="t5 text-text-muted">
              Os números vêm da própria conta: entregas e aprovações, posts, métricas e vendas do
              mês. A IA escreve o resumo executivo e as recomendações.
            </p>
            {payload?.report && (
              <p className="t5 tnum mt-1 text-text-faint">
                Resumo gerado em{" "}
                {new Date(payload.report.createdAt).toLocaleString(lang === "en" ? "en-US" : "pt-BR")}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={generate} disabled={generating} data-testid="report-generate">
              {generating ? "Gerando resumo..." : payload?.report ? "Regerar resumo com IA" : "Gerar resumo com IA"}
            </Button>
            {payload?.report && (
              <>
                <a
                  href={`/print/report/${payload.report.token}`}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonClass("secondary")}
                  data-testid="report-print-link"
                >
                  Versão para imprimir / PDF
                </a>
                <CopyButton text={printUrl} label="Copiar link público" />
                <CopyButton text={portalUrl} label="Copiar link do portal" />
              </>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-4">
            <ErrorBox message={error} />
          </div>
        )}
        {generating && (
          <p className="mt-4">
            <Spinner label="A IA está lendo os números do mês e escrevendo o resumo..." />
          </p>
        )}
      </div>

      {!payload ? (
        <div className="grid place-items-center py-16">
          <Spinner label="Carregando o mês..." />
        </div>
      ) : (
        <article className="doc mt-10 px-8 py-10 sm:px-12">
          <header className="doc-cover">
            <div className="doc-rule" />
            <p className="t6 mt-4 text-n-500">Relatório mensal</p>
            <h2 className="d2 mt-3" style={{ ["--soft" as string]: 20 }}>
              {payload.client.name}
            </h2>
            <p className="t1 tnum mt-2 text-n-500">{monthTitle(month, lang)}</p>
          </header>
          <div className="mt-10">
            <MonthlyReportView data={payload.data} summary={payload.report?.summary ?? null} lang={lang} />
          </div>
        </article>
      )}

      {payload && payload.history.length > 0 && (
        <section className="no-print mt-10 border-t border-edge pt-3">
          <p className="t6 text-text-muted">Relatórios já gerados</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {payload.history.map((h) => (
              <button
                key={h.month}
                onClick={() => setMonth(h.month)}
                className={`t5 rounded-xs border px-3 py-1 ${
                  h.month === month
                    ? "border-edge bg-surface-sunken font-medium text-text"
                    : "border-rule text-text-muted hover:bg-surface-sunken"
                }`}
              >
                {monthTitle(h.month, lang)}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
