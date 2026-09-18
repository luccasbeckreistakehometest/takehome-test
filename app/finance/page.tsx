"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { fmtCurrency, useUiLang } from "@/lib/i18n";
import { currentMonth, shiftMonth } from "@/lib/report-aggregate";
import { formatHours } from "@/lib/finance-rules";
import type { MarginReport } from "@/lib/finance-db";
import { MARGIN_LABEL, MARGIN_STYLE } from "@/components/TimeTab";
import { Button, Card, ErrorBox, Input, Label, SectionTitle, Spinner } from "@/components/ui";
import { Icon } from "@/components/icons";

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

  return (
    <div className="space-y-6" data-testid="finance-page">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="d3 flex items-center gap-2">
            <Icon name="money" size={24} className="text-text" /> Horas & margem
          </h1>
          <p className="mt-1 t3 text-text-muted">Quanto cada cliente paga por mês contra quanto ele custa em horas da equipe. Quem dá prejuízo aparece em vermelho.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setMonth((m) => shiftMonth(m, -1))} className="grid size-9 place-items-center rounded-md border border-edge bg-surface-sunken hover:border-edge" aria-label="Mês anterior">‹</button>
          <span className="min-w-40 text-center font-medium" data-testid="finance-month">{monthLabel(month, lang)}</span>
          <button onClick={() => setMonth((m) => shiftMonth(m, 1))} className="grid size-9 place-items-center rounded-md border border-edge bg-surface-sunken hover:border-edge" aria-label="Próximo mês">›</button>
          <a href={`/api/finance/margin?month=${month}&format=csv&lang=${lang}`} className="inline-flex items-center gap-1.5 rounded-md border border-edge bg-surface-sunken px-3 py-2 t3 hover:border-edge" data-testid="finance-csv">
            <Icon name="doc" size={15} /> Exportar CSV
          </a>
        </div>
      </div>

      {error && <ErrorBox message={error} />}

      {!report ? (
        <div className="grid place-items-center py-16">
          <Spinner label="Calculando a margem..." />
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { label: "Fees do mês", value: money(report.totals.fee) },
              { label: "Horas apontadas", value: formatHours(report.totals.hours * 60) },
              { label: "Custo das horas", value: money(report.totals.cost) },
              { label: "Margem", value: money(report.totals.margin), hint: report.totals.marginPct !== null ? `${report.totals.marginPct}%` : undefined, negative: report.totals.margin < 0 },
              { label: "Clientes sinalizados", value: String(report.totals.flagged) },
            ].map((kpi) => (
              <Card key={kpi.label}>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">{kpi.label}</p>
                <p className={`n2 mt-1 ${kpi.negative ? "text-negative" : ""}`}>{kpi.value}</p>
                {kpi.hint && <p className="t5 text-text-muted">{kpi.hint}</p>}
              </Card>
            ))}
          </div>

          <Card className="!p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] t3" data-testid="margin-table">
                <thead>
                  <tr className="border-b border-edge text-left text-[11px] uppercase tracking-wider text-text-muted">
                    <th className="px-4 py-2">Cliente</th>
                    <th className="px-4 py-2">Fee mensal</th>
                    <th className="px-4 py-2">Recebido</th>
                    <th className="px-4 py-2">Horas</th>
                    <th className="px-4 py-2">Custo</th>
                    <th className="px-4 py-2">Margem</th>
                    <th className="px-4 py-2">Custo/h efetivo</th>
                    <th className="px-4 py-2">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-6 text-center text-text-muted">Nenhuma hora apontada e nenhum fee cadastrado neste mês. Aponte horas na aba Horas de cada cliente.</td>
                    </tr>
                  )}
                  {report.rows.map((row) => (
                    <tr key={row.clientId} className={`border-b border-edge ${row.status === "loss" ? "bg-negative-wash" : ""}`} data-testid="margin-row" data-status={row.status} data-client={row.name}>
                      <td className="px-4 py-2">
                        <Link href={`/clients/${row.clientId}?tab=time`} className="font-medium hover:text-text">{row.name}</Link>
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          min={0}
                          value={fees[row.clientId] ?? ""}
                          onChange={(e) => setFees({ ...fees, [row.clientId]: e.target.value })}
                          className="w-28 rounded-md border border-edge bg-surface-sunken px-2 py-1 t3 outline-none focus:border-edge"
                          aria-label={`Fee de ${row.name}`}
                        />
                      </td>
                      <td className="px-4 py-2 text-text-muted" data-testid="margin-received">{report.received?.[row.clientId] ? money(report.received[row.clientId]) : "—"}</td>
                      <td className="px-4 py-2">{formatHours(row.minutes)}</td>
                      <td className="px-4 py-2">{money(row.cost)}</td>
                      <td className={`px-4 py-2 font-medium ${row.margin < 0 ? "text-negative" : ""}`} data-testid="margin-cell">
                        {money(row.margin)}
                        {row.marginPct !== null && <span className="ml-1 t5 text-text-muted">({row.marginPct}%)</span>}
                      </td>
                      <td className="px-4 py-2 text-text-muted">{row.effectiveHourlyRate !== null ? `${money(row.effectiveHourlyRate)}/h` : "—"}</td>
                      <td className="px-4 py-2">
                        <span className={`rounded-full border px-2 py-0.5 t5 font-medium ${MARGIN_STYLE[row.status]}`}>{MARGIN_LABEL[row.status]}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="space-y-4">
            <div>
              <SectionTitle>Custos e meta</SectionTitle>
              <p className="t3 text-text-muted">O custo/hora da equipe interna vale para todo apontamento sem profissional. Profissionais com custo próprio entram pelo valor deles.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label>Custo/hora da equipe interna</Label>
                <Input type="number" min={0} value={rates.defaultHourlyCost} onChange={(e) => setRates({ ...rates, defaultHourlyCost: e.target.value })} placeholder="Ex.: 80" data-testid="rate-default" />
              </div>
              <div>
                <Label>Margem-alvo (%)</Label>
                <Input type="number" min={0} max={95} value={rates.targetMarginPct} onChange={(e) => setRates({ ...rates, targetMarginPct: e.target.value })} data-testid="rate-target" />
              </div>
            </div>
            {report.rates.length > 0 && (
              <div>
                <p className="mb-1 t5 font-semibold uppercase tracking-wider text-text-muted">Custo/hora por profissional</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {report.rates.map((p) => (
                    <div key={p.id} className="flex items-center gap-2 rounded-md border border-edge bg-surface-sunken px-3 py-2 t3">
                      <span className="min-w-0 flex-1 truncate">{p.name}</span>
                      <input
                        type="number"
                        min={0}
                        value={rates.professionals[p.id] ?? ""}
                        onChange={(e) => setRates({ ...rates, professionals: { ...rates.professionals, [p.id]: e.target.value } })}
                        className="w-24 rounded-md border border-edge bg-surface px-2 py-1 t3 outline-none focus:border-edge"
                        aria-label={`Custo/hora de ${p.name}`}
                        data-testid="rate-professional"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center gap-3">
              <Button onClick={save} disabled={saving} data-testid="finance-save">
                {saving ? "Salvando..." : "Salvar custos e fees"}
              </Button>
              {saved && <span className="t3 text-text">Aplicado ✓</span>}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
