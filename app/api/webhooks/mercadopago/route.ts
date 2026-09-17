import { NextResponse } from "next/server";
import { getPayment, mpConfigured } from "@/lib/mercadopago";
import { applyMpPayment, recordPaymentLookupFailure } from "@/lib/billing-db";
import { checkLimits, clientIp } from "@/lib/rate-limit";

export const maxDuration = 60;

// Webhook do Mercado Pago. A notificação só traz o id: a verdade vem da API do
// MP (relida com o nosso token), então notificação forjada não credita nada.
// - aprovado → credita coins / ativa o plano (marca + crédito numa transação)
// - estornado / chargeback → desfaz o crédito
// - consulta ao MP falhou → 502, para o MP reenviar depois
export async function POST(request: Request) {
  if (!checkLimits([["webhookPerIp", clientIp(request)]]).ok) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }
  const url = new URL(request.url);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  // MP manda o id de formas diferentes: body.data.id, ?data.id=, ?id=
  const dataId = String(
    (body?.data as { id?: string | number } | undefined)?.id ??
      url.searchParams.get("data.id") ??
      url.searchParams.get("id") ??
      ""
  ).trim();
  const type = String(body?.type ?? body?.topic ?? url.searchParams.get("type") ?? url.searchParams.get("topic") ?? "");
  // Só eventos de pagamento interessam (merchant_order etc. são ignorados).
  if (!dataId || (type && type !== "payment") || !/^\d{1,30}$/.test(dataId)) {
    return NextResponse.json({ ok: true, ignored: true });
  }
  if (!mpConfigured()) {
    console.error("[mp] webhook recebido sem MP_ACCESS_TOKEN configurado");
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }
  let payment;
  try {
    payment = await getPayment(dataId);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(`[mp] consulta do pagamento ${dataId} falhou: ${detail}`);
    recordPaymentLookupFailure(dataId, detail);
    return NextResponse.json({ error: "lookup failed" }, { status: 502 });
  }
  try {
    const outcome = applyMpPayment({
      id: String(payment.id),
      status: payment.status,
      externalReference: payment.external_reference ?? "",
      amount: Number(payment.transaction_amount ?? 0),
    });
    if (outcome === "invalid") console.error(`[mp] pagamento ${payment.id} não pôde ser creditado (ver admin)`);
    return NextResponse.json({ ok: true, outcome });
  } catch (error) {
    console.error(`[mp] falha ao aplicar pagamento ${dataId}:`, error);
    return NextResponse.json({ error: "apply failed" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
