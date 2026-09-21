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
import TierBadge, { TierProgress } from "./TierBadge";
import OnboardingModal from "./OnboardingModal";
import { ClientPulseCard } from "./PulseOverviewCard";
import LearningsCard from "./LearningsCard";
import ActivationChecklist from "./ActivationChecklist";
import { Button, Dash, EmptyState, Spinner } from "./ui";
import { buttonClass } from "@/lib/button-class";

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
  children,
}: {
  client: Client;
  landingEnabled: boolean;
  onNavigate: (tab: string) => void;
  onRunKit: () => void;
  // cards extras (pacote, aprovação por link, cliques...) montados pelo workspace
  children?: React.ReactNode;
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
    // Tela de ferramenta (§4.4, densidade compact): trabalho à esquerda em 8
    // colunas, contexto e ações num trilho de 4. Antes eram nove painéis
    // idênticos empilhados a 24px, quatro deles com um número laranja gigante.
    <div>
      <OnboardingModal role="client" />
      {client.selfServe && <ActivationChecklist expect="brand" />}

      {isNew && !client.selfServe && (
        <section className="mt-8 border-b border-edge pb-4">
          <p className="t6 text-text-muted">Comece por aqui</p>
          <ol className="mt-2">
            {[
              {
                label: "Complete o briefing",
                hint: "ele alimenta toda a IA",
                run: () => onNavigate("briefing"),
              },
              {
                label: "Gere a Estratégia & Deep Dive",
                hint: "pesquisa real de mercado",
                run: () => onNavigate("strategy_analysis"),
              },
              {
                label: "Rode o Kit completo",
                hint: "campanha, ROI, identidade e social de uma vez",
                run: onRunKit,
              },
            ].map((step, i) => (
              <li key={step.label} className="border-b border-rule last:border-b-0">
                <button
                  type="button"
                  onClick={step.run}
                  className="flex w-full items-baseline gap-3 py-2 text-left"
                >
                  <span className="idx t5 w-6 shrink-0">{String(i + 1).padStart(2, "0")}</span>
                  <span className="t3 block text-left font-medium underline-offset-4 hover:underline">{step.label}</span>
                  <span className="t5 text-text-muted">{step.hint}</span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="ed-grid mt-8">
        <div className="c8">
          {/* Entregáveis: tabela, não vinte botões-caixa */}
          <section>
            <table className="w-full table-fixed border-collapse text-left">
              <colgroup>
                <col />
                <col className="w-24" />
                <col className="w-32" />
              </colgroup>
              <thead>
                <tr className="border-b border-edge">
                  <th className="t6 pb-2 text-text-muted">Entregáveis</th>
                  <th className="t6 pb-2 text-right text-text-muted">Vezes</th>
                  <th className="t6 pb-2 text-right text-text-muted">Último</th>
                </tr>
              </thead>
              <tbody>
                {deliverableTypes.map((type) => {
                  const info = data.byType[type];
                  return (
                    <tr key={type} className="border-b border-rule">
                      <td className="py-2">
                        <button
                          type="button"
                          onClick={() => onNavigate(type)}
                          className="t3 block text-left font-medium underline-offset-4 hover:underline"
                        >
                          {GENERATION_LABELS[type]}
                        </button>
                      </td>
                      <td className="n3 py-2 text-right">{info?.count ? info.count : <Dash />}</td>
                      <td className="t5 tnum py-2 text-right text-text-muted">
                        {info?.latestAt ? new Date(info.latestAt).toLocaleDateString("pt-BR") : <Dash />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <section className="mt-10">
            <h2 className="t6 border-b border-edge pb-2 text-text-muted">Demandas recentes</h2>
            {data.projects.recent.length === 0 ? (
              <EmptyState
                icon="kanban"
                title="Nenhuma demanda ainda"
                condition="Crie a primeira a partir do plano, na aba Demandas."
              />
            ) : (
              <ul>
                {data.projects.recent.map((project) => (
                  <li key={project.id} className="border-b border-rule">
                    <button
                      type="button"
                      onClick={() => onNavigate("projects")}
                      className="flex w-full items-baseline justify-between gap-3 py-2 text-left"
                    >
                      <span className="t3 min-w-0 truncate font-medium">{project.title}</span>
                      <span className="t5 shrink-0 text-text-muted">
                        {PROJECT_STATUS_LABELS[project.status]}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="mt-10">{children}</div>

          <section className="mt-10">
            <h2 className="t6 border-b border-edge pb-2 text-text-muted">Próximas reuniões</h2>
            {data.meetings.length === 0 ? (
              <EmptyState
                icon="calendar"
                title="Nenhuma reunião futura"
                condition="As reuniões marcadas para esta conta aparecem aqui."
                action={
                  <Link href="/agenda" className={buttonClass("secondary")}>
                    Abrir agenda
                  </Link>
                }
              />
            ) : (
              <ul>
                {data.meetings.map((meeting) => (
                  <li
                    key={meeting.id}
                    className="flex items-baseline justify-between gap-3 border-b border-rule py-2"
                  >
                    <span className="t3 min-w-0 truncate font-medium">{meeting.title}</span>
                    <span className="t5 tnum shrink-0 text-text-muted">
                      {new Date(meeting.scheduledAt).toLocaleString("pt-BR")}
                    </span>
                    <a
                      href={googleCalendarUrl(meeting)}
                      target="_blank"
                      rel="noreferrer"
                      className="t5 shrink-0 font-medium underline-offset-4 hover:underline"
                    >
                      Google Agenda
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* ---- Trilho: números, ações, pulso ------------------------------ */}
        <aside className="c4">
          <section>
            <h2 className="t6 border-b border-edge pb-2 text-text-muted">Números da conta</h2>
            <dl>
              {[
                { label: "Entregáveis gerados", value: data.stats.generations, tab: "strategy_analysis" },
                { label: "Demandas ativas", value: data.projects.active, tab: "projects" },
                { label: "Aguardando revisão", value: data.projects.awaitingReview, tab: "projects" },
              ].map((stat) => (
                <div key={stat.label} className="border-b border-rule">
                  <button
                    type="button"
                    onClick={() => onNavigate(stat.tab)}
                    className="flex w-full items-baseline justify-between gap-3 py-2 text-left"
                  >
                    <dt className="t4 text-text-muted">{stat.label}</dt>
                    <dd className={`n3 ${stat.value === 0 ? "text-text-muted" : ""}`}>{stat.value}</dd>
                  </button>
                </div>
              ))}
            </dl>
            <div className="mt-3 flex items-center gap-2">
              <TierBadge info={data.tier} />
            </div>
            <div className="mt-2">
              <TierProgress info={data.tier} compact />
            </div>
          </section>

          <section className="mt-8">
            <h2 className="t6 border-b border-edge pb-2 text-text-muted">Ações</h2>
            <div className="mt-3 flex flex-col items-start gap-2">
              <Button variant="secondary" onClick={onRunKit} className="w-full">
                Gerar kit completo
              </Button>
              {[
                { label: "Nova demanda", run: () => onNavigate("projects") },
                { label: "Rodar radar de mercado", run: () => onNavigate("market_pulse") },
                { label: "Gerar relatório", run: () => onNavigate("client_report") },
              ].map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={action.run}
                  className="t4 w-full border-b border-rule py-1.5 text-left underline-offset-4 hover:underline"
                >
                  {action.label}
                </button>
              ))}
              {[
                { label: "Ideias para esta conta", href: `/ideas?audience=client&targetId=${client.id}` },
                { label: "Ver como cliente", href: `/portal/client/${client.id}` },
                { label: "Planos & coins", href: "/plans" },
              ].map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="t4 w-full border-b border-rule py-1.5 underline-offset-4 hover:underline"
                >
                  {action.label}
                </Link>
              ))}
            </div>
          </section>

          {!client.selfServe && (
            <div className="mt-8">
              <ClientPulseCard clientId={client.id} />
            </div>
          )}

          <div className="mt-8">
            <LearningsCard clientId={client.id} />
          </div>

          {data.pulseSummary && (
            <section className="mt-8">
              <h2 className="t6 border-b border-edge pb-2 text-text-muted">Último pulso do mercado</h2>
              <p className="t4 measure-prose mt-2 text-text-muted">{data.pulseSummary}</p>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
