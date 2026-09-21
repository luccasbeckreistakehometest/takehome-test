"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { fmtCurrency, useUiLang } from "@/lib/i18n";
import { currentMonth, shiftMonth } from "@/lib/report-aggregate";
import { formatHours } from "@/lib/finance-rules";
import type { MarginReport } from "@/lib/finance-db";
import { MARGIN_LABEL, MARGIN_STYLE } from "@/components/TimeTab";
import { ActionBar, Button, Column, EmptyState, ErrorBox, Field, Input, InputAffix, SectionTitle, Table } from "@/components/ui";
import { Icon } from "@/components/icons";
import { buttonClass } from "@/lib/button-class";

function monthLabel(month: string, lang: "pt" | "en"): string {
  const d = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1));
  const label = d.toLocaleDateString(lang === "en" ? "en-US" : "pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// Horas & margem da agência: cada cliente com fee, horas, custo e margem no
// mês; quem dá prejuízo em vermelho; custo/hora da equipe e dos
// profissionais; fee editável na própria linha; CSV.
export default function FinancePage() {
  const lang = useUiLang();
  const [month, setMonth] = useState(() => currentMonth());
  const [report, setReport] = useState<(MarginReport & { received?: Record<string, number> }) | null>(null);
  const [error, setError] = useState("");
  const [rates, setRates] = useState<{ defaultHourlyCost: string; targetMarginPct: string; professionals: Record<string, string> }>({ defaultHourlyCost: "", targetMarginPct: "", professionals: {} });
  const [fees, setFees] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(() => {
    api<MarginReport>(`/api/finance/margin?month=${month}`)
      .then((r) => {
        setReport(r);
        setRates({
          defaultHourlyCost: String(r.settings.defaultHourlyCost || ""),
          targetMarginPct: String(r.settings.targetMarginPct),
          professionals: Object.fromEntries(r.rates.map((p) => [p.id, String(p.hourlyCost || "")])),
        });
        setFees(Object.fromEntries(r.rows.map((row) => [row.clientId, String(row.fee || "")])));
      })
      .catch((e) => setError(e.message));
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    if (!report) return;
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      await api("/api/finance/settings", {
        method: "PUT",
        body: JSON.stringify({
          defaultHourlyCost: Number(rates.defaultHourlyCost) || 0,
          targetMarginPct: Number(rates.targetMarginPct) || 0,
          professionals: Object.entries(rates.professionals).map(([id, v]) => ({ id, hourlyCost: Number(v) || 0 })),
          clientFees: Object.entries(fees).map(([clientId, v]) => ({ clientId, monthlyFee: Number(v) || 0 })),
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  const money = (v: number) => fmtCurrency(v, report?.settings.currency ?? "BRL", lang);

  // §9.1 — cada coluna com largura própria: texto à esquerda, número à
  // direita, situação à esquerda. A coluna numérica nunca trunca.
  const columns: Column<MarginReport["rows"][number]>[] = [
    {
      key: "name",
      header: "Cliente",
      width: "220px",
      cell: (row) => (
        <Link href={`/clients/${row.clientId}?tab=time`} className="font-medium underline-offset-4 hover:underline">
          {row.name}
        </Link>
      ),
    },
    {
      key: "fee",
      header: "Fee mensal",
      width: "150px",
      align: "right",
      cell: (row) => (
        <InputAffix
          prefix="R$"
          type="number"
          min={0}
          value={fees[row.clientId] ?? ""}
          onChange={(e) => setFees({ ...fees, [row.clientId]: e.target.value })}
          aria-label={`Fee de ${row.name}`}
          className="ml-auto max-w-[130px]"
        />
      ),
    },
    {
      key: "received",
      header: "Recebido",
      width: "120px",
      align: "right",
      cell: (row) => (
        <span data-testid="margin-received" className={report?.received?.[row.clientId] ? "" : "text-text-faint"}>
          {report?.received?.[row.clientId] ? money(report.received[row.clientId]) : "—"}
        </span>
      ),
    },
    { key: "hours", header: "Horas", width: "96px", align: "right", cell: (row) => formatHours(row.minutes) },
    { key: "cost", header: "Custo", width: "130px", align: "right", cell: (row) => money(row.cost) },
    {
      key: "margin",
      header: "Margem",
      width: "170px",
      align: "right",
      cell: (row) => (
        <span data-testid="margin-cell" className={row.margin < 0 ? "font-medium text-negative" : "font-medium"}>
          {money(row.margin)}
          {row.marginPct !== null && <span className="t5 ml-1 text-text-muted">({row.marginPct}%)</span>}
        </span>
      ),
    },
    {
      key: "rate",
      header: "Custo/h efetivo",
      width: "140px",
      align: "right",
      cell: (row) => (row.effectiveHourlyRate !== null ? `${money(row.effectiveHourlyRate)}/h` : <span className="text-text-faint">—</span>),
    },
    {
      key: "status",
      header: "Situação",
      width: "124px",
      cell: (row) => (
        <span className={`t5 rounded-xs border px-2 py-0.5 ${MARGIN_STYLE[row.status]}`}>
          {MARGIN_LABEL[row.status]}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6" data-testid="finance-page">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-edge pb-5">
        <div>
          <h1 className="d3">Horas & margem</h1>
          <p className="t3 measure-lede mt-2 text-text-muted">Quanto cada cliente paga por mês contra quanto ele custa em horas da equipe. Quem dá prejuízo aparece em vermelho.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setMonth((m) => shiftMonth(m, -1))} className="grid size-9 place-items-center rounded-sm border border-edge text-text-muted hover:bg-surface-sunken" aria-label="Mês anterior">‹</button>
          <span className="min-w-40 text-center font-medium" data-testid="finance-month">{monthLabel(month, lang)}</span>
          <button onClick={() => setMonth((m) => shiftMonth(m, 1))} className="grid size-9 place-items-center rounded-sm border border-edge text-text-muted hover:bg-surface-sunken" aria-label="Próximo mês">›</button>
          <a href={`/api/finance/margin?month=${month}&format=csv&lang=${lang}`} className={`${buttonClass("secondary")} gap-1.5`} data-testid="finance-csv">
            <Icon name="doc" size={15} /> Exportar CSV
          </a>
        </div>
      </div>

      {error && <ErrorBox message={error} />}

      {!report ? (
        // Esqueleto com AS MESMAS larguras de coluna (§9.1), não um spinner.
        <Table
          caption="Carregando a margem por cliente"
          rows={[]}
          rowKey={() => ""}
          loading
          minWidth={1120}
          columns={columns}
        />
      ) : (
        <>
          <div className="grid gap-x-8 gap-y-5 border-y border-edge py-4 sm:grid-cols-3 lg:grid-cols-5">
            {[
              { label: "Fees do mês", value: money(report.totals.fee) },
              { label: "Horas apontadas", value: formatHours(report.totals.hours * 60) },
              { label: "Custo das horas", value: money(report.totals.cost) },
              { label: "Margem", value: money(report.totals.margin), hint: report.totals.marginPct !== null ? `${report.totals.marginPct}%` : undefined, negative: report.totals.margin < 0 },
              { label: "Clientes sinalizados", value: String(report.totals.flagged) },
            ].map((kpi) => (
              <div key={kpi.label} className="min-w-0">
                <p className="t6 text-text-muted">{kpi.label}</p>
                <p className={`n2 mt-1 ${kpi.negative ? "text-negative" : ""}`}>{kpi.value}</p>
                {kpi.hint && <p className="t5 text-text-muted">{kpi.hint}</p>}
              </div>
            ))}
          </div>

          {/* §9.1: largura DECLARADA por coluna, table-layout fixo, número à
              direita em figura tabular e o cabeçalho alinhado igual à célula.
              Eram oito colunas — seis numéricas — todas à esquerda, em largura
              automática, dentro de um contêiner com rolagem e nada mais. */}
          <Table
            caption={`Margem por cliente em ${monthLabel(month, lang)}`}
            rows={report.rows}
            rowKey={(row) => row.clientId}
            rowAttrs={(row) => ({
              "data-testid": "margin-row",
              "data-status": row.status,
              "data-client": row.name,
              // Estado, não decoração (§5.3): prejuízo é campo semântico.
              className: row.status === "loss" ? "bg-negative-wash" : undefined,
            })}
            minWidth={1120}
            columns={columns}
            total={[
              "Total",
              money(report.totals.fee),
              "",
              formatHours(report.totals.hours * 60),
              money(report.totals.cost),
              money(report.totals.margin),
              "",
              "",
            ]}
            empty={
              <EmptyState
                icon="clock"
                title="Cada cliente com fee ou horas apontadas no mês aparece aqui, com custo e margem."
                condition="Aponte horas na aba Horas do cliente, ou defina o fee mensal abaixo."
              />
            }
          />

          <section className="mt-10 space-y-4 border-t border-edge pt-5">
            <div>
              <SectionTitle>Custos e meta</SectionTitle>
              <p className="t3 text-text-muted">O custo/hora da equipe interna vale para todo apontamento sem profissional. Profissionais com custo próprio entram pelo valor deles.</p>
            </div>
            {/* §11.2: a largura comunica o conteúdo esperado. "Margem-alvo (%)"
                tinha 350px para dois dígitos; a instrução sai do placeholder,
                que some justamente no foco. */}
            <div className="flex flex-wrap gap-x-8 gap-y-5 border-y border-edge py-4">
              <Field label="Custo/hora da equipe interna" hint="Vale para todo apontamento sem profissional." width="money">
                {(field) => (
                  <InputAffix
                    {...field}
                    prefix="R$"
                    type="number"
                    min={0}
                    value={rates.defaultHourlyCost}
                    onChange={(e) => setRates({ ...rates, defaultHourlyCost: e.target.value })}
                    data-testid="rate-default"
                  />
                )}
              </Field>
              <Field label="Margem-alvo" hint="Abaixo dela o cliente é sinalizado." width="pct">
                {(field) => (
                  <InputAffix
                    {...field}
                    suffix="%"
                    type="number"
                    min={0}
                    max={95}
                    value={rates.targetMarginPct}
                    onChange={(e) => setRates({ ...rates, targetMarginPct: e.target.value })}
                    data-testid="rate-target"
                  />
                )}
              </Field>
            </div>
            {report.rates.length > 0 && (
              <div>
                <p className="mb-1 t6 text-text-muted">Custo/hora por profissional</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {report.rates.map((p) => (
                    <div key={p.id} className="flex items-center gap-2 rounded-md border border-edge bg-surface-sunken px-3 py-2 t3">
                      <span className="min-w-0 flex-1 truncate">{p.name}</span>
                      <InputAffix
                        prefix="R$"
                        type="number"
                        min={0}
                        value={rates.professionals[p.id] ?? ""}
                        onChange={(e) => setRates({ ...rates, professionals: { ...rates.professionals, [p.id]: e.target.value } })}
                        className="w-28 shrink-0"
                        aria-label={`Custo/hora de ${p.name}`}
                        data-testid="rate-professional"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* §11.2: formulário longo ganha barra de ação fixa. O Salvar estava
              a 1.400px de rolagem do campo que ele salva. */}
          <ActionBar note={saved ? "Aplicado ✓" : "Fees e custos valem para todos os meses."}>
            <Button onClick={save} loading={saving} data-testid="finance-save">
              Salvar custos e fees
            </Button>
          </ActionBar>
        </>
      )}
    </div>
  );
}
