"use client";

import { useState } from "react";
import Link from "next/link";
import { buttonClass } from "@/components/ui";
import {
  ACTION_COST,
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
    subCard: "Comece grátis, sem cartão. Depois, assine no cartão ou pague um período à vista.",
    card: "Assinatura mensal no cartão pelo Mercado Pago · cancele quando quiser, vale até o fim do período.",
    prepaidCard: "Preços em reais (R$). Prefere não assinar? Pague 1, 3, 6 ou 12 meses à vista (Pix, cartão ou boleto), sem renovação; no fim do período a conta volta para o plano grátis. Arrependimento em 7 dias.",
    costsTitle: "Quanto custa cada ação de IA",
    costsSub: "Preço fixo em coins, sempre o mesmo:",
    costs: {
      strategy_analysis: "Estratégia e deep dive",
      campaign_30d: "30 dias de posts",
      carousel: "Carrossel",
      ai_radar: "Radar de IA (rodada semanal)",
      panel_test: "Teste com o público",
      brand_voice_check: "Checagem da voz da marca",
    } as Record<string, string>,
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
    subCard: "Start free, no card. Later, subscribe by card or prepay a period.",
    card: "Monthly card subscription through Mercado Pago · cancel anytime, it lasts until the end of the period.",
    prepaidCard: "Prices in Brazilian reais (R$), billed in BRL. Rather not subscribe? Prepay 1, 3, 6 or 12 months (Pix, card or boleto) with no renewal; when the period ends the account returns to the free plan. 7-day refund window.",
    costsTitle: "What each AI action costs",
    costsSub: "A fixed price in coins, always the same:",
    costs: {
      strategy_analysis: "Strategy and deep dive",
      campaign_30d: "30 days of posts",
      carousel: "Carousel",
      ai_radar: "AI radar (weekly run)",
      panel_test: "Audience test",
      brand_voice_check: "Brand voice check",
    } as Record<string, string>,
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
  cardSubscription = false,
}: {
  accountType: AccountType;
  lang: Lang;
  cardSubscription?: boolean;
}) {
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const t = L[lang];
  const brl = (n: number) => fmtMoney(n, lang);
  const plans = listedPlansFor(accountType);
  const hasPaid = plans.some((p) => p.monthlyPrice > 0);

  return (
    // Tabela de preço editorial: colunas separadas por régua, sem cartão e sem
    // sombra, preço em figura tabular. A marca aparece UMA vez — no CTA do
    // plano recomendado (§5.5) — e o recomendado se distingue por peso de
    // régua e por um olho, não por cor.
    <section className="sec border-t border-rule" id="planos">
      <div className="ed">
        <div className="ed-grid">
          <div className="c5 reveal">
            <h2 className="d3">{t.title}</h2>
          </div>
          <div className="c7 reveal">
            <p className="t2 measure-prose text-text-muted">{cardSubscription ? t.subCard : t.sub}</p>
            {cardSubscription && hasPaid && (
              <p className="t5 measure-prose mt-3 text-text-muted" data-testid="pricing-card-line">
                {t.card}
              </p>
            )}
          </div>
        </div>

        {/* Período: controle segmentado, régua de 1px entre os passos */}
        <div className={`reveal mt-10 ${hasPaid ? "" : "hidden"}`}>
          <div className="inline-flex overflow-hidden rounded-sm border border-edge">
            {(Object.keys(PERIOD_DISCOUNT) as BillingPeriod[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                aria-pressed={period === p}
                className={`t5 h-9 border-r border-rule px-4 font-medium transition-colors duration-[var(--dur-1)] last:border-r-0 ${
                  period === p ? "bg-text text-canvas" : "text-text-muted hover:bg-surface-sunken"
                }`}
              >
                {PERIOD_DISCOUNT[p].label}
              </button>
            ))}
          </div>
        </div>

        {/* Colunas de plano */}
        <div
          // Uma coluna por plano: com quatro planos e três colunas o último
          // caía sozinho numa segunda linha, sem régua à direita e sem par.
          className="reveal mt-10 grid border-t border-edge sm:grid-cols-2"
          style={{ ["--plan-cols" as string]: plans.length }}
        >
          {plans.map((plan) => {
            const total = periodPrice(plan.monthlyPrice, period);
            return (
              <div
                key={plan.id}
                className="plan-col flex flex-col border-b border-rule py-7"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="t5 font-medium">{plan.name}</p>
                  {plan.recommended && <p className="t6 text-text-muted">{t.recommended}</p>}
                </div>
                <p className="n1 mt-4">
                  {plan.monthlyPrice === 0 ? (
                    t.free
                  ) : (
                    <>
                      {brl(total)}
                      <span className="t5 font-normal text-text-muted">
                        {t.per(PERIOD_DISCOUNT[period].months)}
                      </span>
                    </>
                  )}
                </p>
                <p className="t5 mt-2 border-t border-rule pt-2 text-text-muted">
                  {plan.unlimited ? t.unlimited : t.quality[plan.quality]}
                </p>
                <ul className="mt-5 flex-1">
                  {plan.highlights.map((h) => (
                    <li key={h} className="t4 measure-prose border-b border-rule py-2 text-text-muted">
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
                  className={`${buttonClass(plan.recommended ? "primary" : "secondary")} mt-6 w-full`}
                >
                  {plan.monthlyPrice === 0 ? t.current : t.subscribe}
                </Link>
              </div>
            );
          })}
        </div>

        {/* Coins avulsos + custo por ação: split doc (7+5) */}
        <div className="ed-grid mt-16">
          <div className="c7 reveal">
            <h3 className="d4">{t.coinsTitle}</h3>
            <p className="t3 measure-prose mt-2 text-text-muted">{t.coinsSub}</p>
            <table className="mt-5 w-full table-fixed border-collapse text-left">
              <thead>
                <tr className="border-b border-edge">
                  <th className="t5 pb-2 text-text-muted">{t.coins}</th>
                  <th className="t5 pb-2 text-right text-text-muted">R$</th>
                  <th className="t5 pb-2 text-right text-text-muted" />
                </tr>
              </thead>
              <tbody>
                {COIN_PACKS.map((pack) => (
                  <tr key={pack.id} className="border-b border-rule">
                    <td className="n3 py-3">
                      {pack.coins}
                      {pack.bonus > 0 && (
                        <span className="t5 ml-2 font-normal text-positive">
                          +{pack.bonus} {t.bonus}
                        </span>
                      )}
                    </td>
                    <td className="n3 py-3 text-right">{brl(pack.price)}</td>
                    <td className="py-3 text-right">
                      <Link
                        href={`/criar-conta?type=${accountType}`}
                        className="t5 inline-flex min-h-10 items-center font-medium underline-offset-4 hover:underline"
                      >
                        {t.buy}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="c5 reveal" data-testid="pricing-action-costs">
            <h3 className="d4">{t.costsTitle}</h3>
            <p className="t3 measure-prose mt-2 text-text-muted">{t.costsSub}</p>
            <dl className="mt-5 border-t border-edge">
              {Object.entries(t.costs).map(([action, label]) => (
                <div key={action} className="flex items-baseline justify-between gap-4 border-b border-rule py-2">
                  <dt className="t4 min-w-0 flex-1 truncate text-text-muted">{label}</dt>
                  <dd className="n3 shrink-0">{`${ACTION_COST[action]} ${t.coins}`}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <div className="ed-grid mt-12">
          <p className="c7 t5 measure-prose reveal text-text-muted">
            {cardSubscription ? t.prepaidCard : t.prepaid}
          </p>
          <div className="c5 reveal flex flex-wrap items-baseline gap-x-4 gap-y-2">
            <span className="t6 text-text-muted">{t.pay}</span>
            {["Pix", "Visa", "Mastercard", "Elo", "Boleto"].map((m) => (
              <span key={m} className="t5 font-medium">
                {m}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
