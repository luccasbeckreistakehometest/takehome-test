"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Card, SectionTitle, Skeleton, Tag } from "@/components/ui";
import TierBadge, { TierProgress } from "@/components/TierBadge";
import { Icon, type IconName } from "@/components/icons";
import { PROJECT_STATUS_LABELS, type ProjectStatus } from "@/lib/marketplace-types";
import { TIER_COLORS, type TierInfo } from "@/lib/ranking";

type Insights = {
  agency: { tier: TierInfo; stats: Record<string, number | null> };
  funnel: { byStatus: Record<ProjectStatus, number>; totalProjects: number };
  deliverables: { byType: { type: string; c: number }[]; total: number };
  overdue: { id: string; title: string; deadline: string; clientName: string }[];
  clients: {
    id: string;
    name: string;
    tier: TierInfo;
    paidProjects: number;
    totalProjects: number;
    generations: number;
  }[];
  topProfessionals: {
    id: string;
    name: string;
    role: string;
    completed: number;
    avgScore: number | null;
  }[];
  activityByDay: { day: string; c: number }[];
  counts: {
    openDemands: number;
    inProduction: number;
    awaitingApproval: number;
    meetingsUpcoming: number;
    scheduledPosts: number;
  };
};

const TYPE_LABELS: Record<string, string> = {
  strategy_analysis: "Estratégia",
  market_pulse: "Radar de mercado",
  campaign_plan: "Campanhas",
  roi_projection: "ROI",
  social_calendar: "Calendário social",
  post_batch: "Posts",
  visual_identity: "Identidade visual",
  landing_page: "Landing pages",
  client_report: "Relatórios",
  product_recs: "Oportunidades",
};

