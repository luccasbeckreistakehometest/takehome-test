"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Card, SectionTitle, Skeleton, Tag } from "@/components/ui";
import { type IconName } from "@/components/icons";
import { fmtMoney, useUiLang } from "@/lib/i18n";
import AdminUsers from "./AdminUsers";
import AdminPayments from "./AdminPayments";
import AdminPublicPages from "./AdminPublicPages";
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
  pagePublished: boolean;
  pageIndexable: boolean;
};

type Overview = {
  agencyFilter: string | null;
  legal?: { identityComplete: boolean; agencySignupOpen: boolean };
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
    freeSpendTodayUsd: number;
    freeLimitUsd: number;
    freeAccountLimitUsd: number;
    paidAccountLimitUsd: number;
    keyConfigured: boolean;
    byDay: { day: string; costUsd: number; calls: number }[];
    byAccount: { accountType: string | null; accountId: string | null; name: string; calls: number; costUsd: number; lastAt: string }[];
    errors: { id: string; createdAt: string; action: string; kind: string; detail: string }[];
    byActionModel: { action: string; provider: string; model: string; calls: number; costUsd: number; webSearches: number }[];
    usdBrlRate: number;
    margins: { accountType: string; accountId: string; name: string; revenueBrl: number; costUsd: number; costBrl: number; marginBrl: number; marginPct: number | null; calls: number }[];
  };
  inbox: { new: number; in_progress: number; done: number };
  leads: { total: number; last30: number; recent: { id: string; slug: string; name: string; need: string; budgetBand: string; createdAt: string }[] };
  proposals: { byStatus: { status: string; c: number }[]; recent: { id: string; prospectName: string; status: string; acceptedPackage: string; createdAt: string }[] };
  pulse: { responses: number; avgScore: number | null; recent: { clientId: string; clientName: string | null; score: number; createdAt: string }[] };
};

type AdminTab = "overview" | "users" | "payments" | "inbox" | "ai" | "public";
const TABS: { key: AdminTab; label: string }[] = [
  { key: "overview", label: "Visão geral" },
  { key: "users", label: "Usuários" },
  { key: "payments", label: "Pagamentos" },
  { key: "inbox", label: "Caixa de entrada" },
  { key: "ai", label: "Custos de IA" },
  { key: "public", label: "Páginas públicas" },
];
const usd = (n: number) => `US$ ${n.toFixed(2)}`;

