import { NextResponse } from "next/server";
import { billingAccount } from "@/lib/session";
import { guard, isDenied } from "@/lib/guard";
import { getSubscription, markCancelAtPeriodEnd } from "@/lib/billing-db";
import { cancelRecurring } from "@/lib/mercadopago";

// Cancelar a renovação no cartão: nada mais é cobrado e o plano vale até o
// fim do período já pago.
export async function POST() {
  const auth = await guard(["agency", "client", "professional"]);
  if (isDenied(auth)) return auth;
  const account = billingAccount(auth);
  if (!account) return NextResponse.json({ error: "Conta sem plano" }, { status: 400 });
  const sub = getSubscription(account.accountType, account.accountId);
  if (!sub.recurring || !sub.mpPreapprovalId) return NextResponse.json({ error: "Não há assinatura no cartão para cancelar." }, { status: 409 });
  if (sub.cancelAtPeriodEnd) return NextResponse.json({ ok: true, renewsAt: sub.renewsAt, already: true });
  try {
    await cancelRecurring(sub.mpPreapprovalId);
  } catch (error) {
    console.error("[billing] cancelamento no MP falhou:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Não conseguimos cancelar no Mercado Pago agora. Tente de novo em instantes." }, { status: 502 });
  }
  const updated = markCancelAtPeriodEnd(account.accountType, account.accountId);
  return NextResponse.json({ ok: true, renewsAt: updated?.renewsAt ?? sub.renewsAt });
}
