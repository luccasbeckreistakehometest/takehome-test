"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Client, GenerationType } from "@/lib/types";
import { GENERATION_LABELS } from "@/lib/types";
import { PROJECT_STATUS_LABELS, type Project } from "@/lib/marketplace-types";
import type { Meeting } from "@/lib/marketplace-db";
import type { TierInfo } from "@/lib/ranking";
import { googleCalendarUrl } from "@/lib/gcal";
import TierBadge from "./TierBadge";
import { Button, Card, SectionTitle, Spinner, Tag } from "./ui";

type DashboardData = {
  client: Client;
  tier: TierInfo;
  stats: { paidProjects: number; totalProjects: number; generations: number };
  byType: Record<
    GenerationType,
    { count: number; latestAt: string | null; latestTitle: string | null }
  >;
  projects: {
    total: number;
    open: number;
    active: number;
    awaitingReview: number;
    paid: number;
    recent: Project[];
  };
  meetings: Meeting[];
  pulseSummary: string | null;
};

export default function ClientDashboard({
  client,
  landingEnabled,
  onNavigate,
  onRunKit,
}: {
  client: Client;
  landingEnabled: boolean;
  onNavigate: (tab: string) => void;
  onRunKit: () => void;
}) {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    api<DashboardData>(`/api/clients/${client.id}/dashboard`).then(setData);
  }, [client.id]);

  if (!data) return <Spinner label="Carregando dashboard..." />;

  const isNew = data.stats.generations === 0;

  const deliverableTypes = (
    Object.keys(GENERATION_LABELS) as GenerationType[]
  ).filter((type) => landingEnabled || type !== "landing_page");

  return (
    <div className="space-y-6">
      {isNew && (
        <Card className="border-accent/40 bg-accent/5">
          <SectionTitle>👋 Comece por aqui</SectionTitle>
          <ol className="mt-1 list-decimal space-y-1.5 pl-5 text-sm text-muted">
            <li>
              Complete o <button className="text-accent hover:underline" onClick={() => onNavigate("briefing")}>briefing</button> — ele alimenta toda a IA.
            </li>
            <li>
              Gere a <button className="text-accent hover:underline" onClick={() => onNavigate("strategy_analysis")}>Estratégia & Deep Dive</button> (pesquisa real de mercado).
            </li>
            <li>
              Rode o <button className="text-accent hover:underline" onClick={onRunKit}>✦ Kit completo</button> — campanha, ROI, identidade e social de uma vez.
            </li>
          </ol>
        </Card>
      )}
      {/* Números principais */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-xs uppercase tracking-wide text-muted">Elo da conta</p>
          <div className="mt-1.5">
            <TierBadge info={data.tier} />
          </div>
          <p className="mt-1.5 text-xs text-muted">{data.tier.nextStep}</p>
        </Card>
        {[
          { label: "Entregáveis gerados", value: data.stats.generations, tab: "strategy_analysis" },
          { label: "Demandas ativas", value: data.projects.active, tab: "projects" },
          { label: "Aguardando revisão", value: data.projects.awaitingReview, tab: "projects" },
        ].map((stat) => (
          <button key={stat.label} onClick={() => onNavigate(stat.tab)} className="text-left">
            <Card className="h-full transition-colors hover:border-accent/60">
              <p className="text-xs uppercase tracking-wide text-muted">{stat.label}</p>
              <p className="mt-1 font-[family-name:var(--font-display)] text-3xl font-bold text-accent">
                {stat.value}
              </p>
            </Card>
          </button>
        ))}
      </div>

      {/* Ações rápidas */}
      <Card>
        <SectionTitle>Ações rápidas</SectionTitle>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onRunKit}>✦ Gerar kit completo</Button>
          <Button variant="ghost" onClick={() => onNavigate("projects")}>
            + Nova demanda
          </Button>
          <Button variant="ghost" onClick={() => onNavigate("market_pulse")}>
            📡 Rodar radar de mercado
          </Button>
          <Button variant="ghost" onClick={() => onNavigate("client_report")}>
            📄 Gerar relatório
          </Button>
          <Link href={`/ideas?audience=client&targetId=${client.id}`}>
            <Button variant="ghost">💡 Ideias para esta conta</Button>
          </Link>
          <Link href={`/portal/client/${client.id}`}>
            <Button variant="ghost">👤 Ver como cliente</Button>
          </Link>
        </div>
      </Card>

      {data.pulseSummary && (
        <Card>
          <SectionTitle>Último pulso do mercado</SectionTitle>
          <p className="text-sm text-muted">{data.pulseSummary}</p>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Entregáveis por tipo */}
        <Card>
          <SectionTitle>Entregáveis</SectionTitle>
          <div className="space-y-1.5">
            {deliverableTypes.map((type) => {
              const info = data.byType[type];
              return (
                <button
                  key={type}
                  onClick={() => onNavigate(type)}
                  className="flex w-full items-center justify-between rounded-md border border-edge bg-surface-2 px-3 py-2 text-left text-sm transition-colors hover:border-accent/60"
                >
                  <span className="font-medium">{GENERATION_LABELS[type]}</span>
                  <span className="text-xs text-muted">
                    {info?.count
                      ? `${info.count}x · último em ${new Date(info.latestAt!).toLocaleDateString("pt-BR")}`
                      : "gerar →"}
                  </span>
                </button>
              );
            })}
          </div>
        </Card>

        <div className="space-y-6">
          {/* Demandas recentes */}
          <Card>
            <SectionTitle>Demandas recentes</SectionTitle>
            {data.projects.recent.length === 0 ? (
              <p className="text-sm text-muted">
                Nenhuma demanda ainda — crie a partir do plano na aba Demandas.
              </p>
            ) : (
              <div className="space-y-1.5">
                {data.projects.recent.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => onNavigate("projects")}
                    className="flex w-full items-center justify-between rounded-md border border-edge bg-surface-2 px-3 py-2 text-left text-sm transition-colors hover:border-accent/60"
                  >
                    <span className="font-medium">{project.title}</span>
                    <Tag>{PROJECT_STATUS_LABELS[project.status]}</Tag>
                  </button>
                ))}
              </div>
            )}
          </Card>

          {/* Próximas reuniões */}
          <Card>
            <div className="flex items-center justify-between">
              <SectionTitle>Próximas reuniões</SectionTitle>
              <Link href="/agenda" className="text-xs text-accent hover:underline">
                Agenda completa →
              </Link>
            </div>
            {data.meetings.length === 0 ? (
              <p className="text-sm text-muted">Nenhuma reunião futura para esta conta.</p>
            ) : (
              <div className="space-y-1.5">
                {data.meetings.map((meeting) => (
                  <div
                    key={meeting.id}
                    className="flex items-center justify-between rounded-md border border-edge bg-surface-2 px-3 py-2 text-sm"
                  >
                    <span>
                      <span className="font-medium">{meeting.title}</span>{" "}
                      <span className="text-xs text-muted">
                        · {new Date(meeting.scheduledAt).toLocaleString("pt-BR")}
                      </span>
                    </span>
                    <a
                      href={googleCalendarUrl(meeting)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-muted hover:text-accent"
                    >
                      📅
                    </a>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
