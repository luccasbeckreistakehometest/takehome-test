import { getKv, setKv } from "./kv-settings";
import { recurringSubscriptions } from "./billing-db";
import { logActivity } from "./marketplace-db";
import { getPlan } from "./plans";
import { subscriptionNotice } from "./subscription-rules";

// Aviso diário (sino) sobre a assinatura no cartão: cancelada que termina em
// até 3 dias, ou cobrança que não entrou (carência de 3 dias).
export function runSubscriptionNotices(now: Date = new Date()): number {
  const day = now.toISOString().slice(0, 10);
  const marker = getKv<{ day: string }>("subscription_notices_ran", { day: "" });
  if (marker.day === day) return 0;
  setKv("subscription_notices_ran", { day });
  let sent = 0;
  for (const sub of recurringSubscriptions()) {
    const notice = subscriptionNotice({ renewsAt: sub.renewsAt, recurring: Boolean(sub.recurring), cancelAtPeriodEnd: Boolean(sub.cancelAtPeriodEnd) }, now);
    if (!notice) continue;
    const plan = getPlan(sub.planId)?.name ?? sub.planId;
    const end = sub.renewsAt.slice(0, 10).split("-").reverse().join("/");
    const text =
      notice.kind === "ending_soon"
        ? `Sua assinatura ${plan} foi cancelada e termina em ${end}. Para continuar, assine de novo em Planos.`
        : `Não conseguimos cobrar a renovação do plano ${plan}. Confira o cartão no Mercado Pago: o acesso continua por mais ${notice.days} dia(s).`;
    const audience = sub.accountType === "agency" ? "agency" : sub.accountType === "client" ? "client" : "professional";
    logActivity({
      audience,
      text,
      href: "/plans",
      agencyId: sub.accountType === "agency" ? sub.accountId : null,
      clientId: sub.accountType === "client" ? sub.accountId : null,
      professionalId: sub.accountType === "professional" ? sub.accountId : null,
    });
    sent++;
  }
  return sent;
}
