"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Card, SectionTitle, Skeleton, Tag } from "@/components/ui";
import { Icon, type IconName } from "@/components/icons";
import { fmtMoney, useUiLang } from "@/lib/i18n";
import AdminUsers from "./AdminUsers";
import AdminPayments from "./AdminPayments";
import AdminInbox from "./AdminInbox";

type AgencyRow = {
  id: string;
  name: string;
  slug: string;
  ownerUsername: string | null;
  users: number;
  clients: number;
  planName: string;
  renewsAt: string;
  coins: number;
  createdAt: string;
};

type Overview = {
  agencyFilter: string | null;
  agencies: AgencyRow[];
  totals: {
    agencies: number;
    users: number;
    clients: number;
    professionals: number;
    generations: number;
    paidProjects: number;
    trackedRevenue: number;
  };
  clients: { id: string; name: string; industry: string; country: string; agencyName: string }[];
  professionals: { id: string; name: string; role: string; employmentType: string; agencyName: string }[];
  users: { username: string; role: string; name: string; agencyName: string }[];
  invites: { token: string; role: string; status: string; note: string; createdAt: string }[];
  onboarding: { toursStarted: number; toursCompleted: number; voiceBriefings: number; recent: { userId: string; username: string | null; role: string | null; tourCompleted: number; tourStep: number; firstSeenAt: string; events: string }[] };
  billing: { enforced: boolean; revenue: { total: number; mrr: number } };
  ai: {
    spendTodayUsd: number;
    dailyLimitUsd: number;
    keyConfigured: boolean;
    byDay: { day: string; costUsd: number; calls: number }[];
    byAccount: { accountType: string | null; accountId: string | null; name: string; calls: number; costUsd: number; lastAt: string }[];
    errors: { id: string; createdAt: string; action: string; kind: string; detail: string }[];
  };
  inbox: { new: number; in_progress: number; done: number };
  leads: { total: number; last30: number; recent: { id: string; slug: string; name: string; need: string; budgetBand: string; createdAt: string }[] };
  proposals: { byStatus: { status: string; c: number }[]; recent: { id: string; prospectName: string; status: string; acceptedPackage: string; createdAt: string }[] };
  pulse: { responses: number; avgScore: number | null; recent: { clientId: string; clientName: string | null; score: number; createdAt: string }[] };
};

type AdminTab = "overview" | "users" | "payments" | "inbox" | "ai";
const TABS: { key: AdminTab; label: string }[] = [
  { key: "overview", label: "Visão geral" },
  { key: "users", label: "Usuários" },
  { key: "payments", label: "Pagamentos" },
  { key: "inbox", label: "Caixa de entrada" },
  { key: "ai", label: "Uso de IA" },
];
const usd = (n: number) => `US$ ${n.toFixed(2)}`;

