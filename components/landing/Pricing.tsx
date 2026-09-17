"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons";
import {
  COIN_PACKS,
  PERIOD_DISCOUNT,
  periodPrice,
  listedPlansFor,
  type AccountType,
  type BillingPeriod,
} from "@/lib/plans";
import { fmtMoney } from "@/lib/i18n";

type Lang = "pt" | "en";

const L = {
  pt: {
    title: "Planos e preços",
    sub: "Comece grátis, sem cartão. Planos pré-pagos: você paga o período escolhido e ele não renova sozinho.",
    prepaid: "Preços em reais (R$). Pré-pago, sem renovação automática; no fim do período a conta volta para o plano grátis. Arrependimento em 7 dias.",
    per: (m: number) => (m === 1 ? "/mês" : `/${m} meses`),
    free: "Grátis",
    current: "Selecionar",
    subscribe: "Contratar",
    recommended: "MAIS ESCOLHIDO",
    coinsTitle: "Prefere pagar só pelo uso?",
    coinsSub: "Compre coins avulsos e gaste quando quiser. Coins comprados não expiram.",
    coins: "coins",
    bonus: "com bônus",
    buy: "Comprar",
    pay: "Pagamento seguro via",
    quality: { economy: "IA econômica", balanced: "IA balanceada", premium: "IA premium (Opus)" } as Record<string, string>,
    unlimited: "IA sem cota (uso justo)",
  },
  en: {
    title: "Plans & pricing",
    sub: "Start free, no card. Prepaid plans: you pay for the period you choose and it never renews on its own.",
    prepaid: "Prices in Brazilian reais (BRL, R$), charged in BRL. Prepaid, no auto-renewal; when the period ends the account returns to the free plan. 7-day refund window.",
    per: (m: number) => (m === 1 ? "/mo" : `/${m} mo`),
    free: "Free",
    current: "Select",
    subscribe: "Get this plan",
    recommended: "MOST POPULAR",
    coinsTitle: "Prefer pay-as-you-go?",
    coinsSub: "Buy coins and spend them whenever you want. Purchased coins do not expire.",
    coins: "coins",
    bonus: "with bonus",
    buy: "Buy",
    pay: "Secure payment via",
    quality: { economy: "Economy AI", balanced: "Balanced AI", premium: "Premium AI (Opus)" } as Record<string, string>,
    unlimited: "No coin quota (fair use)",
  },
};

