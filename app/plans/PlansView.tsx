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
        <h1 className="d3">Receita & planos</h1>
        <div className="grid gap-x-8 gap-y-5 border-y border-edge py-4 sm:grid-cols-3">
          <Card>
            <p className="t5 uppercase text-text-muted">Receita confirmada</p>
            <p className="mt-1 text-3xl font-bold text-text">{brl(data.revenue.total)}</p>
          </Card>
          <Card>
            <p className="t5 uppercase text-text-muted">Planos pagos vigentes (valor mensal)</p>
            <p className="mt-1 text-3xl font-bold">{brl(data.revenue.mrr)}</p>
          </Card>
          <Card>
            <p className="t5 uppercase text-text-muted">Bloqueio de IA por saldo</p>
            <div className="mt-2 flex items-center gap-2">
              <Button variant={data.enforced ? "danger" : "ghost"} onClick={toggleEnforce}>
                {data.enforced ? "Ligado para todos" : "Só planos grátis"}
              </Button>
            </div>
            <p className="mt-2 t5 text-text-muted">
              Planos grátis param quando os coins acabam, sempre. Ligado, vale também para planos pagos e para a agência da
              casa. Com BILLING_ENFORCED=true no servidor, fica sempre ligado.
            </p>
          </Card>
        </div>
        <Card>
          <p className="t3 text-text-muted">
            Usuários, planos, coins, pagamentos e reprocessamento ficam no{" "}
            <Link href="/admin" className="text-text hover:underline">
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
          <h1 className="d3">Planos & coins</h1>
          <p className="mt-1 t3 text-text-muted" data-testid="plan-summary">
            Plano atual: <strong className="text-text">{current?.name}</strong>
            {currentPaid ? ` · pago até ${fmtDate(data.subscription?.renewsAt)}` : ` · cota renova em ${fmtDate(data.subscription?.renewsAt)}`}
          </p>
          <p className="t3 text-text-muted">
            Carteira: <strong className="text-text" data-testid="wallet-coins">{Math.floor(data.wallet?.coins ?? 0)} coins</strong>
            {" "}({Math.floor(data.wallet?.planCoins ?? 0)} da cota do mês + {Math.floor(data.wallet?.purchasedCoins ?? 0)} comprados)
            {" · "}uso no mês: {Math.round(data.usageThisMonth ?? 0)}
          </p>
        </div>
        {!data.purchaseBlocked && (
        <div className="flex flex-wrap gap-1 rounded-lg border border-edge bg-surface-sunken p-1" role="group" aria-label="Período de pagamento">
          {Object.entries(data.periods).map(([key, p]) => (
            <button
              key={key}
              type="button"
              aria-pressed={period === key}
              onClick={() => setPeriod(key)}
              className={`rounded-md px-3 py-1.5 t5 transition-colors ${period === key ? "bg-text text-canvas" : "text-text-muted hover:text-text"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        )}
      </div>

      <p className={`rounded-md border border-edge bg-surface-sunken px-3 py-2 t5 text-text-muted ${data.purchaseBlocked ? "hidden" : ""}`}>
        Preços em reais (R$), cobrados pelo Mercado Pago.{" "}
        {sub?.available
          ? "Assinatura no cartão: renova sozinha no período escolhido; cancele quando quiser e o plano vale até o fim do período pago. Ou pague um período à vista (Pix, boleto ou cartão), sem renovação."
          : "Os planos são pagos por período (Pix, cartão ou boleto) e não renovam sozinhos: no fim do período a conta volta para o grátis."}{" "}
        Arrependimento em até 7 dias —{" "}
        <Link href="/reembolso" className="text-text hover:underline">
          política de reembolso
        </Link>
        .
      </p>

      {returned && (
        <p role="status" className="rounded-md border border-edge bg-surface-sunken px-3 py-2 t3 text-text">
          {returned}
        </p>
      )}
      {note && (
        <p role="status" className="rounded-md border border-edge bg-surface-sunken px-3 py-2 t3 text-text">
          {note}
        </p>
      )}
      {error && <ErrorBox message={error} />}

      {sub?.recurring && (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-edge" data-testid="subscription-status">
          <div>
            <p className="flex items-center gap-2 font-medium">
              <Icon name="money" size={16} className="text-text" /> Assinatura no cartão (Mercado Pago)
            </p>
            <p className="t3 measure-lede mt-2 text-text-muted">
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
        <Card className="space-y-2 border-edge" data-testid="subscription-email">
          <p className="t3">Qual e-mail você usa no Mercado Pago? A assinatura fica ligada a ele.</p>
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
          <p className="t3">{data.purchaseBlocked}</p>
        </Card>
      )}

      {wanted && !returned && !data.purchaseBlocked && (
        <Card className="border-edge" data-testid="checkout-continue">
          <p className="t3 text-text-muted">Plano escolhido</p>
          <p className="mt-1 d4 font-semibold">
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
            <Card key={plan.id} hover className={`relative flex flex-col ${plan.recommended ? "border-edge" : ""}`}>
              {plan.recommended && (
                <span className="absolute -top-2.5 left-4 rounded-xs bg-text px-2 py-0.5 text-[10px] font-medium text-canvas">
                  RECOMENDADO
                </span>
              )}
              <p className="t3 font-semibold uppercase tracking-wide text-text-muted">{plan.name}</p>
              <p className="d3 mt-2">
                {free ? "Grátis" : brl(priceFor(plan.monthlyPrice))}
                {!free && (
                  <span className="t3 font-normal text-text-muted">
                    /{periodInfo.months === 1 ? "mês" : `${periodInfo.months} meses`}
                  </span>
                )}
              </p>
              <div className="mt-1">
                <Tag>{plan.unlimited ? "IA sem cota (uso justo)" : QUALITY_LABEL[plan.quality]}</Tag>
              </div>
              <ul className="mt-4 flex-1 space-y-1.5 t3 text-text-muted">
                {plan.highlights.map((h) => (
                  <li key={h} className="flex items-start gap-1.5">
                    <Icon name="check" size={14} className="mt-0.5 shrink-0 text-text" /> {h}
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
        <p className="mb-3 t3 text-text-muted">
          Cada ação de IA consome coins; ações que falham não são cobradas. Coins comprados não expiram.
        </p>
        <div className="grid gap-x-8 gap-y-5 border-y border-edge py-4 sm:grid-cols-3">
          {data.packs.map((pack) => (
            <div key={pack.id} className="rounded-lg border border-edge bg-surface-sunken p-4 text-center">
              <p className="d3 text-text">
                {pack.coins}
                {pack.bonus > 0 && <span className="t3 text-positive"> +{pack.bonus}</span>}
              </p>
              <p className="t5 text-text-muted">coins{pack.bonus > 0 && " (com bônus)"}</p>
              <p className="mt-2 d4 font-semibold">{brl(pack.price)}</p>
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