export default function InsightsPage() {
  const [data, setData] = useState<Insights | null>(null);

  useEffect(() => {
    const load = () => api<Insights>("/api/insights").then(setData).catch(() => {});
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  if (!data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-48" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const kpis: { label: string; value: number; icon: IconName; href: string }[] = [
    { label: "Demandas abertas", value: data.counts.openDemands, icon: "briefcase", href: "/production" },
    { label: "Em produção", value: data.counts.inProduction, icon: "kanban", href: "/production" },
    { label: "Aguardando aprovação", value: data.counts.awaitingApproval, icon: "check", href: "/production" },
    { label: "Reuniões futuras", value: data.counts.meetingsUpcoming, icon: "calendar", href: "/agenda" },
    { label: "Posts agendados", value: data.counts.scheduledPosts, icon: "send", href: "/agenda" },
  ];

  const funnelMax = Math.max(1, ...Object.values(data.funnel.byStatus));
  const activityMax = Math.max(1, ...data.activityByDay.map((d) => d.c));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">
            <Icon name="chart" size={24} className="text-accent" />
            Insights
          </h1>
          <p className="mt-1 text-sm text-muted">
            O andamento de tudo — demandas, clientes, campanhas e produção — em um só lugar.
          </p>
        </div>
      </div>

      {/* Elo da agência */}
      <Card className="animate-fade-in">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <SectionTitle>Elo da agência</SectionTitle>
            <TierBadge info={data.agency.tier} />
            <p className="mt-1.5 text-xs text-muted">{data.agency.tier.reason}</p>
          </div>
          <div className="w-full max-w-xl flex-1">
            <TierProgress info={data.agency.tier} />
          </div>
        </div>
      </Card>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {kpis.map((kpi, i) => (
          <Link key={kpi.label} href={kpi.href} style={{ animationDelay: `${i * 40}ms` }} className="animate-fade-in">
            <Card hover className="h-full">
              <Icon name={kpi.icon} size={20} className="text-accent" />
              <p className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold">
                {kpi.value}
              </p>
              <p className="text-xs text-muted">{kpi.label}</p>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Funil de demandas */}
        <Card>
          <SectionTitle>Funil de demandas</SectionTitle>
          {data.funnel.totalProjects === 0 ? (
            <p className="text-sm text-muted">Nenhuma demanda ainda.</p>
          ) : (
            <div className="space-y-2">
              {(Object.keys(data.funnel.byStatus) as ProjectStatus[]).map((status) => {
                const value = data.funnel.byStatus[status];
                return (
                  <div key={status} className="flex items-center gap-3 text-sm">
                    <span className="w-44 shrink-0 truncate text-muted">
                      {PROJECT_STATUS_LABELS[status]}
                    </span>
                    <div className="h-5 flex-1 overflow-hidden rounded bg-surface-2">
                      <div
                        className="flex h-full items-center justify-end rounded bg-accent px-2 text-[11px] font-semibold text-accent-ink transition-all duration-700"
                        style={{ width: `${Math.max((value / funnelMax) * 100, value ? 8 : 0)}%` }}
                      >
                        {value > 0 && value}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Ritmo da semana */}
        <Card>
          <SectionTitle>Ritmo dos últimos 7 dias</SectionTitle>
          {data.activityByDay.length === 0 ? (
            <p className="text-sm text-muted">Sem atividade registrada na semana.</p>
          ) : (
            <div className="flex h-40 items-end justify-between gap-2">
              {data.activityByDay.map((day) => (
                <div key={day.day} className="flex flex-1 flex-col items-center gap-1.5">
                  <div className="flex w-full flex-1 items-end">
                    <div
                      className="w-full rounded-t bg-accent/80 transition-all duration-700 hover:bg-accent"
                      style={{ height: `${(day.c / activityMax) * 100}%` }}
                      title={`${day.c} ações`}
                    />
                  </div>
                  <span className="text-[10px] text-muted">
                    {new Date(day.day + "T12:00").toLocaleDateString("pt-BR", { weekday: "short" }).slice(0, 3)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Entregáveis por tipo */}
        <Card>
          <SectionTitle>Entregáveis gerados por tipo</SectionTitle>
          {data.deliverables.total === 0 ? (
            <p className="text-sm text-muted">Nenhum entregável gerado ainda.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {data.deliverables.byType.map((t) => (
                <span
                  key={t.type}
                  className="rounded-lg border border-edge bg-surface-2 px-3 py-2 text-sm"
                >
                  {TYPE_LABELS[t.type] ?? t.type}{" "}
                  <span className="font-semibold text-accent">{t.c}</span>
                </span>
              ))}
            </div>
          )}
        </Card>

        {/* Prazos estourados */}
        <Card>
          <SectionTitle>
            <span className="flex items-center gap-1.5">
              <Icon name="clock" size={15} /> Prazos em atraso
            </span>
          </SectionTitle>
          {data.overdue.length === 0 ? (
            <p className="text-sm text-muted">Nenhuma demanda atrasada. 🎯</p>
          ) : (
            <div className="space-y-1.5">
              {data.overdue.map((o) => (
                <Link
                  key={o.id}
                  href={`/production?project=${o.id}`}
                  className="flex items-center justify-between rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm transition-colors hover:border-red-500/60"
                >
                  <span className="truncate">
                    <span className="font-medium">{o.title}</span>
                    <span className="text-muted"> · {o.clientName}</span>
                  </span>
                  <Tag>{new Date(o.deadline + "T12:00").toLocaleDateString("pt-BR")}</Tag>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Clientes por elo */}
        <Card>
          <SectionTitle>Carteira de clientes</SectionTitle>
          {data.clients.length === 0 ? (
            <p className="text-sm text-muted">Nenhum cliente cadastrado.</p>
          ) : (
            <div className="space-y-2">
              {data.clients.map((c) => (
                <Link
                  key={c.id}
                  href={`/clients/${c.id}`}
                  className="flex items-center justify-between gap-3 rounded-md border border-edge bg-surface-2 px-3 py-2 text-sm transition-colors hover:border-accent/60"
                >
                  <span className="flex items-center gap-2">
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: TIER_COLORS[c.tier.tier] }}
                    />
                    <span className="font-medium">{c.name}</span>
                  </span>
                  <span className="text-xs text-muted">
                    {c.paidProjects} pagas · {c.generations} entregáveis
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* Top profissionais */}
        <Card>
          <SectionTitle>Profissionais em destaque</SectionTitle>
          {data.topProfessionals.length === 0 ? (
            <p className="text-sm text-muted">Nenhum profissional cadastrado.</p>
          ) : (
            <div className="space-y-2">
              {data.topProfessionals.map((p) => (
                <Link
                  key={p.id}
                  href={`/professionals/${p.id}`}
                  className="flex items-center justify-between gap-3 rounded-md border border-edge bg-surface-2 px-3 py-2 text-sm transition-colors hover:border-accent/60"
                >
                  <span className="flex items-center gap-2">
                    <Icon name="user" size={15} className="text-muted" />
                    <span className="font-medium">{p.name}</span>
                  </span>
                  <span className="text-xs text-muted">
                    {p.completed} entregas
                    {p.avgScore != null && ` · nota ${p.avgScore}`}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
