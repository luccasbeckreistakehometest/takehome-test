// Assinatura recorrente no cartão (Mercado Pago "preapproval"), regras puras:
// referência externa, fim do período, carência e avisos.

import type { AccountType, BillingPeriod } from "./plans";

export const GRACE_DAYS = 3;
const DAY = 86_400_000;
const ACCOUNT_TYPES: AccountType[] = ["client", "professional", "agency"];
const PERIODS: BillingPeriod[] = ["monthly", "quarterly", "semiannual", "annual"];

export type SubRef = { accountType: AccountType; accountId: string; planId: string; period: BillingPeriod };

export function subRef(ref: SubRef): string {
  return `sub|${ref.accountType}|${ref.accountId}|${ref.planId}|${ref.period}`;
}

export function parseSubRef(value: string | null | undefined): SubRef | null {
  const parts = (value ?? "").split("|");
  if (parts.length !== 5 || parts[0] !== "sub") return null;
  const [, accountType, accountId, planId, period] = parts;
  if (!ACCOUNT_TYPES.includes(accountType as AccountType) || !accountId || !planId) return null;
  if (!PERIODS.includes(period as BillingPeriod)) return null;
  return { accountType: accountType as AccountType, accountId, planId, period: period as BillingPeriod };
}

export function addMonthsUtc(fromIso: string, months: number): string {
  const d = new Date(fromIso);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d.toISOString();
}

// Cada cobrança aprovada estende o período a partir do fim atual (se ainda
// vigente, ou dentro da carência) ou a partir de agora.
export function nextPeriodEnd(currentEnd: string | null, now: Date, months: number): string {
  const nowIso = now.toISOString();
  const graceLimit = currentEnd ? new Date(Date.parse(currentEnd) + GRACE_DAYS * DAY).toISOString() : null;
  const base = currentEnd && graceLimit && graceLimit > nowIso ? currentEnd : nowIso;
  return addMonthsUtc(base, months);
}

// Até quando o plano vale: com renovação automática ativa, fim + carência
// (a cobrança pode atrasar uns dias); cancelada ou pré-paga, o próprio fim.
export function accessUntil(input: { renewsAt: string; recurring: boolean; cancelAtPeriodEnd: boolean }): string {
  if (input.recurring && !input.cancelAtPeriodEnd) {
    return new Date(Date.parse(input.renewsAt) + GRACE_DAYS * DAY).toISOString();
  }
  return input.renewsAt;
}

export function subscriptionExpired(input: { renewsAt: string; recurring: boolean; cancelAtPeriodEnd: boolean }, now: Date): boolean {
  return accessUntil(input) <= now.toISOString();
}

// Estado do MP → o que fazer com a assinatura local.
export function preapprovalEffect(status: string): "active" | "cancel" | "none" {
  if (status === "authorized") return "active";
  if (status === "cancelled" || status === "paused") return "cancel";
  return "none";
}

// Pagamento recorrente aprovado? (o MP marca o pagamento dentro do registro)
export function authorizedPaymentApproved(record: { status?: unknown; payment?: { status?: unknown } | null }): boolean {
  const paymentStatus = String(record.payment?.status ?? "");
  if (paymentStatus) return paymentStatus === "approved";
  return String(record.status ?? "") === "processed";
}

export type SubNotice = { kind: "ending_soon" | "payment_late"; days: number };

// Aviso do dia (sino): cancelada termina em até 3 dias; renovação que não
// entrou (em carência).
export function subscriptionNotice(
  input: { renewsAt: string; recurring: boolean; cancelAtPeriodEnd: boolean },
  now: Date
): SubNotice | null {
  if (!input.recurring) return null;
  const end = Date.parse(input.renewsAt);
  const t = now.getTime();
  if (input.cancelAtPeriodEnd) {
    const days = Math.ceil((end - t) / DAY);
    return days >= 0 && days <= GRACE_DAYS ? { kind: "ending_soon", days } : null;
  }
  if (t >= end && t < end + GRACE_DAYS * DAY) {
    return { kind: "payment_late", days: Math.max(0, Math.ceil((end + GRACE_DAYS * DAY - t) / DAY)) };
  }
  return null;
}