export default function Pricing({
  accountType,
  lang,
}: {
  accountType: AccountType;
  lang: Lang;
}) {
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const t = L[lang];
  const brl = (n: number) => fmtMoney(n, lang);
  const plans = listedPlansFor(accountType);
  const hasPaid = plans.some((p) => p.monthlyPrice > 0);

  return (
    <section className="border-t border-edge px-4 py-24" id="planos">
      <div className="mx-auto max-w-6xl">
        <div className="reveal mx-auto max-w-2xl text-center">
          <h2 className="font-[family-name:var(--font-display)] text-4xl font-extrabold tracking-tight">
            {t.title}
          </h2>
          <p className="mt-4 text-muted">{t.sub}</p>
        </div>

        {/* Toggle de período (só faz sentido com plano pago) */}
        <div className={`reveal mt-8 flex justify-center ${hasPaid ? "" : "hidden"}`}>
          <div className="inline-flex flex-wrap justify-center gap-1 rounded-full border border-edge bg-surface-2 p-1">
            {(Object.keys(PERIOD_DISCOUNT) as BillingPeriod[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  period === p ? "bg-accent text-accent-ink" : "text-muted hover:text-foreground"
                }`}
              >
                {PERIOD_DISCOUNT[p].label}
              </button>
            ))}
          </div>
        </div>

        {/* Cards de plano */}
        <div className={`reveal mt-12 grid gap-6 ${plans.length >= 3 ? "lg:grid-cols-3" : "sm:grid-cols-2 lg:max-w-3xl lg:mx-auto"}`}>
          {plans.map((plan) => {
            const total = periodPrice(plan.monthlyPrice, period);
            return (
              <div
                key={plan.id}
                className={`card-hover relative flex flex-col rounded-2xl border bg-surface p-7 ${
                  plan.recommended ? "border-accent shadow-xl shadow-accent/10" : "border-edge"
                }`}
              >
                {plan.recommended && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-1 text-[10px] font-bold tracking-wide text-accent-ink">
                    {t.recommended}
                  </span>
                )}
                <p className="text-sm font-semibold uppercase tracking-wide text-muted">{plan.name}</p>
                <p className="mt-3 font-[family-name:var(--font-display)] text-4xl font-extrabold">
                  {plan.monthlyPrice === 0 ? (
                    t.free
                  ) : (
                    <>
                      {brl(total)}
                      <span className="text-base font-normal text-muted">
                        {t.per(PERIOD_DISCOUNT[period].months)}
                      </span>
                    </>
                  )}
                </p>
                <span className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-full border border-edge bg-surface-2 px-2.5 py-0.5 text-xs text-muted">
                  <Icon name="sparkle" size={12} className="text-accent" />
                  {plan.unlimited ? t.unlimited : t.quality[plan.quality]}
                </span>
                <ul className="mt-5 flex-1 space-y-2 text-sm">
                  {plan.highlights.map((h) => (
                    <li key={h} className="flex items-start gap-2 text-muted">
                      <Icon name="check" size={15} className="mt-0.5 shrink-0 text-accent" />
                      {h}
                    </li>
                  ))}
                </ul>
                <Link
                  href={
                    plan.monthlyPrice === 0
                      ? `/criar-conta?type=${accountType}`
                      : `/criar-conta?type=${accountType}&plan=${plan.id}&period=${period}`
                  }
                  data-testid={`pricing-cta-${plan.id}`}
                  data-track="cta_click"
                  data-track-label={plan.id}
                  className={`mt-6 inline-flex items-center justify-center gap-1.5 rounded-xl px-5 py-3 font-semibold transition-transform hover:-translate-y-0.5 ${
                    plan.recommended
                      ? "bg-accent text-accent-ink shadow-lg shadow-accent/20"
                      : "border border-edge bg-surface-2 hover:border-accent"
                  }`}
                >
                  {plan.monthlyPrice === 0 ? t.current : t.subscribe}
                </Link>
              </div>
            );
          })}
        </div>

        {/* Coins on-demand */}
        <div className="reveal mt-10 rounded-2xl border border-edge bg-surface p-7">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold">{t.coinsTitle}</h3>
              <p className="mt-1 text-sm text-muted">{t.coinsSub}</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {COIN_PACKS.map((pack) => (
              <div key={pack.id} className="rounded-xl border border-edge bg-surface-2 p-4 text-center">
                <p className="font-[family-name:var(--font-display)] text-2xl font-bold text-accent">
                  {pack.coins}
                  {pack.bonus > 0 && <span className="text-sm text-emerald-500"> +{pack.bonus}</span>}
                </p>
                <p className="text-xs text-muted">
                  {t.coins}
                  {pack.bonus > 0 && ` (${t.bonus})`}
                </p>
                <p className="mt-2 text-lg font-semibold">{brl(pack.price)}</p>
                <Link
                  href={`/criar-conta?type=${accountType}`}
                  className="mt-3 inline-block rounded-lg border border-edge px-4 py-1.5 text-sm transition-colors hover:border-accent"
                >
                  {t.buy}
                </Link>
              </div>
            ))}
          </div>
        </div>

        <p className="reveal mx-auto mt-6 max-w-2xl text-center text-xs text-muted">{t.prepaid}</p>

        {/* Métodos de pagamento (confiança) */}
        <div className="reveal mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Icon name="check" size={14} className="text-accent" /> {t.pay}
          </span>
          {["Pix", "Visa", "Mastercard", "Elo", "Boleto"].map((m) => (
            <span key={m} className="rounded-md border border-edge bg-surface-2 px-3 py-1 text-xs font-semibold">
              {m}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