export default function AdminPage() {
  const lang = useUiLang();
  const brl = (n: number) => fmtMoney(n, lang);
  const [data, setData] = useState<Overview | null>(null);
  const [tab, setTab] = useState<AdminTab>("overview");
  // Filtro por agência ("" = todas): vale para a visão geral, usuários e pagamentos.
  const [agency, setAgency] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const query = agency ? `?agency=${encodeURIComponent(agency)}` : "";
    api<Overview>(`/api/admin/overview${query}`).then(setData).catch(() => {});
  }, [agency, reloadKey]);

  // Moderação da página pública (liberar no Google / despublicar).
  async function moderatePage(id: string, body: { pageIndexable?: boolean; unpublish?: true }) {
    await api(`/api/admin/agencies/${id}`, { method: "PATCH", body: JSON.stringify(body) }).catch(() => {});
    setReloadKey((k) => k + 1);
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-56" />
        <div className="grid gap-x-8 gap-y-5 border-y border-edge py-4 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12" />
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
          <h1 className="d3">Admin da Plataforma</h1>
          <p className="t3 measure-lede mt-2 text-text-muted">
            Controle geral: agências, clientes, profissionais, planos e receita.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/analytics"
            className="rounded-md border border-edge bg-surface-sunken px-4 py-2 t3 transition-colors hover:border-edge"
            data-testid="admin-analytics-link"
          >
            Funil e origens
          </Link>
          <Link
            href="/settings"
            className="rounded-md border border-edge bg-surface-sunken px-4 py-2 t3 transition-colors hover:border-edge"
          >
            Configurações da plataforma
          </Link>
          <Link
            href="/plans"
            className="rounded-md bg-brand-solid px-4 py-2 t3 font-medium text-brand-ink transition-opacity hover:opacity-90"
          >
            Receita & bloqueio
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="admin-agency-filter" className="t3 text-text-muted">
          Agência
        </label>
        <select
          id="admin-agency-filter"
          value={agency}
          onChange={(e) => setAgency(e.target.value)}
          className="rounded-md border border-edge bg-surface-sunken px-3 py-1.5 t3"
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

      <div
        role="tablist"
        aria-label="Seções do admin"
        className="flex gap-6 overflow-x-auto border-b border-edge"
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            type="button"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`t3 -mb-px whitespace-nowrap border-b-2 py-2 transition-colors duration-[var(--dur-1)] ${
              tab === t.key
                ? "border-text font-medium text-text"
                : "border-transparent text-text-muted hover:text-text"
            }`}
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
      {tab === "public" && <AdminPublicPages />}

      {tab === "overview" && (
      <>
      <Card data-testid="admin-ai-spend">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="t3 font-medium">Gasto de IA hoje</p>
          <p className="t3">
            <strong>{usd(data.ai.spendTodayUsd)}</strong> <span className="text-text-muted">de {usd(data.ai.dailyLimitUsd)} (teto diário)</span>
          </p>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-sunken" aria-hidden="true">
          <div className={`h-full ${spendPct >= 100 ? "bg-negative" : spendPct > 75 ? "bg-caution" : "bg-brand-solid"}`} style={{ width: `${spendPct}%` }} />
        </div>
        <p className="mt-2 t5 text-text-muted">
          {spendPct >= 100 ? "Teto atingido: a IA está pausada até amanhã (UTC). " : ""}
          Planos grátis hoje: {usd(data.ai.freeSpendTodayUsd)} de {usd(data.ai.freeLimitUsd)}. Teto por conta: grátis{" "}
          {usd(data.ai.freeAccountLimitUsd)}, paga {usd(data.ai.paidAccountLimitUsd)}, casa só o global.{" "}
          Ajuste com AI_DAILY_SPEND_LIMIT_USD, AI_FREE_DAILY_SPEND_LIMIT_USD, AI_FREE_ACCOUNT_DAILY_SPEND_LIMIT_USD e
          AI_PAID_ACCOUNT_DAILY_SPEND_LIMIT_USD no servidor. Bloqueio por saldo: {data.billing.enforced ? "ligado para todos" : "planos grátis sempre bloqueiam; pagos e a agência da casa, livres"}.
          {!data.ai.keyConfigured && " ANTHROPIC_API_KEY não está definida no ambiente."}
        </p>
      </Card>

      {data.legal && !data.legal.identityComplete && (
        <Card className="border-caution/60" data-testid="admin-legal-warning">
          <p className="t3">
            Defina LEGAL_NAME, LEGAL_DOCUMENT e LEGAL_EMAIL no servidor: sem eles a política de privacidade não identifica o
            controlador (LGPD art. 9) e o cadastro público de agências fica fechado (entram por convite ou pedido de acesso).
          </p>
        </Card>
      )}

      <Card data-testid="admin-agencies">
        <SectionTitle>Agências ({data.agencies.length})</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left t3">
            <thead className="t5 text-text-muted">
              <tr>
                <th className="py-2 pr-3 font-normal">Agência</th>
                <th className="py-2 pr-3 font-normal">Dono</th>
                <th className="py-2 pr-3 font-normal">Equipe</th>
                <th className="py-2 pr-3 font-normal">Clientes</th>
                <th className="py-2 pr-3 font-normal">Plano</th>
                <th className="py-2 pr-3 font-normal">Coins</th>
                <th className="py-2 pr-3 font-normal">Página</th>
                <th className="py-2 font-normal">Criada em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {data.agencies.map((a) => (
                <tr key={a.id}>
                  <td className="py-2 pr-3">
                    <button type="button" onClick={() => setAgency(a.id)} className="font-medium hover:text-text">
                      {a.name}
                    </button>
                    <span className="block font-mono t5 text-text-muted">/a/{a.slug}</span>
                  </td>
                  <td className="py-2 pr-3 font-mono t5">{a.ownerUsername ?? "—"}</td>
                  <td className="py-2 pr-3">{a.users}</td>
                  <td className="py-2 pr-3">{a.clients}</td>
                  <td className="py-2 pr-3">{a.planName}</td>
                  <td className="py-2 pr-3">{a.coins}</td>
                  <td className="py-2 pr-3 t5" data-testid={`agency-page-${a.slug}`}>
                    <span className="block text-text-muted">
                      {a.pagePublished ? "Publicada" : "Rascunho"} · {a.pageIndexable ? "no Google" : "fora do Google"}
                    </span>
                    {a.id !== "agency" && (
                      <span className="mt-1 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="text-text hover:underline"
                          onClick={() => moderatePage(a.id, { pageIndexable: !a.pageIndexable })}
                        >
                          {a.pageIndexable ? "Tirar do Google" : "Liberar no Google"}
                        </button>
                        {a.pagePublished && (
                          <button type="button" className="text-negative hover:underline" onClick={() => moderatePage(a.id, { unpublish: true })}>
                            Despublicar
                          </button>
                        )}
                      </span>
                    )}
                  </td>
                  <td className="py-2 t5 text-text-muted">{a.createdAt.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Treze ladrilhos iguais com um ícone e um número gigante viram uma
          faixa de figuras: o número é Archivo tabular (o Fraunces ignora tnum),
          o rótulo é t6, e o ícone decorativo sai. */}
      <dl className="grid gap-x-8 gap-y-5 border-y border-edge py-4 sm:grid-cols-3 lg:grid-cols-6">
        {kpis.map((k) => (
          <div key={k.label} className="min-w-0">
            <dt className="t6 text-text-muted">{k.label}</dt>
            <dd className={`n2 mt-1 truncate ${k.value === "0" ? "text-text-faint" : ""}`}>
              {k.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle>Clientes ({data.clients.length})</SectionTitle>
          <div className="max-h-80 space-y-1.5 overflow-y-auto">
            {data.clients.map((c) => (
              <Link
                key={c.id}
                href={`/clients/${c.id}`}
                className="flex items-center justify-between rounded-md border border-edge bg-surface-sunken px-3 py-2 t3 transition-colors hover:border-edge"
              >
                <span className="font-medium">{c.name}</span>
                <span className="t5 text-text-muted">{[c.agencyName, c.industry, c.country].filter(Boolean).join(" · ")}</span>
              </Link>
            ))}
            {data.clients.length === 0 && <p className="t3 text-text-muted">Nenhum cliente.</p>}
          </div>
        </Card>

        <Card>
          <SectionTitle>Profissionais ({data.professionals.length})</SectionTitle>
          <div className="max-h-80 space-y-1.5 overflow-y-auto">
            {data.professionals.map((p) => (
              <Link
                key={p.id}
                href={`/professionals/${p.id}`}
                className="flex items-center justify-between rounded-md border border-edge bg-surface-sunken px-3 py-2 t3 transition-colors hover:border-edge"
              >
                <span className="font-medium">{p.name}</span>
                <span className="flex items-center gap-1.5 t5 text-text-muted">
                  {[p.agencyName, p.role].filter(Boolean).join(" · ")}
                  <Tag>{p.employmentType === "employee" ? "full-time" : "freelancer"}</Tag>
                </span>
              </Link>
            ))}
            {data.professionals.length === 0 && <p className="t3 text-text-muted">Nenhum profissional.</p>}
          </div>
        </Card>

        <Card>
          <SectionTitle>Primeiros acessos ({data.onboarding.recent.length})</SectionTitle>
          <ul className="mt-3 divide-y divide-rule t3" data-testid="admin-onboarding">
            {data.onboarding.recent.map((o) => (
              <li key={o.userId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span><span className="font-medium">{o.username ?? o.userId.slice(0, 8)}</span> <span className="text-text-muted">· {o.role}</span></span>
                <span className="t5 text-text-muted">{o.tourCompleted ? "tour concluído" : `passo ${o.tourStep}`} · {(JSON.parse(o.events) as { type: string }[]).map((e) => e.type).join(" → ") || "—"}</span>
              </li>
            ))}
            {data.onboarding.recent.length === 0 && <li className="py-2 text-text-muted">Ninguém ainda.</li>}
          </ul>
        </Card>

        <Card>
          <SectionTitle>Contas de acesso ({data.users.length})</SectionTitle>
          <div className="max-h-80 space-y-1.5 overflow-y-auto">
            {data.users.map((u) => (
              <div
                key={u.username}
                className="flex items-center justify-between rounded-md border border-edge bg-surface-sunken px-3 py-2 t3"
              >
                <span>
                  <span className="font-mono text-text">{u.username}</span>{" "}
                  <span className="text-text-muted">— {u.name}{u.agencyName ? ` · ${u.agencyName}` : ""}</span>
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
              <p className="t3 text-text-muted">Nenhum convite gerado. Agências geram em Configurações.</p>
            ) : (
              data.invites.map((i) => (
                <div key={i.token} className="rounded-md border border-edge bg-surface-sunken px-3 py-2 t3">
                  <div className="flex items-center justify-between">
                    <Tag>{i.role}</Tag>
                    <span className={`t5 ${i.status === "accepted" ? "text-positive" : "text-text-muted"}`}>
                      {i.status}
                    </span>
                  </div>
                  {i.note && <p className="mt-1 t5 text-text-muted">{i.note}</p>}
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <SectionTitle>Leads da página pública ({data.leads.total})</SectionTitle>
          <ul className="max-h-72 space-y-1.5 overflow-y-auto t3">
            {data.leads.recent.map((l) => (
              <li key={l.id} className="rounded-md border border-edge bg-surface-sunken px-3 py-2">
                <span className="font-medium">{l.name}</span>
                <span className="block t5 text-text-muted">{[l.need, l.budgetBand].filter(Boolean).join(" · ") || "—"} · {new Date(l.createdAt).toLocaleDateString("pt-BR")}</span>
              </li>
            ))}
            {data.leads.recent.length === 0 && <li className="text-text-muted">Nenhum lead ainda.</li>}
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
          <ul className="max-h-60 space-y-1.5 overflow-y-auto t3">
            {data.proposals.recent.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 rounded-md border border-edge bg-surface-sunken px-3 py-2">
                <span className="truncate">{p.prospectName}</span>
                <span className="shrink-0 t5 text-text-muted">{p.acceptedPackage || p.status}</span>
              </li>
            ))}
            {data.proposals.recent.length === 0 && <li className="text-text-muted">Nenhuma proposta.</li>}
          </ul>
        </Card>
        <Card>
          <SectionTitle>Pulso dos clientes ({data.pulse.responses})</SectionTitle>
          <ul className="max-h-72 space-y-1.5 overflow-y-auto t3">
            {data.pulse.recent.map((p, i) => (
              <li key={`${p.clientId}-${i}`} className="flex items-center justify-between gap-2 rounded-md border border-edge bg-surface-sunken px-3 py-2">
                <span className="truncate">{p.clientName ?? "(removido)"}</span>
                <span className="shrink-0 font-semibold">{p.score}</span>
              </li>
            ))}
            {data.pulse.recent.length === 0 && <li className="text-text-muted">Sem respostas ainda.</li>}
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
      <Card data-testid="admin-ai-margins">
        <SectionTitle>Margem por conta (30 dias)</SectionTitle>
        <p className="mb-2 t5 text-text-muted">
          Receita confirmada (R$) menos o custo real de IA convertido a R$ {ai.usdBrlRate.toFixed(2)} por dólar (USD_BRL_RATE). Quem dá prejuízo aparece primeiro.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left t3">
            <thead className="t6 text-text-muted">
              <tr>
                <th className="py-2 pr-3">Conta</th>
                <th className="py-2 pr-3 text-right">Receita</th>
                <th className="py-2 pr-3 text-right">Custo IA</th>
                <th className="py-2 pr-3 text-right">Margem</th>
                <th className="py-2 text-right">Chamadas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {ai.margins.map((m) => (
                <tr key={`${m.accountType}-${m.accountId}`}>
                  <td className="py-1.5 pr-3">
                    {m.name} <span className="t5 text-text-muted">{m.accountType}</span>
                  </td>
                  <td className="py-1.5 pr-3 text-right">R$ {m.revenueBrl.toFixed(2)}</td>
                  <td className="py-1.5 pr-3 text-right">
                    {usd(m.costUsd)} <span className="t5 text-text-muted">(R$ {m.costBrl.toFixed(2)})</span>
                  </td>
                  <td className={`py-1.5 pr-3 text-right font-medium ${m.marginBrl < 0 ? "text-negative" : ""}`}>
                    R$ {m.marginBrl.toFixed(2)}
                    {m.marginPct !== null && <span className="ml-1 t5 text-text-muted">{m.marginPct}%</span>}
                  </td>
                  <td className="py-1.5 text-right">{m.calls}</td>
                </tr>
              ))}
              {ai.margins.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-2 text-text-muted">
                    Sem receita nem uso de IA nos últimos 30 dias.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      <Card data-testid="admin-ai-actions">
        <SectionTitle>Custo por ação e modelo (30 dias)</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left t3">
            <thead className="t6 text-text-muted">
              <tr>
                <th className="py-2 pr-3">Ação</th>
                <th className="py-2 pr-3">Modelo</th>
                <th className="py-2 pr-3 text-right">Chamadas</th>
                <th className="py-2 pr-3 text-right">Buscas</th>
                <th className="py-2 text-right">Custo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {ai.byActionModel.map((r) => (
                <tr key={`${r.action}-${r.provider}-${r.model}`}>
                  <td className="py-1.5 pr-3 font-mono t5">{r.action}</td>
                  <td className="py-1.5 pr-3 t5 text-text-muted">{r.provider === "anthropic" ? r.model : `${r.provider} ${r.model}`}</td>
                  <td className="py-1.5 pr-3 text-right">{r.calls}</td>
                  <td className="py-1.5 pr-3 text-right">{r.webSearches ?? 0}</td>
                  <td className="py-1.5 text-right">{usd(r.costUsd)}</td>
                </tr>
              ))}
              {ai.byActionModel.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-2 text-text-muted">
                    Nenhum uso de IA registrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      <Card>
        <SectionTitle>Gasto por dia (US$, estimado pelo uso de tokens)</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[360px] text-left t3">
            <thead className="t6 text-text-muted">
              <tr>
                <th className="py-2 pr-3">Dia</th>
                <th className="py-2 pr-3 text-right">Chamadas</th>
                <th className="py-2 text-right">Custo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {ai.byDay.map((d) => (
                <tr key={d.day}>
                  <td className="py-1.5 pr-3">{d.day}</td>
                  <td className="py-1.5 pr-3 text-right">{d.calls}</td>
                  <td className="py-1.5 text-right">{usd(d.costUsd)}</td>
                </tr>
              ))}
              {ai.byDay.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-2 text-text-muted">
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
          <table className="w-full min-w-[480px] text-left t3" data-testid="admin-ai-accounts">
            <thead className="t6 text-text-muted">
              <tr>
                <th className="py-2 pr-3">Conta</th>
                <th className="py-2 pr-3 text-right">Chamadas</th>
                <th className="py-2 pr-3 text-right">Custo</th>
                <th className="py-2 text-right">Último uso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {ai.byAccount.map((a) => (
                <tr key={`${a.accountType}-${a.accountId}`}>
                  <td className="py-1.5 pr-3">
                    {a.name} <span className="t5 text-text-muted">{a.accountType ?? ""}</span>
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
        <ul className="space-y-2 t3" data-testid="admin-ai-errors">
          {ai.errors.map((e) => (
            <li key={e.id} className="rounded-md border border-edge bg-surface-sunken px-3 py-2">
              <p className="t5 text-text-muted">
                {new Date(e.createdAt).toLocaleString("pt-BR")} · {e.action || "—"} · <strong>{e.kind}</strong>
              </p>
              <p className="mt-1 break-words font-mono t5">{e.detail}</p>
            </li>
          ))}
          {ai.errors.length === 0 && <li className="text-text-muted">Nenhum erro registrado.</li>}
        </ul>
      </Card>
    </div>
  );
}
