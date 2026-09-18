"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useUiLang } from "@/lib/i18n";
import { PULSE_FACES, type RiskFlag, type TrendPoint } from "@/lib/pulse-rules";
import type { ClientPulseView, PulseOverviewRow } from "@/lib/pulse-db";
import { Card, SectionTitle, Tag } from "./ui";

type Overview = { clients: PulseOverviewRow[]; atRisk: PulseOverviewRow[]; answered: number };

const REASON_LABEL: Record<RiskFlag["reason"], string> = {
  unhappy_recent: "😞 recente",
  falling: "nota caindo",
  detractor: "NPS detrator",
  silent: "sem sinal de vida",
  no_feedback: "nunca respondeu",
};

const LEVEL_STYLE: Record<string, string> = {
  risk: "border-red-500/40 bg-red-500/10 text-red-500",
  watch: "border-amber-500/40 bg-amber-500/10 text-amber-500",
  ok: "border-emerald-500/40 bg-emerald-500/10 text-emerald-500",
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
          className={`w-2 rounded-sm ${t.avg === null ? "bg-edge" : t.avg >= 2.5 ? "bg-emerald-500" : t.avg >= 1.75 ? "bg-amber-500" : "bg-red-500"}`}
          style={{ height: `${t.avg === null ? 15 : (t.avg / 3) * 100}%` }}
        />
      ))}
    </span>
  );
}

function RiskBadge({ level }: { level: string }) {
  return <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${LEVEL_STYLE[level]}`}>{LEVEL_LABEL[level]}</span>;
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
      <Card data-testid="pulse-overview" data-mode={mode}>
        <SectionTitle>Pulso dos clientes</SectionTitle>
        <p className="text-sm text-muted">
          {data.answered === 0 ? "Nenhuma resposta ainda — os clientes respondem no portal depois de cada aprovação e uma vez por mês." : "Nenhum cliente em risco. "}
        </p>
        <Link href="/insights#pulso" className="mt-2 inline-block text-xs text-accent hover:underline">
          Ver tendência por cliente →
        </Link>
      </Card>
    );
  }
  return (
    <Card data-testid="pulse-overview" data-mode={mode} id={mode === "full" ? "pulso" : undefined}>
      <div className="flex items-center justify-between">
        <SectionTitle>{mode === "home" ? "Clientes em risco" : "Pulso dos clientes"}</SectionTitle>
        {mode === "home" && (
          <Link href="/insights#pulso" className="text-xs text-accent hover:underline">
            Ver todos →
          </Link>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">Nenhum cliente cadastrado.</p>
      ) : (
        <div className="space-y-1.5">
          {rows.map((row) => (
            <Link
              key={row.id}
              href={`/clients/${row.id}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-edge bg-surface-2 px-3 py-2 text-sm transition-colors hover:border-accent/60"
              data-testid="pulse-row"
              data-level={row.risk.level}
            >
              <span className="flex items-center gap-2">
                <span className="text-lg">{row.latestScore ? PULSE_FACES[row.latestScore as 1 | 2 | 3] : "·"}</span>
                <span className="font-medium">{row.name}</span>
                {row.latestNps !== null && <Tag>NPS {row.latestNps}</Tag>}
              </span>
              <span className="flex flex-wrap items-center gap-2 text-xs text-muted">
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
    </Card>
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
    <Card data-testid="client-pulse">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionTitle>Pulso do cliente</SectionTitle>
        <RiskBadge level={view.risk.level} />
      </div>
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <span className="text-3xl" data-testid="client-pulse-latest">{view.risk.latestScore ? PULSE_FACES[view.risk.latestScore as 1 | 2 | 3] : "—"}</span>
        <div>
          <p className="text-xs text-muted">Última resposta</p>
          <p>{view.risk.latestAt ? new Date(view.risk.latestAt).toLocaleDateString(lang === "en" ? "en-US" : "pt-BR") : "ainda sem resposta"}</p>
        </div>
        <div>
          <p className="text-xs text-muted">NPS</p>
          <p>{view.risk.latestNps ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted">Últimos 6 meses</p>
          <TrendBars trend={view.trend} />
        </div>
      </div>
      {view.risk.flags.length > 0 && (
        <ul className="mt-3 space-y-0.5 text-xs">
          {view.risk.flags.map((f) => (
            <li key={f.reason} className={f.level === "risk" ? "text-red-500" : "text-amber-500"}>
              • {flagText(f)}
            </li>
          ))}
        </ul>
      )}
      {comments.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-muted">
          {comments.slice(0, 3).map((p) => (
            <li key={p.id}>
              {p.kind === "nps" ? `NPS ${p.score}` : PULSE_FACES[p.score as 1 | 2 | 3]} “{p.comment}”
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
