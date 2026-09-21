"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { fmtCurrency, useUiLang } from "@/lib/i18n";
import { currentMonth, shiftMonth } from "@/lib/report-aggregate";
import { entryMinutes, formatHours, type ClientMargin, type FinanceSettings } from "@/lib/finance-rules";
import type { TimeEntry } from "@/lib/finance-db";
import type { Client } from "@/lib/types";
import { Button, Card, ErrorBox, Input, Label, SectionTitle, Select, Spinner, Tag, Textarea } from "./ui";
import { Icon } from "./icons";

type Payload = {
  month: string;
  fee: number;
  settings: FinanceSettings;
  margin: ClientMargin;
  entries: TimeEntry[];
  running: TimeEntry | null;
  projects: { id: string; title: string; status: string; deliverables: { id: string; title: string }[] }[];
  professionals: { id: string; name: string; role: string; hourlyCost: number }[];
};

export const MARGIN_LABEL: Record<ClientMargin["status"], string> = {
  ok: "Saudável",
  thin: "Margem apertada",
  loss: "Dá prejuízo",
  no_fee: "Sem fee cadastrado",
  idle: "Sem horas no mês",
};
export const MARGIN_STYLE: Record<ClientMargin["status"], string> = {
  ok: "border-positive/40 bg-positive-wash text-positive",
  thin: "border-caution/40 bg-caution-wash text-caution",
  loss: "border-negative/40 bg-negative-wash text-negative",
  no_fee: "border-caution/40 bg-caution-wash text-caution",
  idle: "border-edge text-text-muted",
};

function monthLabel(month: string, lang: "pt" | "en"): string {
  const d = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1));
  return d.toLocaleDateString(lang === "en" ? "en-US" : "pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
}

