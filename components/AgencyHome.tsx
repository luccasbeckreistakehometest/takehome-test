"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Client } from "@/lib/types";
import type { TierInfo } from "@/lib/ranking";
import TierBadge, { TierProgress } from "@/components/TierBadge";
import OnboardingModal from "@/components/OnboardingModal";
import DifferentiatorsStrip from "@/components/DifferentiatorsStrip";
import ActivationChecklist from "@/components/ActivationChecklist";
import PulseOverviewCard from "@/components/PulseOverviewCard";
import { EmptyState, Spinner } from "@/components/ui";
import { buttonClass } from "@/lib/button-class";
import { EM_DASH } from "@/lib/type";
import { fmtMoney } from "@/lib/i18n";
import { openAfter } from "@/lib/open-later";

// Quantos clientes a Hoje mostra antes de mandar para o catálogo.
const HOME_CLIENTS = 8;

type Overview = {
  pendingApplications: {
    id: string;
    projectId: string;
    projectTitle: string;
    clientId: string;
    professionalName: string;
  }[];
  inReview: { id: string; clientId: string; title: string; clientName: string }[];
  awaitingClient: { id: string; clientId: string; title: string; clientName: string }[];
  unansweredClientMessages: { clientId: string; clientName: string; count: number }[];
  duePosts: { id: string; title: string; clientName: string; scheduledFor: string }[];
  meetingsToday: { id: string; title: string; scheduledAt: string; clientName: string | null }[];
  clients: (Client & { tier: TierInfo })[];
  agency: { tier: TierInfo };
  staleApprovals: { id: string; clientId: string; clientName: string; createdAt: string; pending: number }[];
  extras: { total: number; count: number; pending: number };
  receivables: {
    today: string;
    dueSoon: { id: string; clientId: string; clientName: string; total: number; dueDate: string; status: string }[];
    overdue: { id: string; clientId: string; clientName: string; total: number; dueDate: string; status: string }[];
    drafts: number;
    claimed: number;
  };
};

