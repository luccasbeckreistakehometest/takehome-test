import { NextResponse } from "next/server";
import { getPayment } from "@/lib/mercadopago";
import { addCoins, claimPayment, subscribe } from "@/lib/billing-db";
import { getCoinPack, getPlan, type AccountType, type BillingPeriod } from "@/lib/plans";

export const maxDuration = 60;

// Webhook do Mercado Pago: quando um pagamento é aprovado, credita coins ou
// ativa o plano de verdade. Idempotente (o MP reenvia o mesmo evento).
async function handle(paymentId: string) {
  if (!paymentId) return;
  const payment = await getPayment(paymentId).catch(() => null);
  if (!payment || payment.status !== "approved") return;
  if (!claimPayment(String(payment.id))) return; // já processado

  const ref = payment.external_reference ?? "";
  const parts = ref.split("|");
  const kind = parts[0];

  if (kind === "coins") {
    const [, accountType, accountId, packId] = parts;
    const pack = getCoinPack(packId);
    if (!pack) return;
    addCoins(
      accountType as AccountType,
      accountId,
      pack.coins + pack.bonus,
      `Compra de ${pack.coins}${pack.bonus ? ` +${pack.bonus}` : ""} coins [mp:${payment.id}]`,
      "coin_purchase",
      pack.price
    );
  } else if (kind === "plan") {
    const [, accountType, accountId, planId, period] = parts;
    const plan = getPlan(planId);
    if (!plan) return;
    subscribe({
      accountType: accountType as AccountType,
      accountId,
      planId,
      period: period as BillingPeriod,
    });
  }
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  // MP manda o id de formas diferentes: body.data.id, ?data.id=, ?id=
  const dataId =
    (body?.data as { id?: string } | undefined)?.id ??
    url.searchParams.get("data.id") ??
    url.searchParams.get("id") ??
    "";
  const type = (body?.type as string) ?? url.searchParams.get("type") ?? "";
  try {
    if (type === "payment" || dataId) await handle(String(dataId));
  } catch {
    // nunca falha o webhook (o MP re-tenta)
  }
  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