export default function AdminPage() {
  const lang = useUiLang();
  const brl = (n: number) => fmtMoney(n, lang);
  const [data, setData] = useState<Overview | null>(null);
  const [tab, setTab] = useState<AdminTab>("overview");
  // Filtro por agência ("" = todas): vale para a visão geral, usuários e pagamentos.
  const [agency, setAgency] = useState("");

  useEffect(() => {
    const query = agency ? `?agency=${encodeURIComponent(agency)}` : "";
    api<Overview>(`/api/admin/overview${query}`).then(setData).catch(() => {});
  }, [agency]);

  if (!data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-56" />
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  const kpis: { label: string; value: string; icon: IconName }[] = [
    { label: "Agências", value: String(data.totals.agencies), icon: "briefcase" },
    { label: "Usuários", value: String(data.totals.users), icon: "users" },
    { label: "Clientes", value: String(data.totals.clients), icon: "briefcase" },
    { label: "Profissionais", value: String(data.totals.professionals), icon: "user" },
    { label: "Entregáveis", value: String(data.totals.generations), icon: "sparkle" },
    { label: "Demandas pagas", value: String(data.totals.paidProjects), icon: "check" },
    { label: "Receita rastreada", value: brl(data.totals.trackedRevenue), icon: "money" },
    { label: "Tours concluídos", value: `${data.onboarding.toursCompleted}/${data.onboarding.toursStarted}`, icon: "target" },
    { label: "Briefings por voz", value: String(data.onboarding.voiceBriefings), icon: "message" },
    { label: "Receita confirmada", value: brl(data.billing.revenue.total), icon: "money" },
    { label: "Leads (30 dias)", value: String(data.leads.last30), icon: "radar" },
    { label: "Mensagens novas", value: String(data.inbox.new), icon: "mail" },
    { label: "Pulso médio (0-10)", value: data.pulse.avgScore === null ? "—" : data.pulse.avgScore.toFixed(1), icon: "target" },
  ];
  const spendPct = data.ai.dailyLimitUsd > 0 ? Math.min(100, (data.ai.spendTodayUsd / data.ai.dailyLimitUsd) * 100) : 100;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">
            <Icon name="settings" size={24} className="text-accent" /> Admin da Plataforma
          </h1>
          <p className="mt-1 text-sm text-muted">
            Controle geral: agências, clientes, profissionais, planos e receita.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/settings"
            className="rounded-md border border-edge bg-surface-2 px-4 py-2 text-sm transition-colors hover:border-accent"
          >
            Configurações da plataforma
          </Link>
          <Link
            href="/plans"
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90"
          >
            Receita & bloqueio
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="admin-agency-filter" className="text-sm text-muted">
          Agência
        </label>
        <select
          id="admin-agency-filter"
          value={agency}
          onChange={(e) => setAgency(e.target.value)}
          className="rounded-md border border-edge bg-surface-2 px-3 py-1.5 text-sm"
          data-testid="admin-agency-filter"
        >
          <option value="">Todas as agências</option>
          {data.agencies.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      <div role="tablist" aria-label="Seções do admin" className="flex gap-1 overflow-x-auto rounded-lg border border-edge bg-surface-2 p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            type="button"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition-colors ${tab === t.key ? "bg-accent text-accent-ink" : "text-muted hover:text-foreground"}`}
            data-testid={`admin-tab-${t.key}`}
          >
            {t.label}
            {t.key === "inbox" && data.inbox.new > 0 ? ` (${data.inbox.new})` : ""}
          </button>
        ))}
      </div>

      {tab === "users" && <AdminUsers agency={agency} />}
      {tab === "payments" && <AdminPayments agency={agency} />}
      {tab === "inbox" && <AdminInbox />}
      {tab === "ai" && <AiUsage ai={data.ai} />}

      {tab === "overview" && (
      <>
      <Card data-testid="admin-ai-spend">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">Gasto de IA hoje</p>
          <p className="text-sm">
            <strong>{usd(data.ai.spendTodayUsd)}</strong> <span className="text-muted">de {usd(data.ai.dailyLimitUsd)} (teto diário)</span>
          </p>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
          <div className={`h-full ${spendPct >= 100 ? "bg-red-500" : spendPct > 75 ? "bg-amber-500" : "bg-accent"}`} style={{ width: `${spendPct}%` }} />
        </div>
        <p className="mt-2 text-xs text-muted">
          {spendPct >= 100 ? "Teto atingido: a IA está pausada até amanhã (UTC). " : ""}
          Ajuste com AI_DAILY_SPEND_LIMIT_USD no servidor. Cobrança por saldo: {data.billing.enforced ? "ligada" : "desligada"}.
          {!data.ai.keyConfigured && " ANTHROPIC_API_KEY não está definida no ambiente."}
        </p>
      </Card>

      <Card data-testid="admin-agencies">
        <SectionTitle>Agências ({data.agencies.length})</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="py-2 pr-3 font-normal">Agência</th>
                <th className="py-2 pr-3 font-normal">Dono</th>
                <th className="py-2 pr-3 font-normal">Equipe</th>
                <th className="py-2 pr-3 font-normal">Clientes</th>
                <th className="py-2 pr-3 font-normal">Plano</th>
                <th className="py-2 pr-3 font-normal">Coins</th>
                <th className="py-2 font-normal">Criada em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge">
              {data.agencies.map((a) => (
                <tr key={a.id}>
                  <td className="py-2 pr-3">
                    <button type="button" onClick={() => setAgency(a.id)} className="font-medium hover:text-accent">
                      {a.name}
                    </button>
                    <span className="block font-mono text-xs text-muted">/a/{a.slug}</span>
                  </td>
                  <td className="py-2 pr-3 font-mono text-xs">{a.ownerUsername ?? "—"}</td>
                  <td className="py-2 pr-3">{a.users}</td>
                  <td className="py-2 pr-3">{a.clients}</td>
                  <td className="py-2 pr-3">{a.planName}</td>
                  <td className="py-2 pr-3">{a.coins}</td>
                  <td className="py-2 text-xs text-muted">{a.createdAt.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {kpis.map((k) => (
          <Card key={k.label} hover>
            <Icon name={k.icon} size={20} className="text-accent" />
            <p className="mt-2 font-[family-name:var(--font-display)] text-2xl font-bold">{k.value}</p>
            <p className="text-xs text-muted">{k.label}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle>Clientes ({data.clients.length})</SectionTitle>
          <div className="max-h-80 space-y-1.5 overflow-y-auto">
            {data.clients.map((c) => (
              <Link
                key={c.id}
                href={`/clients/${c.id}`}
                className="flex items-center justify-between rounded-md border border-edge bg-surface-2 px-3 py-2 text-sm transition-colors hover:border-accent/60"
              >
                <span className="font-medium">{c.name}</span>
                <span className="text-xs text-muted">{[c.agencyName, c.industry, c.country].filter(Boolean).join(" · ")}</span>
              </Link>
            ))}
            {data.clients.length === 0 && <p className="text-sm text-muted">Nenhum cliente.</p>}
          </div>
        </Card>

        <Card>
          <SectionTitle>Profissionais ({data.professionals.length})</SectionTitle>
          <div className="max-h-80 space-y-1.5 overflow-y-auto">
            {data.professionals.map((p) => (
              <Link
                key={p.id}
                href={`/professionals/${p.id}`}
                className="flex items-center justify-between rounded-md border border-edge bg-surface-2 px-3 py-2 text-sm transition-colors hover:border-accent/60"
              >
                <span className="font-medium">{p.name}</span>
                <span className="flex items-center gap-1.5 text-xs text-muted">
                  {[p.agencyName, p.role].filter(Boolean).join(" · ")}
                  <Tag>{p.employmentType === "employee" ? "full-time" : "freelancer"}</Tag>
                </span>
              </Link>
            ))}
            {data.professionals.length === 0 && <p className="text-sm text-muted">Nenhum profissional.</p>}
          </div>
        </Card>

        <Card>
          <SectionTitle>Primeiros acessos ({data.onboarding.recent.length})</SectionTitle>
          <ul className="mt-3 divide-y divide-edge text-sm" data-testid="admin-onboarding">
            {data.onboarding.recent.map((o) => (
              <li key={o.userId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span><span className="font-medium">{o.username ?? o.userId.slice(0, 8)}</span> <span className="text-muted">· {o.role}</span></span>
                <span className="text-xs text-muted">{o.tourCompleted ? "tour concluído" : `passo ${o.tourStep}`} · {(JSON.parse(o.events) as { type: string }[]).map((e) => e.type).join(" → ") || "—"}</span>
              </li>
            ))}
            {data.onboarding.recent.length === 0 && <li className="py-2 text-muted">Ninguém ainda.</li>}
          </ul>
        </Card>

        <Card>
          <SectionTitle>Contas de acesso ({data.users.length})</SectionTitle>
          <div className="max-h-80 space-y-1.5 overflow-y-auto">
            {data.users.map((u) => (
              <div
                key={u.username}
                className="flex items-center justify-between rounded-md border border-edge bg-surface-2 px-3 py-2 text-sm"
              >
                <span>
                  <span className="font-mono text-accent">{u.username}</span>{" "}
                  <span className="text-muted">— {u.name}{u.agencyName ? ` · ${u.agencyName}` : ""}</span>
                </span>
                <Tag>{u.role}</Tag>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionTitle>Convites ({data.invites.length})</SectionTitle>
          <div className="max-h-80 space-y-1.5 overflow-y-auto">
            {data.invites.length === 0 ? (
              <p className="text-sm text-muted">Nenhum convite gerado. Agências geram em Configurações.</p>
            ) : (
              data.invites.map((i) => (
                <div key={i.token} className="rounded-md border border-edge bg-surface-2 px-3 py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <Tag>{i.role}</Tag>
                    <span className={`text-xs ${i.status === "accepted" ? "text-emerald-500" : "text-muted"}`}>
                      {i.status}
                    </span>
                  </div>
                  {i.note && <p className="mt-1 text-xs text-muted">{i.note}</p>}
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <SectionTitle>Leads da página pública ({data.leads.total})</SectionTitle>
          <ul className="max-h-72 space-y-1.5 overflow-y-auto text-sm">
            {data.leads.recent.map((l) => (
              <li key={l.id} className="rounded-md border border-edge bg-surface-2 px-3 py-2">
                <span className="font-medium">{l.name}</span>
                <span className="block text-xs text-muted">{[l.need, l.budgetBand].filter(Boolean).join(" · ") || "—"} · {new Date(l.createdAt).toLocaleDateString("pt-BR")}</span>
              </li>
            ))}
            {data.leads.recent.length === 0 && <li className="text-muted">Nenhum lead ainda.</li>}
          </ul>
        </Card>
        <Card>
          <SectionTitle>Propostas</SectionTitle>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {data.proposals.byStatus.map((p) => (
              <Tag key={p.status}>
                {p.status}: {p.c}
              </Tag>
            ))}
          </div>
          <ul className="max-h-60 space-y-1.5 overflow-y-auto text-sm">
            {data.proposals.recent.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 rounded-md border border-edge bg-surface-2 px-3 py-2">
                <span className="truncate">{p.prospectName}</span>
                <span className="shrink-0 text-xs text-muted">{p.acceptedPackage || p.status}</span>
              </li>
            ))}
            {data.proposals.recent.length === 0 && <li className="text-muted">Nenhuma proposta.</li>}
          </ul>
        </Card>
        <Card>
          <SectionTitle>Pulso dos clientes ({data.pulse.responses})</SectionTitle>
          <ul className="max-h-72 space-y-1.5 overflow-y-auto text-sm">
            {data.pulse.recent.map((p, i) => (
              <li key={`${p.clientId}-${i}`} className="flex items-center justify-between gap-2 rounded-md border border-edge bg-surface-2 px-3 py-2">
                <span className="truncate">{p.clientName ?? "(removido)"}</span>
                <span className="shrink-0 font-semibold">{p.score}</span>
              </li>
            ))}
            {data.pulse.recent.length === 0 && <li className="text-muted">Sem respostas ainda.</li>}
          </ul>
        </Card>
      </div>
      </>
      )}
    </div>
  );
}

function AiUsage({ ai }: { ai: Overview["ai"] }) {
  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle>Gasto por dia (US$, estimado pelo uso de tokens)</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[360px] text-left text-sm">
            <thead className="text-xs uppercase text-muted">
              <tr>
                <th className="py-2 pr-3">Dia</th>
                <th className="py-2 pr-3 text-right">Chamadas</th>
                <th className="py-2 text-right">Custo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge">
              {ai.byDay.map((d) => (
                <tr key={d.day}>
                  <td className="py-1.5 pr-3">{d.day}</td>
                  <td className="py-1.5 pr-3 text-right">{d.calls}</td>
                  <td className="py-1.5 text-right">{usd(d.costUsd)}</td>
                </tr>
              ))}
              {ai.byDay.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-2 text-muted">
                    Nenhum uso de IA registrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      <Card>
        <SectionTitle>Uso por conta (30 dias)</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm" data-testid="admin-ai-accounts">
            <thead className="text-xs uppercase text-muted">
              <tr>
                <th className="py-2 pr-3">Conta</th>
                <th className="py-2 pr-3 text-right">Chamadas</th>
                <th className="py-2 pr-3 text-right">Custo</th>
                <th className="py-2 text-right">Último uso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge">
              {ai.byAccount.map((a) => (
                <tr key={`${a.accountType}-${a.accountId}`}>
                  <td className="py-1.5 pr-3">
                    {a.name} <span className="text-xs text-muted">{a.accountType ?? ""}</span>
                  </td>
                  <td className="py-1.5 pr-3 text-right">{a.calls}</td>
                  <td className="py-1.5 pr-3 text-right">{usd(a.costUsd)}</td>
                  <td className="py-1.5 text-right">{new Date(a.lastAt).toLocaleDateString("pt-BR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card>
        <SectionTitle>Erros recentes de IA</SectionTitle>
        <ul className="space-y-2 text-sm" data-testid="admin-ai-errors">
          {ai.errors.map((e) => (
            <li key={e.id} className="rounded-md border border-edge bg-surface-2 px-3 py-2">
              <p className="text-xs text-muted">
                {new Date(e.createdAt).toLocaleString("pt-BR")} · {e.action || "—"} · <strong>{e.kind}</strong>
              </p>
              <p className="mt-1 break-words font-mono text-xs">{e.detail}</p>
            </li>
          ))}
          {ai.errors.length === 0 && <li className="text-muted">Nenhum erro registrado.</li>}
        </ul>
      </Card>
    </div>
  );
}