// Home operacional da agência: o que precisa da sua ação agora
export default function AgencyHome() {
  const [data, setData] = useState<Overview | null>(null);

  useEffect(() => {
    const load = () => api<Overview>("/api/agency/overview").then(setData).catch(() => {});
    load();
    const interval = setInterval(load, 20000);
    return () => clearInterval(interval);
  }, []);

  if (!data) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner label="Carregando sua operação..." />
      </div>
    );
  }

  const actionCount =
    data.pendingApplications.length +
    data.inReview.length +
    data.awaitingClient.length +
    data.unansweredClientMessages.length +
    data.duePosts.length +
    data.staleApprovals.length +
    data.receivables.overdue.length +
    data.receivables.claimed;

  const daysLate = (dueDate: string) =>
    Math.max(
      1,
      Math.round(
        (Date.parse(`${data.receivables.today}T00:00:00Z`) - Date.parse(`${dueDate}T00:00:00Z`)) /
          86_400_000,
      ),
    );

  return (
    // Fila de trabalho, não onze painéis iguais (§12). Tudo que pede ação vira
    // UMA lista tipada com régua entre linhas — rótulo do tipo à esquerda,
    // assunto no meio, ação à direita — e o contexto (pulso, carteira, elo)
    // vai para o trilho de 4 colunas. Antes, "Faturas", "Extras", "Revisar",
    // "Mensagens" e "Reuniões" eram cinco cartões idênticos de 24px de folga,
    // e nada dizia qual era urgente.
    <div>
      <OnboardingModal role="agency" />

      <div className="flex flex-wrap items-end justify-between gap-4 pb-6">
        <div>
          <p className="t6 text-text-muted">Painel</p>
          <h1 className="d3 mt-2">Hoje</h1>
          <p className="t3 measure-lede mt-1 text-text-muted">
            {actionCount === 0
              ? "Tudo em dia — nada esperando a sua ação."
              : `${actionCount} ${actionCount === 1 ? "item precisa" : "itens precisam"} da sua ação.`}
          </p>
        </div>
        <Link href="/clients/new" className={buttonClass("primary")}>
          Novo cliente
        </Link>
      </div>

      {data.clients.length === 0 ? (
        <div data-testid="agency-empty-state">
          <ActivationChecklist expect="agency" intro="Seu espaço está pronto e é só seu. Comece por aqui:" />
        </div>
      ) : (
        <ActivationChecklist expect="agency" />
      )}

      <div className="ed-grid mt-10">
        {/* ---- Fila: o que precisa de você ------------------------------ */}
        <div className="c8">
          <h2 className="t6 border-b border-edge pb-2 text-text-muted">Precisa de você</h2>

          {actionCount === 0 ? (
            <EmptyState
              icon="check"
              title="Nada na fila"
              condition="Entregas, aprovações e faturas que precisarem de você aparecem aqui."
            />
          ) : (
            <div>
              {data.receivables.overdue.length > 0 && (
                <div data-testid="home-receivables">
                  {data.receivables.overdue.map((item) => (
                    <QueueRow
                      key={item.id}
                      kind="Fatura atrasada"
                      tone="negative"
                      testId="home-overdue"
                      href={`/invoices`}
                      subject={item.clientName}
                      meta={`${fmtMoney(item.total)} · atrasada há ${daysLate(item.dueDate)} dia(s)`}
                      action={{
                        label: "Lembrar",
                        onClick: () =>
                          openAfter(async () =>
                            (await api<{ whatsappUrl: string }>(`/api/invoices/${item.id}`)).whatsappUrl,
                          ).catch(() => {}),
                      }}
                    />
                  ))}
                </div>
              )}

              {data.staleApprovals.length > 0 && (
                <div data-testid="stale-approvals">
                  {data.staleApprovals.map((item) => (
                    <QueueRow
                      key={item.id}
                      kind="Aprovação parada"
                      tone="caution"
                      href={`/clients/${item.clientId}`}
                      subject={item.clientName}
                      meta={`${item.pending} sem resposta há mais de 48h`}
                      action={{
                        label: "Reenviar",
                        onClick: () =>
                          openAfter(async () =>
                            (await api<{ whatsappUrl: string }>(`/api/approval-links/${item.id}`)).whatsappUrl,
                          ).catch(() => {}),
                      }}
                    />
                  ))}
                </div>
              )}

              {data.duePosts.map((post) => (
                <QueueRow
                  key={post.id}
                  kind="Publicar"
                  tone="caution"
                  href="/agenda"
                  subject={post.title}
                  meta={`${post.clientName} · ${new Date(post.scheduledFor).toLocaleString("pt-BR")}`}
                />
              ))}

              {data.inReview.map((item) => (
                <QueueRow
                  key={item.id}
                  kind="Revisar entrega"
                  href={`/clients/${item.clientId}?project=${item.id}`}
                  subject={item.title}
                  meta={item.clientName}
                />
              ))}

              {data.pendingApplications.map((item) => (
                <QueueRow
                  key={item.id}
                  kind="Candidatura"
                  href={`/clients/${item.clientId}?project=${item.projectId}`}
                  subject={item.professionalName}
                  meta={item.projectTitle}
                />
              ))}

              {data.unansweredClientMessages.map((item) => (
                <QueueRow
                  key={item.clientId}
                  kind="Mensagem"
                  href={`/clients/${item.clientId}?tab=dashboard`}
                  subject={item.clientName}
                  meta={`${item.count} mensagem(ns) aguardando`}
                />
              ))}

              {data.awaitingClient.map((item) => (
                <QueueRow
                  key={item.id}
                  kind="Com o cliente"
                  href={`/clients/${item.clientId}?project=${item.id}`}
                  subject={item.title}
                  meta={item.clientName}
                />
              ))}

              {data.meetingsToday.map((meeting) => (
                <QueueRow
                  key={meeting.id}
                  kind="Reunião"
                  href="/agenda"
                  subject={meeting.title}
                  meta={`${new Date(meeting.scheduledAt).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}${meeting.clientName ? ` · ${meeting.clientName}` : ""}`}
                />
              ))}
            </div>
          )}

          {/* ---- Carteira: tabela, não cartõezinhos --------------------- */}
          <div className="mt-12">
            <div className="flex items-baseline justify-between border-b border-edge pb-2">
              <h2 className="t6 text-text-muted">Carteira de clientes</h2>
              <Link href="/clients" className="t5 inline-flex min-h-10 items-center font-medium underline-offset-4 hover:underline">
                Ver todos
              </Link>
            </div>
            {data.clients.length === 0 ? (
              <EmptyState
                icon="briefcase"
                title="Carteira vazia"
                condition="O primeiro cliente aparece aqui assim que você cadastrar."
                action={
                  <Link href="/clients/new" className={buttonClass("secondary")}>
                    Cadastrar cliente
                  </Link>
                }
              />
            ) : (
              /* A Hoje media 4.403px de setenta linhas iguais: mostra as oito
                 primeiras e diz quantas faltam — a tela é de PRIORIDADE, não
                 catálogo; o catálogo é /clients. */
              <ul>
                {data.clients.slice(0, HOME_CLIENTS).map((client) => (
                  <li key={client.id} className="border-b border-rule">
                    <Link
                      href={`/clients/${client.id}`}
                      className="flex items-baseline gap-4 py-2.5 transition-colors duration-[var(--dur-1)] hover:bg-surface-sunken"
                    >
                      <span className="t3 min-w-0 flex-1 truncate font-medium">{client.name}</span>
                      <span className="t5 hidden min-w-0 flex-1 truncate text-text-muted sm:block">
                        {client.industry || EM_DASH}
                      </span>
                      <TierBadge info={client.tier} />
                    </Link>
                  </li>
                ))}
                {data.clients.length > HOME_CLIENTS && (
                  <li className="border-b border-rule">
                    <Link
                      href="/clients"
                      className="t5 flex min-h-10 items-center text-text-muted transition-colors duration-[var(--dur-1)] hover:bg-surface-sunken hover:text-text"
                      data-testid="home-clients-more"
                    >
                      Mais {data.clients.length - HOME_CLIENTS} clientes na carteira
                    </Link>
                  </li>
                )}
              </ul>
            )}
          </div>
        </div>

        {/* ---- Trilho de contexto -------------------------------------- */}
        <aside className="c4">
          <PulseOverviewCard mode="home" />

          {(data.receivables.dueSoon.length > 0 ||
            data.receivables.drafts > 0 ||
            data.receivables.claimed > 0) && (
            <section className="mt-8 border-t border-edge pt-2">
              <div className="flex items-baseline justify-between">
                <h2 className="t6 text-text-muted">Cobranças</h2>
                <Link href="/invoices" className="t5 inline-flex min-h-10 items-center font-medium underline-offset-4 hover:underline">
                  Abrir
                </Link>
              </div>
              <dl className="mt-2">
                {data.receivables.dueSoon.length > 0 && (
                  <div className="flex items-baseline justify-between gap-3 border-b border-rule py-2">
                    <dt className="t4 text-text-muted">Vencem esta semana</dt>
                    <dd className="n3">
                      {fmtMoney(data.receivables.dueSoon.reduce((sum, i) => sum + i.total, 0))}
                    </dd>
                  </div>
                )}
                {data.receivables.claimed > 0 && (
                  <div className="flex items-baseline justify-between gap-3 border-b border-rule py-2">
                    <dt className="t4 text-text-muted">Avisaram que pagaram</dt>
                    <dd className="n3">{data.receivables.claimed}</dd>
                  </div>
                )}
                {data.receivables.drafts > 0 && (
                  <div className="flex items-baseline justify-between gap-3 border-b border-rule py-2">
                    <dt className="t4 text-text-muted">Rascunhos a enviar</dt>
                    <dd className="n3">{data.receivables.drafts}</dd>
                  </div>
                )}
              </dl>
            </section>
          )}

          {(data.extras.count > 0 || data.extras.pending > 0) && (
            <section className="mt-8 border-t border-edge pt-2" data-testid="extras-summary">
              <h2 className="t6 text-text-muted">Extras do mês</h2>
              <p className="t3 mt-2">{`Extras aprovados este mês: ${fmtMoney(data.extras.total)}`}</p>
              {data.extras.pending > 0 && (
                <p className="t5 mt-1 text-text-muted">{`${data.extras.pending} pedido(s) esperando o cliente aprovar o valor`}</p>
              )}
              <p className="t5 mt-2 text-text-muted">
                Os extras aprovados entram na fatura do mês de cada cliente.
              </p>
            </section>
          )}

          {data.agency && (
            <section className="mt-8 border-t border-edge pt-2">
              <h2 className="t6 text-text-muted">Elo da agência</h2>
              <div className="mt-2">
                <TierBadge info={data.agency.tier} />
              </div>
              <p className="t5 mt-1 text-text-muted">{data.agency.tier.reason}</p>
              <div className="mt-3">
                <TierProgress info={data.agency.tier} celebrate celebrateKey="levelup_agency" />
              </div>
            </section>
          )}
        </aside>
      </div>

      <div className="mt-12">
        <h2 className="t6 border-b border-edge pb-2 text-text-muted">O que a Marqa faz por você</h2>
        <div className="mt-2">
          <DifferentiatorsStrip />
        </div>
      </div>
    </div>
  );
}