// Aba "Horas" do cliente: cronômetro (iniciar/parar por demanda ou entrega),
// lançamento manual, fee mensal e a margem do mês — o que a conta rende
// contra o que ela custa em horas.
export default function TimeTab({ client }: { client: Client }) {
  const lang = useUiLang();
  const [month, setMonth] = useState(() => currentMonth());
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  const [timerForm, setTimerForm] = useState({ projectId: "", deliverableId: "", professionalId: "", note: "" });
  const [manual, setManual] = useState({ hours: "1", minutes: "0", date: new Date().toISOString().slice(0, 10), projectId: "", professionalId: "", note: "" });
  const [fee, setFee] = useState("");
  const [feeSaved, setFeeSaved] = useState(false);

  const load = useCallback(() => {
    api<Payload>(`/api/clients/${client.id}/finance?month=${month}`)
      .then((p) => {
        setData(p);
        setFee((prev) => (prev === "" ? String(p.fee || "") : prev));
      })
      .catch((e) => setError(e.message));
  }, [client.id, month]);

  useEffect(() => {
    load();
  }, [load]);

  // relógio do cronômetro
  useEffect(() => {
    if (!data?.running) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [data?.running]);

  async function start() {
    setError("");
    try {
      await api("/api/time-entries", {
        method: "POST",
        body: JSON.stringify({
          action: "start",
          clientId: client.id,
          projectId: timerForm.projectId || null,
          deliverableId: timerForm.deliverableId || null,
          professionalId: timerForm.professionalId || null,
          note: timerForm.note,
        }),
      });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao iniciar");
    }
  }

  async function stop(id: string) {
    setError("");
    try {
      await api(`/api/time-entries/${id}`, { method: "PATCH", body: JSON.stringify({ action: "stop" }) });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao parar");
    }
  }

  async function addManual() {
    const minutes = Number(manual.hours) * 60 + Number(manual.minutes);
    if (!minutes) return;
    setError("");
    try {
      await api("/api/time-entries", {
        method: "POST",
        body: JSON.stringify({
          action: "manual",
          clientId: client.id,
          projectId: manual.projectId || null,
          professionalId: manual.professionalId || null,
          note: manual.note,
          minutes,
          startedAt: manual.date,
        }),
      });
      setManual((m) => ({ ...m, note: "" }));
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao lançar");
    }
  }

  async function remove(id: string) {
    await api(`/api/time-entries/${id}`, { method: "DELETE" });
    load();
  }

  async function saveFee() {
    setError("");
    try {
      await api(`/api/clients/${client.id}/finance`, { method: "PUT", body: JSON.stringify({ monthlyFee: Number(fee) || 0 }) });
      setFeeSaved(true);
      setTimeout(() => setFeeSaved(false), 2000);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar o fee");
    }
  }

  if (!data) {
    return (
      <div className="grid place-items-center py-16">
        <Spinner label="Carregando as horas..." />
      </div>
    );
  }
  const currency = data.settings.currency;
  const money = (v: number) => fmtCurrency(v, currency, lang);
  const running = data.running && data.running.clientId === client.id ? data.running : null;
  const runningElsewhere = data.running && data.running.clientId !== client.id ? data.running : null;
  const selectedProject = data.projects.find((p) => p.id === timerForm.projectId);
  void tick;

  return (
    <div className="space-y-6" data-testid="time-tab">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="d4">Horas e margem</h2>
          <p className="t3 measure-lede mt-2 text-text-muted">O que esta conta paga por mês contra o que ela custa em horas da equipe.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setMonth((m) => shiftMonth(m, -1))} className="grid size-8 place-items-center rounded-md border border-edge hover:border-edge" aria-label="Mês anterior">‹</button>
          <span className="min-w-36 text-center t3 font-medium capitalize" data-testid="time-month">{monthLabel(month, lang)}</span>
          <button onClick={() => setMonth((m) => shiftMonth(m, 1))} className="grid size-8 place-items-center rounded-md border border-edge hover:border-edge" aria-label="Próximo mês">›</button>
        </div>
      </div>

      {error && <ErrorBox message={error} />}

      <div className="grid gap-x-8 gap-y-5 border-y border-edge py-4 sm:grid-cols-3 lg:grid-cols-5" data-testid="client-margin" data-status={data.margin.status}>
        <Card className="lg:col-span-1">
          <p className="t6 text-text-muted">Fee mensal</p>
          <div className="mt-1 flex items-center gap-1">
            <Input type="number" min={0} value={fee} onChange={(e) => setFee(e.target.value)} placeholder="0" data-testid="client-fee" />
            <Button variant="ghost" className="!px-2.5 !py-1.5 t5" onClick={saveFee} data-testid="client-fee-save">
              {feeSaved ? "✓" : "Salvar"}
            </Button>
          </div>
        </Card>
        <Card>
          <p className="t6 text-text-muted">Horas no mês</p>
          <p className="d3 mt-1" data-testid="client-hours">{formatHours(data.margin.minutes)}</p>
        </Card>
        <Card>
          <p className="t6 text-text-muted">Custo das horas</p>
          <p className="d3 mt-1" data-testid="client-cost">{money(data.margin.cost)}</p>
          <p className="t5 text-text-muted">{data.settings.defaultHourlyCost ? `${money(data.settings.defaultHourlyCost)}/h padrão` : "custo/hora não definido"}</p>
        </Card>
        <Card>
          <p className="t6 text-text-muted">Margem</p>
          <p className={`n2 mt-1 ${data.margin.margin < 0 ? "text-negative" : ""}`} data-testid="client-margin-value">{money(data.margin.margin)}</p>
          {data.margin.marginPct !== null && <p className="t5 text-text-muted">{data.margin.marginPct}%</p>}
        </Card>
        <Card>
          <p className="t6 text-text-muted">Situação</p>
          <span className={`mt-1 inline-block rounded-xs border px-2 py-0.5 t5 font-medium ${MARGIN_STYLE[data.margin.status]}`}>{MARGIN_LABEL[data.margin.status]}</span>
          {data.margin.effectiveHourlyRate !== null && <p className="mt-1 t5 text-text-muted">{money(data.margin.effectiveHourlyRate)}/h efetivo</p>}
          <Link href="/finance" className="mt-1 block t5 text-text hover:underline">Ver todos os clientes</Link>
        </Card>
      </div>

      <Card className="space-y-3">
        <SectionTitle>Cronômetro</SectionTitle>
        {running ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-edge bg-surface-sunken p-3" data-testid="timer-running">
            <div>
              <p className="d3 tabular-nums" data-testid="timer-clock">{formatHours(entryMinutes(running))}</p>
              <p className="t5 text-text-muted">
                {running.note || "sem descrição"}
                {running.projectId && ` · ${data.projects.find((p) => p.id === running.projectId)?.title ?? ""}`}
              </p>
            </div>
            <Button onClick={() => stop(running.id)} data-testid="timer-stop">
              <Icon name="check" size={14} /> Parar
            </Button>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
            <div className="sm:col-span-3">
              <Input value={timerForm.note} onChange={(e) => setTimerForm({ ...timerForm, note: e.target.value })} placeholder="No que você vai trabalhar? (ex.: posts de outubro)" data-testid="timer-note" />
            </div>
            <Select value={timerForm.projectId} onChange={(e) => setTimerForm({ ...timerForm, projectId: e.target.value, deliverableId: "" })} data-testid="timer-project">
              <option value="">Sem demanda</option>
              {data.projects.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </Select>
            <Select value={timerForm.deliverableId} onChange={(e) => setTimerForm({ ...timerForm, deliverableId: e.target.value })} disabled={!selectedProject?.deliverables.length}>
              <option value="">Sem entrega</option>
              {selectedProject?.deliverables.map((d) => (
                <option key={d.id} value={d.id}>{d.title}</option>
              ))}
            </Select>
            <Select value={timerForm.professionalId} onChange={(e) => setTimerForm({ ...timerForm, professionalId: e.target.value })}>
              <option value="">Equipe interna</option>
              {data.professionals.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
            <Button onClick={start} data-testid="timer-start">
              <Icon name="clock" size={14} /> Iniciar
            </Button>
          </div>
        )}
        {runningElsewhere && (
          <p className="t5 text-caution">Você tem um cronômetro rodando em outro cliente — iniciar aqui fecha o outro.</p>
        )}
      </Card>

      <Card className="space-y-3">
        <SectionTitle>Lançar horas à mão</SectionTitle>
        <div className="grid gap-2 sm:grid-cols-6">
          <div>
            <Label>Horas</Label>
            <Input type="number" min={0} max={24} value={manual.hours} onChange={(e) => setManual({ ...manual, hours: e.target.value })} data-testid="manual-hours" />
          </div>
          <div>
            <Label>Minutos</Label>
            <Input type="number" min={0} max={59} value={manual.minutes} onChange={(e) => setManual({ ...manual, minutes: e.target.value })} data-testid="manual-minutes" />
          </div>
          <div>
            <Label>Dia</Label>
            <Input type="date" value={manual.date} onChange={(e) => setManual({ ...manual, date: e.target.value })} data-testid="manual-date" />
          </div>
          <div>
            <Label>Demanda</Label>
            <Select value={manual.projectId} onChange={(e) => setManual({ ...manual, projectId: e.target.value })}>
              <option value="">—</option>
              {data.projects.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Quem</Label>
            <Select value={manual.professionalId} onChange={(e) => setManual({ ...manual, professionalId: e.target.value })} data-testid="manual-professional">
              <option value="">Equipe interna</option>
              {data.professionals.map((p) => (
                <option key={p.id} value={p.id}>{p.name}{p.hourlyCost ? ` · ${money(p.hourlyCost)}/h` : ""}</option>
              ))}
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={addManual} className="w-full" data-testid="manual-save">
              <Icon name="plus" size={14} /> Lançar
            </Button>
          </div>
          <div className="sm:col-span-6">
            <Textarea value={manual.note} onChange={(e) => setManual({ ...manual, note: e.target.value })} placeholder="O que foi feito (opcional)" data-testid="manual-note" />
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle>Apontamentos do mês</SectionTitle>
        {data.entries.length === 0 ? (
          <p className="t3 text-text-muted">Nenhuma hora apontada neste mês.</p>
        ) : (
          <div className="space-y-1.5">
            {data.entries.map((entry) => (
              <div key={entry.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-edge bg-surface-sunken px-3 py-2 t3" data-testid="time-entry" data-running={entry.endedAt ? "no" : "yes"}>
                <div className="min-w-0">
                  <p className="font-medium">
                    {entry.note || "sem descrição"}
                    {entry.projectId && <span className="t5 text-text-muted"> · {data.projects.find((p) => p.id === entry.projectId)?.title ?? "demanda"}</span>}
                  </p>
                  <p className="t5 text-text-muted">
                    {new Date(entry.startedAt).toLocaleString(lang === "en" ? "en-US" : "pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} · {entry.professionalId ? data.professionals.find((p) => p.id === entry.professionalId)?.name ?? "profissional" : entry.userName}
                    {entry.manual && " · manual"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Tag>{entry.endedAt ? formatHours(entry.minutes) : "rodando"}</Tag>
                  {entry.endedAt ? (
                    <button onClick={() => remove(entry.id)} className="t5 text-text-muted hover:text-negative" aria-label="Excluir apontamento">
                      <Icon name="trash" size={14} />
                    </button>
                  ) : (
                    <button onClick={() => stop(entry.id)} className="t5 text-text hover:underline">Parar</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
