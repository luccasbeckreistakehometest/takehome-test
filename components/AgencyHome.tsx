"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Client } from "@/lib/types";
import type { TierInfo } from "@/lib/ranking";
import TierBadge, { TierProgress } from "@/components/TierBadge";
import OnboardingModal from "@/components/OnboardingModal";
import DifferentiatorsStrip from "@/components/DifferentiatorsStrip";
import PulseOverviewCard from "@/components/PulseOverviewCard";
import { Card, SectionTitle, Spinner, Tag } from "@/components/ui";
import { fmtMoney } from "@/lib/i18n";
import { openAfter } from "@/lib/open-later";

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

  return (
    <div className="space-y-6">
      <OnboardingModal role="agency" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">
            Hoje
          </h1>
          <p className="mt-1 text-sm text-muted">
            {actionCount === 0
              ? "Tudo em dia — nada esperando a sua ação. 🎉"
              : `${actionCount} ${actionCount === 1 ? "item precisa" : "itens precisam"} da sua ação.`}
          </p>
        </div>
        <Link
          href="/clients/new"
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90"
        >
          + Novo cliente
        </Link>
      </div>

      {data.clients.length === 0 && <FirstSteps />}

      <DifferentiatorsStrip />

      {data.agency && (
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <SectionTitle>Elo da agência</SectionTitle>
              <TierBadge info={data.agency.tier} />
              <p className="mt-1.5 text-xs text-muted">{data.agency.tier.reason}</p>
            </div>
            <div className="w-full max-w-xl flex-1">
              <TierProgress info={data.agency.tier} celebrate celebrateKey="levelup_agency" />
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <PulseOverviewCard mode="home" />
        {(data.receivables.overdue.length > 0 || data.receivables.dueSoon.length > 0 || data.receivables.drafts > 0 || data.receivables.claimed > 0) && (
          <Card data-testid="home-receivables">
            <div className="flex items-center justify-between">
              <SectionTitle>🧾 Faturas</SectionTitle>
              <Link href="/invoices" className="text-xs text-accent hover:underline">
                Cobranças →
              </Link>
            </div>
            <div className="space-y-1.5 text-sm">
              {data.receivables.overdue.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-2 rounded-md border border-red-500/40 bg-red-500/5 px-3 py-2" data-testid="home-overdue">
                  <span className="min-w-0 truncate">
                    <span className="font-medium">{item.clientName}</span>{" "}
                    <span className="text-red-500">{`· atrasada há ${Math.max(1, Math.round((Date.parse(`${data.receivables.today}T00:00:00Z`) - Date.parse(`${item.dueDate}T00:00:00Z`)) / 86_400_000))} dia(s)`}</span>
                  </span>
                  <button
                    type="button"
                    className="shrink-0 text-xs font-medium text-accent hover:underline"
                    onClick={() => openAfter(async () => (await api<{ whatsappUrl: string }>(`/api/invoices/${item.id}`)).whatsappUrl).catch(() => {})}
                  >
                    Lembrar
                  </button>
                </div>
              ))}
              {data.receivables.dueSoon.length > 0 && (
                <p className="text-muted">{`${data.receivables.dueSoon.length} fatura(s) vencem esta semana · ${fmtMoney(data.receivables.dueSoon.reduce((s, i) => s + i.total, 0))}`}</p>
              )}
              {data.receivables.claimed > 0 && <p className="text-muted">{`${data.receivables.claimed} cliente(s) avisaram que pagaram — confira e confirme`}</p>}
              {data.receivables.drafts > 0 && <p className="text-muted">{`${data.receivables.drafts} rascunho(s) esperando envio`}</p>}
            </div>
          </Card>
        )}
        {(data.extras.count > 0 || data.extras.pending > 0) && (
          <Card data-testid="extras-summary">
            <SectionTitle>💰 Extras do mês</SectionTitle>
            <p className="text-sm">{`Extras aprovados este mês: ${fmtMoney(data.extras.total)}`}</p>
            {data.extras.pending > 0 && <p className="mt-1 text-sm text-muted">{`${data.extras.pending} pedido(s) esperando o cliente aprovar o valor`}</p>}
            <p className="mt-2 text-xs text-muted">Os extras aprovados entram na fatura do mês de cada cliente.</p>
          </Card>
        )}
        {data.staleApprovals.length > 0 && (
          <Card data-testid="stale-approvals">
            <SectionTitle>⏳ Aguardando aprovação há mais de 48h</SectionTitle>
            <div className="space-y-1.5">
              {data.staleApprovals.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-2 rounded-md border border-edge bg-surface-2 px-3 py-2 text-sm">
                  <Link href={`/clients/${item.clientId}`} className="min-w-0 truncate hover:text-accent">
                    <span className="font-medium">{item.clientName}</span>{" "}
                    <span className="text-muted">{`· ${item.pending} sem resposta`}</span>
                  </Link>
                  <button
                    type="button"
                    className="shrink-0 text-xs font-medium text-accent hover:underline"
                    onClick={() => openAfter(async () => (await api<{ whatsappUrl: string }>(`/api/approval-links/${item.id}`)).whatsappUrl).catch(() => {})}
                  >
                    Reenviar
                  </button>
                </div>
              ))}
            </div>
          </Card>
        )}
        {data.pendingApplications.length > 0 && (
          <Card>
            <SectionTitle>✋ Candidaturas aguardando análise</SectionTitle>
            <div className="space-y-1.5">
              {data.pendingApplications.map((item) => (
                <Link
                  key={item.id}
                  href={`/clients/${item.clientId}?project=${item.projectId}`}
                  className="block rounded-md border border-edge bg-surface-2 px-3 py-2 text-sm transition-colors hover:border-accent/60"
                >
                  <span className="font-medium">{item.professionalName}</span>{" "}
                  <span className="text-muted">→ {item.projectTitle}</span>
                </Link>
              ))}
            </div>
          </Card>
        )}

        {data.inReview.length > 0 && (
          <Card>
            <SectionTitle>🔍 Entregas para revisar</SectionTitle>
            <div className="space-y-1.5">
              {data.inReview.map((item) => (
                <Link
                  key={item.id}
                  href={`/clients/${item.clientId}?project=${item.id}`}
                  className="block rounded-md border border-edge bg-surface-2 px-3 py-2 text-sm transition-colors hover:border-accent/60"
                >
                  <span className="font-medium">{item.title}</span>{" "}
                  <span className="text-muted">· {item.clientName}</span>
                </Link>
              ))}
            </div>
          </Card>
        )}

        {data.awaitingClient.length > 0 && (
          <Card>
            <SectionTitle>👤 Aguardando aprovação do cliente</SectionTitle>
            <div className="space-y-1.5">
              {data.awaitingClient.map((item) => (
                <Link
                  key={item.id}
                  href={`/clients/${item.clientId}?project=${item.id}`}
                  className="block rounded-md border border-edge bg-surface-2 px-3 py-2 text-sm transition-colors hover:border-accent/60"
                >
                  <span className="font-medium">{item.title}</span>{" "}
                  <span className="text-muted">· {item.clientName}</span>
                </Link>
              ))}
            </div>
          </Card>
        )}

        {data.unansweredClientMessages.length > 0 && (
          <Card>
            <SectionTitle>💬 Clientes sem resposta</SectionTitle>
            <div className="space-y-1.5">
              {data.unansweredClientMessages.map((item) => (
                <Link
                  key={item.clientId}
                  href={`/clients/${item.clientId}?tab=dashboard`}
                  className="block rounded-md border border-edge bg-surface-2 px-3 py-2 text-sm transition-colors hover:border-accent/60"
                >
                  <span className="font-medium">{item.clientName}</span>{" "}
                  <span className="text-muted">
                    · {item.count} mensagem(ns) aguardando
                  </span>
                </Link>
              ))}
            </div>
          </Card>
        )}

        {data.duePosts.length > 0 && (
          <Card>
            <SectionTitle>⏰ Posts na hora de publicar</SectionTitle>
            <div className="space-y-1.5">
              {data.duePosts.map((post) => (
                <Link
                  key={post.id}
                  href="/agenda"
                  className="block rounded-md border border-amber-700/60 bg-amber-950/30 px-3 py-2 text-sm"
                >
                  <span className="font-medium">{post.title}</span>{" "}
                  <span className="text-muted">
                    · {post.clientName} · {new Date(post.scheduledFor).toLocaleString("pt-BR")}
                  </span>
                </Link>
              ))}
            </div>
          </Card>
        )}

        {data.meetingsToday.length > 0 && (
          <Card>
            <SectionTitle>📅 Reuniões de hoje</SectionTitle>
            <div className="space-y-1.5">
              {data.meetingsToday.map((meeting) => (
                <Link
                  key={meeting.id}
                  href="/agenda"
                  className="block rounded-md border border-edge bg-surface-2 px-3 py-2 text-sm transition-colors hover:border-accent/60"
                >
                  <span className="font-medium">{meeting.title}</span>{" "}
                  <span className="text-muted">
                    · {new Date(meeting.scheduledAt).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {meeting.clientName && ` · ${meeting.clientName}`}
                  </span>
                </Link>
              ))}
            </div>
          </Card>
        )}
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <SectionTitle>Carteira de clientes</SectionTitle>
          <Link href="/clients" className="text-xs text-accent hover:underline">
            Ver todos →
          </Link>
        </div>
        {data.clients.length === 0 && (
          <p className="text-sm text-muted">Sua carteira está vazia. O primeiro cliente aparece aqui.</p>
        )}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.clients.map((client) => (
            <Link key={client.id} href={`/clients/${client.id}`}>
              <div className="rounded-lg border border-edge bg-surface-2 p-3 transition-colors hover:border-accent/60">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{client.name}</p>
                  <TierBadge info={client.tier} />
                </div>
                <p className="mt-0.5 text-xs text-muted">{client.industry || "—"}</p>
              </div>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}

// Agência recém-criada (workspace vazio): o caminho curto até o primeiro
// entregável, na ordem em que faz sentido.
const FIRST_STEPS: { href: string; title: string; text: string }[] = [
  { href: "/clients/new", title: "Cadastre o primeiro cliente", text: "Digite ou fale o briefing. Dele saem a estratégia, o calendário e os posts." },
  { href: "/settings", title: "Coloque a sua marca", text: "Nome, cor e logo da agência. É isso que seus clientes veem no portal." },
  { href: "/settings#pagina-publica", title: "Publique sua página", text: "Um endereço seu para mostrar trabalhos e receber pedidos pelo WhatsApp." },
  { href: "/settings#convites", title: "Chame o time e os clientes", text: "Gere convites: cada pessoa entra direto no seu espaço." },
];

function FirstSteps() {
  return (
    <Card data-testid="agency-empty-state">
      <SectionTitle>Primeiros passos</SectionTitle>
      <p className="-mt-1 mb-3 text-sm text-muted">Seu espaço está pronto e é só seu. Comece por aqui:</p>
      <ol className="grid gap-3 sm:grid-cols-2">
        {FIRST_STEPS.map((step, index) => (
          <li key={step.href}>
            <Link
              href={step.href}
              className="flex h-full gap-3 rounded-lg border border-edge bg-surface-2 p-3 transition-colors hover:border-accent/60"
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent text-sm font-bold text-accent-ink">
                {index + 1}
              </span>
              <span>
                <span className="block font-medium">{step.title}</span>
                <span className="mt-0.5 block text-xs text-muted">{step.text}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </Card>
  );
}
