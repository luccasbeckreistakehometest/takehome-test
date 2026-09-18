"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useUiLang } from "@/lib/i18n";
import { PULSE_FACES, type RiskFlag, type TrendPoint } from "@/lib/pulse-rules";
import type { ClientPulseView, PulseOverviewRow } from "@/lib/pulse-db";
import { EM_DASH } from "@/lib/type";

type Overview = { clients: PulseOverviewRow[]; atRisk: PulseOverviewRow[]; answered: number };

const REASON_LABEL: Record<RiskFlag["reason"], string> = {
  unhappy_recent: "😞 recente",
  falling: "nota caindo",
  detractor: "NPS detrator",
  silent: "sem sinal de vida",
  no_feedback: "nunca respondeu",
};

// Cor semântica de ESTADO (§5.3), medida nos dois temas — nada de vermelho e
// âmbar do Tailwind, que não passam no escuro.
const LEVEL_STYLE: Record<string, string> = {
  risk: "border-negative/50 bg-negative-wash text-negative",
  watch: "border-caution/50 bg-caution-wash text-caution",
  ok: "border-positive/50 bg-positive-wash text-positive",
};
const LEVEL_LABEL: Record<string, string> = { risk: "Em risco", watch: "Atenção", ok: "Saudável" };

export function flagText(flag: RiskFlag): string {
  const base = REASON_LABEL[flag.reason];
  if (flag.reason === "silent") return `${base} há ${flag.detail} dias`;
  if (flag.reason === "falling") return `${base} (${flag.detail})`;
  if (flag.reason === "detractor") return `${base} (${flag.detail})`;
  return base;
}

// Barrinhas dos últimos 6 meses (média 1-3 por mês).
export function TrendBars({ trend }: { trend: TrendPoint[] }) {
  return (
    <span className="inline-flex h-6 items-end gap-0.5" title={trend.map((t) => `${t.month}: ${t.avg ?? "—"}`).join(" · ")} data-testid="pulse-trend">
      {trend.map((t) => (
        <span
          key={t.month}
          className={`w-2 rounded-xs ${t.avg === null ? "bg-rule" : t.avg >= 2.5 ? "bg-positive" : t.avg >= 1.75 ? "bg-caution" : "bg-negative"}`}
          style={{ height: `${t.avg === null ? 15 : (t.avg / 3) * 100}%` }}
        />
      ))}
    </span>
  );
}

function RiskBadge({ level }: { level: string }) {
  return (
    <span className={`t6 rounded-xs border px-2 py-0.5 ${LEVEL_STYLE[level]}`}>{LEVEL_LABEL[level]}</span>
  );
}