/**
 * Linha da fila: rótulo do tipo à esquerda (largura fixa, para os tipos
 * alinharem numa coluna), assunto e contexto no meio, ação à direita. O estado
 * entra por cor semântica no rótulo — nunca por um cartão colorido inteiro.
 */
function QueueRow({
  kind,
  subject,
  meta,
  href,
  tone = "neutral",
  action,
  testId,
}: {
  kind: string;
  subject: string;
  meta?: string;
  href: string;
  tone?: "neutral" | "caution" | "negative";
  action?: { label: string; onClick: () => void };
  testId?: string;
}) {
  const toneClass =
    tone === "negative" ? "text-negative" : tone === "caution" ? "text-caution" : "text-text-faint";
  return (
    <div
      data-testid={testId}
      className="flex items-baseline gap-4 border-b border-rule transition-colors duration-[var(--dur-1)] hover:bg-surface-sunken"
    >
      <Link href={href} className="flex min-h-10 min-w-0 flex-1 items-baseline gap-4 py-2.5">
        <span className={`t6 w-32 shrink-0 ${toneClass}`}>{kind}</span>
        <span className="t3 min-w-0 flex-1 truncate font-medium">{subject}</span>
        {meta && <span className="t5 hidden min-w-0 flex-1 truncate text-text-muted md:block">{meta}</span>}
      </Link>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="t5 inline-flex min-h-10 shrink-0 items-center pr-1 font-medium underline-offset-4 hover:underline"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
