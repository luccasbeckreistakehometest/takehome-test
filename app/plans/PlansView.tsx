"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { Button, Card, ErrorBox, Input, SectionTitle, Skeleton, Tag } from "@/components/ui";
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
  subscription?: { planId: string; period: string; renewsAt: string; lastRefillAt: string | null };
  wallet?: { coins: number; planCoins: number; purchasedCoins: number };
  usageThisMonth?: number;
  plans?: Plan[];
  packs: Pack[];
  periods: Periods;
  enforced?: boolean;
  purchaseBlocked?: string | null;
  revenue?: { total: number; mrr: number; byKind: Record<string, number> };
};

type SubState = {
  available: boolean;
  recurring: boolean;
  cancelAtPeriodEnd: boolean;
  mpStatus: string;
  renewsAt: string;
  planId: string;
  email: string;
  pending: { planId: string; period: string; createdAt: string }[];
};

const QUALITY_LABEL: Record<string, string> = { economy: "IA econômica", balanced: "IA balanceada", premium: "IA premium (Opus)" };
const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "");

export default function PlansView() {
  const lang = useUiLang();
  const brl = (n: number) => fmtMoney(n, lang);
  const params = useSearchParams();
  const wantedPlan = params.get("plan");
  const [period, setPeriod] = useState(params.get("period") ?? "monthly");
  const [data, setData] = useState<Summary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [sub, setSub] = useState<SubState | null>(null);
  const [email, setEmail] = useState("");
  const [askEmail, setAskEmail] = useState<string | null>(null);

  const returned = params.get("sub")
    ? "Assinatura enviada ao Mercado Pago. O plano liga assim que a primeira cobrança no cartão for aprovada."
    : params.get("pago")
    ? "Pagamento recebido. A liberação acontece assim que o Mercado Pago confirmar (normalmente em segundos)."
    : params.get("pendente")
      ? "Pagamento pendente. Assim que o Mercado Pago confirmar, liberamos sozinhos."
      : params.get("falhou")
        ? "O pagamento não foi concluído. Você pode tentar de novo."
        : "";

  const load = useCallback(() => {
    api<Summary>("/api/billing")
      .then((summary) => {
        setData(summary);
        if (summary.role !== "admin" && !summary.purchaseBlocked) {
          api<SubState>("/api/billing/subscription")
            .then(setSub)
            .catch(() => setSub(null));
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Erro ao carregar"));
  }, []);

  useEffect(() => {
    load();
    if (!params.get("pago") && !params.get("pendente") && !params.get("sub")) return;
    // Recarrega o saldo por alguns segundos (tempo do webhook chegar).
    const timer = setInterval(load, 5000);
    const stop = setTimeout(() => clearInterval(timer), 45000);
    return () => {
      clearInterval(timer);
      clearTimeout(stop);
    };
  }, [load, params]);

  if (error && !data) return <ErrorBox message={error} />;
  if (!data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-48" />
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-72" />
          ))}
        </div>
      </div>
    );
  }

  const periodInfo = data.periods[period] ?? data.periods.monthly;
  const priceFor = (monthly: number) => Math.round(monthly * periodInfo.months * (1 - periodInfo.discount));

  async function checkout(body: Record<string, string>) {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ url: string }>("/api/billing/checkout", { method: "POST", body: JSON.stringify(body) });
      window.location.assign(result.url); // página de pagamento do Mercado Pago
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao abrir o pagamento");
      setBusy(false);
    }
  }

  // Assinatura no cartão (renova sozinha; cancele quando quiser)
  async function subscribe(planId: string) {
    const payerEmail = email.trim() || sub?.email || "";
    if (!payerEmail) {
      setAskEmail(planId);
      return;
    }
    if (
      sub?.recurring &&
      !sub.cancelAtPeriodEnd &&
      !confirm("Você já tem uma assinatura no cartão. A atual é cancelada no Mercado Pago assim que a nova for aprovada, e o plano novo começa na hora. Continuar?")
    ) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await api<{ url: string }>("/api/billing/subscription", {
        method: "POST",
        body: JSON.stringify({ planId, period, email: payerEmail }),
      });
      window.location.assign(result.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao abrir a assinatura");
      setBusy(false);
    }
  }

  async function cancelSubscription() {
    if (!confirm("Cancelar a renovação no cartão? Seu plano continua até o fim do período já pago.")) return;
    setBusy(true);
    setError("");
    try {
      const r = await api<{ renewsAt: string }>("/api/billing/subscription/cancel", { method: "POST" });
      setNote(`Renovação cancelada. Seu plano vale até ${fmtDate(r.renewsAt)}.`);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao cancelar");
    } finally {
      setBusy(false);
    }
  }

  async function chooseFree(planId: string) {
    setBusy(true);
    setError("");
    setNote("");
    try {
      await api("/api/billing/subscribe", { method: "POST", body: JSON.stringify({ planId }) });
      setNote("Você está no plano grátis.");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
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
          <Card>
            <p className="text-xs uppercase text-muted">Receita confirmada</p>
            <p className="mt-1 text-3xl font-bold text-accent">{brl(data.revenue.total)}</p>
          </Card>
          <Card>
            <p className="text-xs uppercase text-muted">Planos pagos vigentes (valor mensal)</p>
            <p className="mt-1 text-3xl font-bold">{brl(data.revenue.mrr)}</p>
          </Card>
          <Card>
            <p className="text-xs uppercase text-muted">Bloqueio de IA por saldo</p>
            <div className="mt-2 flex items-center gap-2">
              <Button variant={data.enforced ? "danger" : "ghost"} onClick={toggleEnforce}>
                {data.enforced ? "Ligado para todos" : "Só planos grátis"}
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted">
              Planos grátis param quando os coins acabam, sempre. Ligado, vale também para planos pagos e para a agência da
              casa. Com BILLING_ENFORCED=true no servidor, fica sempre ligado.
            </p>
          </Card>
        </div>
        <Card>
          <p className="text-sm text-muted">
            Usuários, planos, coins, pagamentos e reprocessamento ficam no{" "}
            <Link href="/admin" className="text-accent hover:underline">
              painel do admin
            </Link>
            .
          </p>
        </Card>
      </div>
    );
  }

  const current = data.plans?.find((p) => p.id === data.subscription?.planId) ?? data.plan;
  const currentPaid = Boolean(current && current.monthlyPrice > 0);
  const wanted = wantedPlan ? data.plans?.find((p) => p.id === wantedPlan && p.monthlyPrice > 0) : undefined;

  // ---------- Visão de conta (marca/profissional/agência) ----------
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">Planos & coins</h1>
          <p className="mt-1 text-sm text-muted" data-testid="plan-summary">
            Plano atual: <strong className="text-foreground">{current?.name}</strong>
            {currentPaid ? ` · pago até ${fmtDate(data.subscription?.renewsAt)}` : ` · cota renova em ${fmtDate(data.subscription?.renewsAt)}`}
          </p>
          <p className="text-sm text-muted">
            Carteira: <strong className="text-accent" data-testid="wallet-coins">{Math.floor(data.wallet?.coins ?? 0)} coins</strong>
            {" "}({Math.floor(data.wallet?.planCoins ?? 0)} da cota do mês + {Math.floor(data.wallet?.purchasedCoins ?? 0)} comprados)
            {" · "}uso no mês: {Math.round(data.usageThisMonth ?? 0)}
          </p>
        </div>
        {!data.purchaseBlocked && (
        <div className="flex flex-wrap gap-1 rounded-lg border border-edge bg-surface-2 p-1" role="group" aria-label="Período de pagamento">
          {Object.entries(data.periods).map(([key, p]) => (
            <button
              key={key}
              type="button"
              aria-pressed={period === key}
              onClick={() => setPeriod(key)}
              className={`rounded-md px-3 py-1.5 text-xs transition-colors ${period === key ? "bg-accent text-accent-ink" : "text-muted hover:text-foreground"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        )}
      </div>

      <p className={`rounded-md border border-edge bg-surface-2 px-3 py-2 text-xs text-muted ${data.purchaseBlocked ? "hidden" : ""}`}>
        Preços em reais (R$), cobrados pelo Mercado Pago.{" "}
        {sub?.available
          ? "Assinatura no cartão: renova sozinha no período escolhido; cancele quando quiser e o plano vale até o fim do período pago. Ou pague um período à vista (Pix, boleto ou cartão), sem renovação."
          : "Os planos são pagos por período (Pix, cartão ou boleto) e não renovam sozinhos: no fim do período a conta volta para o grátis."}{" "}
        Arrependimento em até 7 dias —{" "}
        <Link href="/reembolso" className="text-accent hover:underline">
          política de reembolso
        </Link>
        .
      </p>

      {returned && (
        <p role="status" className="rounded-md border border-accent/40 bg-accent/5 px-3 py-2 text-sm text-accent">
          {returned}
        </p>
      )}
      {note && (
        <p role="status" className="rounded-md border border-accent/40 bg-accent/5 px-3 py-2 text-sm text-accent">
          {note}
        </p>
      )}
      {error && <ErrorBox message={error} />}

      {sub?.recurring && (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-accent/60" data-testid="subscription-status">
          <div>
            <p className="flex items-center gap-2 font-medium">
              <Icon name="money" size={16} className="text-accent" /> Assinatura no cartão (Mercado Pago)
            </p>
            <p className="mt-1 text-sm text-muted">
              {sub.cancelAtPeriodEnd
                ? `Cancelada — o plano vale até ${fmtDate(sub.renewsAt)} e depois volta para o grátis.`
                : `Próxima cobrança em ${fmtDate(sub.renewsAt)}. Sem fidelidade: cancele quando quiser.`}
            </p>
          </div>
          {!sub.cancelAtPeriodEnd && (
            <Button variant="ghost" onClick={cancelSubscription} disabled={busy} data-testid="subscription-cancel">
              Cancelar renovação
            </Button>
          )}
        </Card>
      )}

      {askEmail && (
        <Card className="space-y-2 border-accent" data-testid="subscription-email">
          <p className="text-sm">Qual e-mail você usa no Mercado Pago? A assinatura fica ligada a ele.</p>
          <div className="flex flex-wrap gap-2">
            <div className="min-w-56 flex-1">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@exemplo.com" aria-label="E-mail do Mercado Pago" />
            </div>
            <Button
              disabled={busy || !email.includes("@")}
              onClick={() => {
                const planId = askEmail;
                setAskEmail(null);
                void subscribe(planId);
              }}
            >
              Continuar
            </Button>
          </div>
        </Card>
      )}

      {data.purchaseBlocked && (
        <Card data-testid="purchase-blocked">
          <p className="text-sm">{data.purchaseBlocked}</p>
        </Card>
      )}

      {wanted && !returned && !data.purchaseBlocked && (
        <Card className="border-accent" data-testid="checkout-continue">
          <p className="text-sm text-muted">Plano escolhido</p>
          <p className="mt-1 text-lg font-semibold">
            {wanted.name} · {periodInfo.label} · {brl(priceFor(wanted.monthlyPrice))}
          </p>
          <Button className="mt-3" disabled={busy} onClick={() => checkout({ kind: "plan", planId: wanted.id, period })}>
            {busy ? "Abrindo o pagamento..." : "Continuar para o pagamento"}
          </Button>
        </Card>
      )}

      {!data.purchaseBlocked && (
      <>
      <div className="grid gap-4 md:grid-cols-3">
        {data.plans?.map((plan) => {
          const isCurrent = current?.id === plan.id;
          const free = plan.monthlyPrice === 0;
          return (
            <Card key={plan.id} hover className={`relative flex flex-col ${plan.recommended ? "border-accent" : ""}`}>
              {plan.recommended && (
                <span className="absolute -top-2.5 left-4 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-ink">
                  RECOMENDADO
                </span>
              )}
              <p className="text-sm font-semibold uppercase tracking-wide text-muted">{plan.name}</p>
              <p className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold">
                {free ? "Grátis" : brl(priceFor(plan.monthlyPrice))}
                {!free && (
                  <span className="text-sm font-normal text-muted">
                    /{periodInfo.months === 1 ? "mês" : `${periodInfo.months} meses`}
                  </span>
                )}
              </p>
              <div className="mt-1">
                <Tag>{plan.unlimited ? "IA sem cota (uso justo)" : QUALITY_LABEL[plan.quality]}</Tag>
              </div>
              <ul className="mt-4 flex-1 space-y-1.5 text-sm text-muted">
                {plan.highlights.map((h) => (
                  <li key={h} className="flex items-start gap-1.5">
                    <Icon name="check" size={14} className="mt-0.5 shrink-0 text-accent" /> {h}
                  </li>
                ))}
              </ul>
              {!free && sub?.available && !(isCurrent && sub.recurring && !sub.cancelAtPeriodEnd) && (
                <Button className="mt-4 w-full" disabled={busy} onClick={() => subscribe(plan.id)} data-testid={`subscribe-${plan.id}`}>
                  {periodInfo.months === 1 ? "Assinar no cartão · mensal" : `Assinar no cartão · a cada ${periodInfo.months} meses`}
                </Button>
              )}
              <Button
                className={`${!free && sub?.available ? "mt-2" : "mt-4"} w-full`}
                variant={(isCurrent && free) || (!free && sub?.available) ? "ghost" : "primary"}
                disabled={busy || (isCurrent && free)}
                onClick={() => (free ? chooseFree(plan.id) : checkout({ kind: "plan", planId: plan.id, period }))}
                data-testid={`plan-${plan.id}`}
              >
                {free
                  ? isCurrent
                    ? "Plano atual"
                    : "Voltar ao grátis"
                  : sub?.available
                    ? "Pagar o período à vista (Pix/boleto)"
                    : isCurrent
                      ? `Pagar mais ${periodInfo.label.split(" ")[0].toLowerCase()}`
                      : "Pagar e ativar"}
              </Button>
            </Card>
          );
        })}
      </div>

      <Card>
        <SectionTitle>
          <span className="flex items-center gap-1.5">
            <Icon name="sparkle" size={15} /> Coins avulsos
          </span>
        </SectionTitle>
        <p className="mb-3 text-sm text-muted">
          Cada ação de IA consome coins; ações que falham não são cobradas. Coins comprados não expiram.
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
              <Button className="mt-2 w-full" variant="ghost" disabled={busy} onClick={() => checkout({ kind: "coins", packId: pack.id })}>
                Comprar
              </Button>
            </div>
          ))}
        </div>
      </Card>
      </>
      )}
    </div>
  );
}