// Visão da agência. mode="home" = só quem está em risco (Hoje); "full" = todos
// os clientes com tendência (Insights).
export default function PulseOverviewCard({ mode }: { mode: "home" | "full" }) {
  const [data, setData] = useState<Overview | null>(null);
  useEffect(() => {
    api<Overview>("/api/pulse/overview").then((d) => setData((prev) => prev ?? d)).catch(() => {});
  }, []);
  if (!data) return null;
  const rows = mode === "home" ? data.atRisk : data.clients;
  if (mode === "home" && rows.length === 0) {
    return (
      <section data-testid="pulse-overview" data-mode={mode}>
        <h2 className="t6 border-b border-edge pb-2 text-text-muted">Pulso dos clientes</h2>
        <p className="t4 measure-prose mt-2 text-text-muted">
          {data.answered === 0
            ? "Nenhuma resposta ainda — os clientes respondem no portal depois de cada aprovação e uma vez por mês."
            : "Nenhum cliente em risco."}
        </p>
        <Link href="/insights#pulso" className="t5 mt-2 inline-block font-medium underline-offset-4 hover:underline">
          Ver tendência por cliente
        </Link>
      </section>
    );
  }
  return (
    <section data-testid="pulse-overview" data-mode={mode} id={mode === "full" ? "pulso" : undefined}>
      <div className="flex items-baseline justify-between border-b border-edge pb-2">
        <h2 className="t6 text-text-muted">{mode === "home" ? "Clientes em risco" : "Pulso dos clientes"}</h2>
        {mode === "home" && (
          <Link href="/insights#pulso" className="t5 font-medium underline-offset-4 hover:underline">
            Ver todos
          </Link>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="t4 mt-2 text-text-muted">Nenhum cliente cadastrado.</p>
      ) : (
        <div>
          {rows.map((row) => (
            <Link
              key={row.id}
              href={`/clients/${row.id}`}
              className="flex flex-wrap items-baseline justify-between gap-2 border-b border-rule py-2 transition-colors duration-[var(--dur-1)] hover:bg-surface-sunken"
              data-testid="pulse-row"
              data-level={row.risk.level}
            >
              <span className="flex items-center gap-2">
                <span className="t2">{row.latestScore ? PULSE_FACES[row.latestScore as 1 | 2 | 3] : EM_DASH}</span>
                <span className="t3 font-medium">{row.name}</span>
                {row.latestNps !== null && <span className="t5 tnum text-text-muted">NPS {row.latestNps}</span>}
              </span>
              <span className="t5 flex flex-wrap items-center gap-2 text-text-muted">
                {row.risk.flags.map((f) => (
                  <span key={f.reason}>{flagText(f)}</span>
                ))}
                <TrendBars trend={row.trend} />
                <RiskBadge level={row.risk.level} />
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

// Card do cliente (Dashboard do workspace): última nota, tendência, risco e
// os comentários mais recentes.
export function ClientPulseCard({ clientId }: { clientId: string }) {
  const lang = useUiLang();
  const [view, setView] = useState<ClientPulseView | null>(null);
  useEffect(() => {
    api<ClientPulseView>(`/api/clients/${clientId}/pulse`).then((v) => setView((prev) => prev ?? v)).catch(() => {});
  }, [clientId]);
  if (!view) return null;
  const comments = view.recent.filter((p) => p.comment.trim());
  return (
    <section data-testid="client-pulse">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-edge pb-2">
        <h2 className="t6 text-text-muted">Pulso do cliente</h2>
        <RiskBadge level={view.risk.level} />
      </div>
      <div className="mt-3 flex flex-wrap items-baseline gap-5">
        <span className="n2" data-testid="client-pulse-latest">
          {view.risk.latestScore ? PULSE_FACES[view.risk.latestScore as 1 | 2 | 3] : EM_DASH}
        </span>
        <div>
          <p className="t5 text-text-muted">Última resposta</p>
          <p className="t4 tnum">
            {view.risk.latestAt
              ? new Date(view.risk.latestAt).toLocaleDateString(lang === "en" ? "en-US" : "pt-BR")
              : "ainda sem resposta"}
          </p>
        </div>
        <div>
          <p className="t5 text-text-muted">NPS</p>
          <p className="t4 tnum">{view.risk.latestNps ?? EM_DASH}</p>
        </div>
        <div>
          <p className="t5 text-text-muted">Últimos 6 meses</p>
          <TrendBars trend={view.trend} />
        </div>
      </div>
      {view.risk.flags.length > 0 && (
        <ul className="t5 mt-3">
          {view.risk.flags.map((f) => (
            <li
              key={f.reason}
              className={`border-b border-rule py-1 ${f.level === "risk" ? "text-negative" : "text-caution"}`}
            >
              {flagText(f)}
            </li>
          ))}
        </ul>
      )}
      {comments.length > 0 && (
        <ul className="t5 mt-3 text-text-muted">
          {comments.slice(0, 3).map((p) => (
            <li key={p.id} className="border-b border-rule py-1">
              {p.kind === "nps" ? `NPS ${p.score}` : PULSE_FACES[p.score as 1 | 2 | 3]} “{p.comment}”
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
