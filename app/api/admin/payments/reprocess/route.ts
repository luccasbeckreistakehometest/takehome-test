import { NextResponse } from "next/server";
import { z } from "zod";
import { applyMpPayment, recordPaymentLookupFailure } from "@/lib/billing-db";
import { getPayment, mpConfigured } from "@/lib/mercadopago";
import { guard, isDenied } from "@/lib/guard";

// "Reprocessar pagamento": relê o pagamento no Mercado Pago e aplica o estado
// (idempotente). Para quando o webhook falhou ou chegou antes da hora.
export async function POST(request: Request) {
  const auth = await guard(["admin"]);
  if (isDenied(auth)) return auth;
  const parsed = z.object({ paymentId: z.string().trim().regex(/^\d{1,30}$/, "Id do pagamento: só números") }).safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  if (!mpConfigured()) return NextResponse.json({ error: "MP_ACCESS_TOKEN não configurado." }, { status: 503 });
  try {
    const payment = await getPayment(parsed.data.paymentId);
    const outcome = applyMpPayment({
      id: String(payment.id),
      status: payment.status,
      externalReference: payment.external_reference ?? "",
      amount: Number(payment.transaction_amount ?? 0),
    });
    return NextResponse.json({ ok: true, outcome, mpStatus: payment.status });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    recordPaymentLookupFailure(parsed.data.paymentId, detail);
    return NextResponse.json({ error: `Mercado Pago: ${detail}` }, { status: 502 });
  }
}
