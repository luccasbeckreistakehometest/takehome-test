// Integração Mercado Pago (Checkout Pro): cobra coins (avulso) e planos
// (por período) em Pix, cartão ou boleto. A confirmação vem por webhook
// (/api/webhooks/mercadopago), que credita/ativa de verdade.
//
// Credenciais em env (nunca no código): MP_ACCESS_TOKEN (obrigatório).
// Planos: pré-pagos por período (Checkout Pro) ou assinatura no cartão com
// renovação automática (preapproval, abaixo). Pix Automático fica para depois.

import { getCoinPack, getPlan, periodPrice, PERIOD_DISCOUNT, type BillingPeriod } from "./plans";
import type { AccountType } from "./plans";
import { appBaseUrl } from "./legal";
import { mpApi, mpFileTransport } from "./mp-transport";
import { subRef } from "./subscription-rules";

const BASE = "https://api.mercadopago.com";
const token = () => process.env.MP_ACCESS_TOKEN || "";

export function mpConfigured(): boolean {
  return token().length > 0;
}

async function mp(path: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const res = await fetch(BASE + path, {
    ...init,
    signal: AbortSignal.timeout(15_000),
    headers: {
      Authorization: `Bearer ${token()}`,
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

const backUrls = () => ({
  success: `${appBaseUrl()}/plans?pago=1`,
  failure: `${appBaseUrl()}/plans?falhou=1`,
  pending: `${appBaseUrl()}/plans?pendente=1`,
});
const notificationUrl = () => `${appBaseUrl()}/api/webhooks/mercadopago`;

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
      back_urls: backUrls(),
      auto_return: "approved",
      notification_url: notificationUrl(),
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
          title: `Plano ${plan.name} · ${months} ${months === 1 ? "mês" : "meses"} pré-pago (sem renovação automática) — Marqa`,
          quantity: 1,
          unit_price: total,
          currency_id: "BRL",
        },
      ],
      external_reference: `plan|${input.accountType}|${input.accountId}|${plan.id}|${input.period}`,
      ...(input.email ? { payer: { email: input.email } } : {}),
      back_urls: backUrls(),
      auto_return: "approved",
      notification_url: notificationUrl(),
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

// ---------- Assinatura recorrente (preapproval, sem plano associado) ----------
// Com plano associado o MP exige o token do cartão no nosso formulário; sem
// plano, a assinatura nasce "pending" e o cliente conclui no init_point.

export function subscriptionsAvailable(): boolean {
  return mpConfigured() || mpFileTransport();
}

export async function createRecurring(input: {
  accountType: AccountType;
  accountId: string;
  planId: string;
  period: BillingPeriod;
  amount: number;
  payerEmail: string;
}): Promise<{ id: string; initPoint: string; status: string }> {
  const plan = getPlan(input.planId);
  if (!plan) throw new Error("Plano inválido");
  const months = PERIOD_DISCOUNT[input.period].months;
  const data = await mpApi("POST", "/preapproval", {
    reason: `Marqa · Plano ${plan.name} (${months === 1 ? "mensal" : `a cada ${months} meses`})`,
    external_reference: subRef({ accountType: input.accountType, accountId: input.accountId, planId: plan.id, period: input.period }),
    payer_email: input.payerEmail,
    back_url: `${appBaseUrl()}/plans?sub=return`,
    status: "pending",
    auto_recurring: {
      frequency: months,
      frequency_type: "months",
      transaction_amount: input.amount,
      currency_id: "BRL",
    },
  });
  return { id: String(data.id), initPoint: String(data.init_point ?? ""), status: String(data.status ?? "pending") };
}

export async function cancelRecurring(preapprovalId: string): Promise<void> {
  await mpApi("PUT", `/preapproval/${encodeURIComponent(preapprovalId)}`, { status: "cancelled" });
}

export type MpPreapproval = { id: string; status: string; external_reference?: string };
export async function getPreapprovalRemote(id: string): Promise<MpPreapproval> {
  return (await mpApi("GET", `/preapproval/${encodeURIComponent(id)}`)) as unknown as MpPreapproval;
}

export type MpAuthorizedPayment = {
  id: string | number;
  preapproval_id: string;
  status?: string;
  transaction_amount?: number;
  currency_id?: string;
  external_reference?: string;
  payment?: { id?: string | number; status?: string } | null;
};
export async function getAuthorizedPayment(id: string): Promise<MpAuthorizedPayment> {
  return (await mpApi("GET", `/authorized_payments/${encodeURIComponent(id)}`)) as unknown as MpAuthorizedPayment;
}
