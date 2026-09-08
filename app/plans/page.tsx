"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button, Card, SectionTitle, Skeleton, Tag } from "@/components/ui";
import { Icon } from "@/components/icons";
import { fmtMoney, useUiLang } from "@/lib/i18n";

type Plan = {
  id: string;
  name: string;
  monthlyPrice: number;
  aiCoinsPerMonth: number;
  quality: string;
  unlimited?: boolean;
  highlights: string[];
  recommended?: boolean;
};
type Pack = { id: string; coins: number; price: number; bonus: number };
type Periods = Record<string, { months: number; discount: number; label: string }>;

type Summary = {
  role: string;
  accountType?: string;
  plan?: Plan;
  subscription?: { planId: string; period: string };
  wallet?: { coins: number };
  usageThisMonth?: number;
  plans?: Plan[];
  packs: Pack[];
  periods: Periods;
  enforced?: boolean;
  revenue?: { total: number; mrr: number; byKind: Record<string, number> };
};

const QUALITY_LABEL: Record<string, string> = { economy: "Econômica", balanced: "Balanceada", premium: "Premium (Opus)" };

export default function PlansPage() {
  const lang = useUiLang();
  const brl = (n: number) => fmtMoney(n, lang);
  const [data, setData] = useState<Summary | null>(null);
  const [period, setPeriod] = useState("monthly");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = () => api<Summary>("/api/billing").then(setData).catch(() => {});
  useEffect(() => {
    load();
    // Mensagens de retorno do checkout do Mercado Pago
    const q = new URLSearchParams(window.location.search);
    if (q.get("pago")) setMsg("✅ Pagamento recebido! A liberação acontece em instantes (confirmação automática).");
    else if (q.get("pendente")) setMsg("⏳ Pagamento pendente. Assim que for confirmado, liberamos automaticamente.");
    else if (q.get("falhou")) setMsg("❌ O pagamento não foi concluído. Você pode tentar de novo.");
    // recarrega o saldo alguns segundos depois (dá tempo do webhook chegar)
    const t = setInterval(load, 6000);
    setTimeout(() => clearInterval(t), 30000);
    return () => clearInterval(t);
  }, []);

  if (!data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-48" />
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-72" />)}
        </div>
      </div>
    );
  }

  function periodPrice(monthly: number) {
    const p = data!.periods[period];
    return Math.round(monthly * p.months * (1 - p.discount));
  }

  async function subscribe(planId: string) {
    const plan = data?.plans?.find((p) => p.id === planId);
    setBusy(true); setMsg("");
    try {
      // Plano grátis ativa direto; plano pago vai pro checkout do Mercado Pago.
      if (plan && plan.monthlyPrice === 0) {
        await api("/api/billing/subscribe", { method: "POST", body: JSON.stringify({ planId, period }) });
        setMsg("Plano ativado!");
        load();
      } else {
        const r = await api<{ url: string }>("/api/billing/checkout", {
          method: "POST",
          body: JSON.stringify({ kind: "plan", planId, period }),
        });
        window.location.href = r.url; // redireciona pro pagamento (Pix/cartão/boleto)
      }
    } catch (e) { setMsg(e instanceof Error ? e.message : "erro"); setBusy(false); }
  }
  async function buyCoins(packId: string) {
    setBusy(true); setMsg("");
    try {
      const r = await api<{ url: string }>("/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ kind: "coins", packId }),
      });
      window.location.href = r.url; // redireciona pro pagamento
    } catch (e) { setMsg(e instanceof Error ? e.message : "erro"); setBusy(false); }
  }
  async function toggleEnforce() {
    await api("/api/billing/enforce", { method: "POST", body: JSON.stringify({ on: !data!.enforced }) });
    load();
  }

  // ---------- Visão do admin ----------
  if (data.role === "admin" && data.revenue) {
    return (
      <div className="space-y-6">
        <h1 className="flex items-center gap-2 font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">
          <Icon name="money" size={24} className="text-accent" /> Receita & planos
        </h1>
        <div className="grid gap-3 sm:grid-cols-3">
          <Card><p className="text-xs uppercase text-muted">Receita total</p><p className="mt-1 text-3xl font-bold text-accent">{brl(data.revenue.total)}</p></Card>
          <Card><p className="text-xs uppercase text-muted">MRR (assinaturas ativas)</p><p className="mt-1 text-3xl font-bold">{brl(data.revenue.mrr)}</p></Card>
          <Card>
            <p className="text-xs uppercase text-muted">Bloqueio de IA por saldo</p>
            <div className="mt-2 flex items-center gap-2">
              <Button variant={data.enforced ? "danger" : "ghost"} onClick={toggleEnforce}>
                {data.enforced ? "Ligado (cobrando)" : "Desligado (livre)"}
              </Button>
            </div>
          </Card>
        </div>
        <Card>
          <SectionTitle>Receita por origem</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {Object.entries(data.revenue.byKind).map(([k, v]) => (
              <span key={k} className="rounded-md border border-edge bg-surface-2 px-3 py-2 text-sm">
                {k === "subscription" ? "Assinaturas" : k === "coin_purchase" ? "Coins" : k}: <span className="font-semibold text-accent">{brl(v)}</span>
              </span>
            ))}
            {Object.keys(data.revenue.byKind).length === 0 && <p className="text-sm text-muted">Nenhuma receita ainda.</p>}
          </div>
        </Card>
      </div>
    );
  }

  // ---------- Visão de conta (cliente/profissional/agência) ----------
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">Planos & coins</h1>
          <p className="mt-1 text-sm text-muted">
            Plano atual: <strong className="text-foreground">{data.plan?.name}</strong>
            {" · "}Carteira: <strong className="text-accent">{Math.round(data.wallet?.coins ?? 0)} coins</strong>
            {" · "}Uso no mês: {Math.round(data.usageThisMonth ?? 0)} coins
          </p>
        </div>
        <div className="flex flex-wrap gap-1 rounded-lg border border-edge bg-surface-2 p-1">
          {Object.entries(data.periods).map(([key, p]) => (
            <button
              key={key}
              onClick={() => setPeriod(key)}
              className={`rounded-md px-3 py-1.5 text-xs transition-colors ${period === key ? "bg-accent text-accent-ink" : "text-muted hover:text-foreground"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {msg && <div className="rounded-md border border-accent/40 bg-accent/5 px-3 py-2 text-sm text-accent">{msg}</div>}

      <div className="grid gap-4 md:grid-cols-3">
        {data.plans?.map((plan) => {
          const isCurrent = data.subscription?.planId === plan.id;
          const total = periodPrice(plan.monthlyPrice);
          return (
            <Card key={plan.id} hover className={`relative flex flex-col ${plan.recommended ? "border-accent" : ""}`}>
              {plan.recommended && (
                <span className="absolute -top-2.5 left-4 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-ink">
                  RECOMENDADO
                </span>
              )}
              <p className="text-sm font-semibold uppercase tracking-wide text-muted">{plan.name}</p>
              <p className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold">
                {plan.monthlyPrice === 0 ? "Grátis" : brl(total)}
                {plan.monthlyPrice > 0 && (
                  <span className="text-sm font-normal text-muted">/{data.periods[period].months === 1 ? "mês" : `${data.periods[period].months}m`}</span>
                )}
              </p>
              <div className="mt-1"><Tag>{plan.unlimited ? "IA ilimitada" : QUALITY_LABEL[plan.quality]}</Tag></div>
              <ul className="mt-4 flex-1 space-y-1.5 text-sm text-muted">
                {plan.highlights.map((h) => (
                  <li key={h} className="flex items-start gap-1.5">
                    <Icon name="check" size={14} className="mt-0.5 shrink-0 text-accent" /> {h}
                  </li>
                ))}
              </ul>
              <Button
                className="mt-4 w-full"
                variant={isCurrent ? "ghost" : "primary"}
                disabled={busy || isCurrent}
                onClick={() => subscribe(plan.id)}
              >
                {isCurrent ? "Plano atual" : plan.monthlyPrice === 0 ? "Selecionar" : "Assinar"}
              </Button>
            </Card>
          );
        })}
      </div>

      {/* Coins on-demand */}
      <Card>
        <SectionTitle>
          <span className="flex items-center gap-1.5"><Icon name="sparkle" size={15} /> Coins avulsos (sem assinar)</span>
        </SectionTitle>
        <p className="mb-3 text-sm text-muted">
          Prefere pagar só pelo uso? Compre coins e gaste quando quiser — cada ação de IA consome coins.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {data.packs.map((pack) => (
            <div key={pack.id} className="rounded-lg border border-edge bg-surface-2 p-4 text-center">
              <p className="font-[family-name:var(--font-display)] text-2xl font-bold text-accent">
                {pack.coins}
                {pack.bonus > 0 && <span className="text-sm text-emerald-500"> +{pack.bonus}</span>}
              </p>
              <p className="text-xs text-muted">coins{pack.bonus > 0 && " (com bônus)"}</p>
              <p className="mt-2 text-lg font-semibold">{brl(pack.price)}</p>
              <Button className="mt-2 w-full" variant="ghost" disabled={busy} onClick={() => buyCoins(pack.id)}>
                Comprar
              </Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
