// Integração Mercado Pago (Checkout Pro): cobra coins (avulso) e planos
// (por período) em Pix, cartão ou boleto. A confirmação vem por webhook
// (/api/webhooks/mercadopago), que credita/ativa de verdade.
//
// Credenciais em env (nunca no código): MP_ACCESS_TOKEN (obrigatório).
// Recorrência automática (preapproval/Pix Automático) é o próximo passo.

import { getCoinPack, getPlan, periodPrice, PERIOD_DISCOUNT, type BillingPeriod } from "./plans";
import type { AccountType } from "./plans";

const BASE = "https://api.mercadopago.com";
const TOKEN = process.env.MP_ACCESS_TOKEN || "";
const APP_URL = process.env.APP_URL || "https://marqa.online";

export function mpConfigured(): boolean {
  return TOKEN.length > 0;
}

async function mp(path: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const res = await fetch(BASE + path, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error((data?.message as string) ?? `Mercado Pago ${res.status}`);
  }
  return data;
}

const backUrls = {
  success: `${APP_URL}/plans?pago=1`,
  failure: `${APP_URL}/plans?falhou=1`,
  pending: `${APP_URL}/plans?pendente=1`,
};

// Cria o checkout de um pacote de coins. external_reference carrega a conta e
// o pacote para o webhook creditar depois.
export async function createCoinCheckout(input: {
  accountType: AccountType;
  accountId: string;
  packId: string;
  email?: string;
}): Promise<{ url: string; preferenceId: string }> {
  const pack = getCoinPack(input.packId);
  if (!pack) throw new Error("Pacote inválido");
  const total = pack.coins + pack.bonus;
  const pref = await mp("/checkout/preferences", {
    method: "POST",
    body: JSON.stringify({
      items: [
        {
          title: `${total} coins — Marqa`,
          quantity: 1,
          unit_price: pack.price,
          currency_id: "BRL",
        },
      ],
      external_reference: `coins|${input.accountType}|${input.accountId}|${pack.id}`,
      ...(input.email ? { payer: { email: input.email } } : {}),
      back_urls: backUrls,
      auto_return: "approved",
      notification_url: `${APP_URL}/api/webhooks/mercadopago`,
    }),
  });
  return { url: pref.init_point as string, preferenceId: pref.id as string };
}

// Cria o checkout de um plano para o período escolhido (pagamento do período).
export async function createPlanCheckout(input: {
  accountType: AccountType;
  accountId: string;
  planId: string;
  period: BillingPeriod;
  email?: string;
}): Promise<{ url: string; preferenceId: string }> {
  const plan = getPlan(input.planId);
  if (!plan || plan.accountType !== input.accountType) throw new Error("Plano inválido");
  const months = PERIOD_DISCOUNT[input.period].months;
  const total = periodPrice(plan.monthlyPrice, input.period);
  if (total <= 0) throw new Error("Plano grátis não precisa de pagamento");
  const pref = await mp("/checkout/preferences", {
    method: "POST",
    body: JSON.stringify({
      items: [
        {
          title: `Plano ${plan.name} · ${months}m — Marqa`,
          quantity: 1,
          unit_price: total,
          currency_id: "BRL",
        },
      ],
      external_reference: `plan|${input.accountType}|${input.accountId}|${plan.id}|${input.period}`,
      ...(input.email ? { payer: { email: input.email } } : {}),
      back_urls: backUrls,
      auto_return: "approved",
      notification_url: `${APP_URL}/api/webhooks/mercadopago`,
    }),
  });
  return { url: pref.init_point as string, preferenceId: pref.id as string };
}

export type MpPayment = {
  id: number;
  status: string;
  external_reference?: string;
  transaction_amount?: number;
};

export async function getPayment(id: string): Promise<MpPayment> {
  return (await mp(`/v1/payments/${id}`)) as unknown as MpPayment;
}
