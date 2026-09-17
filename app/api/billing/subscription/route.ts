import { NextResponse } from "next/server";
import { z } from "zod";
import { billingAccount } from "@/lib/session";
import { guard, isDenied } from "@/lib/guard";
import { checkLimits, retryAfterHeader } from "@/lib/rate-limit";
import { getPlan, isPurchasablePlan, purchaseBlockReason } from "@/lib/plans";
import { ensurePlanPrice, listPreapprovals, recordPreapproval, getSubscription } from "@/lib/billing-db";
import { createRecurring, subscriptionsAvailable } from "@/lib/mercadopago";
import { getUserById, isValidEmail, normalizeEmail } from "@/lib/auth";

export const maxDuration = 60;

// Estado da assinatura no cartão da conta logada.
export async function GET() {
  const auth = await guard(["agency", "client", "professional"]);
  if (isDenied(auth)) return auth;
  const account = billingAccount(auth);
  if (!account) return NextResponse.json({ error: "Conta sem plano" }, { status: 400 });
  const sub = getSubscription(account.accountType, account.accountId);
  return NextResponse.json({
    available: subscriptionsAvailable(),
    recurring: Boolean(sub.recurring),
    cancelAtPeriodEnd: Boolean(sub.cancelAtPeriodEnd),
    mpStatus: sub.mpStatus ?? "",
    renewsAt: sub.renewsAt,
    planId: sub.planId,
    email: getUserById(auth.userId)?.email ?? "",
    pending: listPreapprovals({ ...account, limit: 5 }).filter((p) => p.status === "pending").map((p) => ({ planId: p.planId, period: p.period, createdAt: p.createdAt })),
  });
}

const schema = z.object({
  planId: z.string().max(40),
  period: z.enum(["monthly", "quarterly", "semiannual", "annual"]).default("monthly"),
  email: z.string().trim().max(200).optional(),
});

// Assinar no cartão: cria a autorização recorrente no Mercado Pago e devolve
// o endereço para o cliente concluir. O plano só liga com a 1ª cobrança
// aprovada (webhook).
export async function POST(request: Request) {
  const auth = await guard(["agency", "client", "professional"]);
  if (isDenied(auth)) return auth;
  const account = billingAccount(auth);
  if (!account) return NextResponse.json({ error: "Conta sem plano" }, { status: 400 });
  const blocked = purchaseBlockReason(auth);
  if (blocked) return NextResponse.json({ error: blocked, code: "not_for_sale" }, { status: 403 });
  const verdict = checkLimits([["checkoutPerAccount", auth.userId]]);
  if (!verdict.ok) return NextResponse.json({ error: "Muitas tentativas de pagamento. Espere um pouco." }, { status: 429, headers: retryAfterHeader(verdict) });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  const plan = getPlan(parsed.data.planId);
  if (!plan || plan.accountType !== account.accountType || !isPurchasablePlan(plan)) {
    return NextResponse.json({ error: "Plano inválido para esta conta" }, { status: 400 });
  }
  if (!subscriptionsAvailable()) {
    return NextResponse.json({ error: "O pagamento ainda não está disponível. Fale com o suporte." }, { status: 503 });
  }
  const email = normalizeEmail(parsed.data.email || getUserById(auth.userId)?.email || "");
  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: "Informe o e-mail da conta do Mercado Pago.", code: "email_required" }, { status: 400 });
  }
  const price = ensurePlanPrice(plan.id, parsed.data.period);
  try {
    const created = await createRecurring({ ...account, planId: plan.id, period: parsed.data.period, amount: price.amount, payerEmail: email });
    if (!created.initPoint) throw new Error("Mercado Pago não devolveu o endereço de pagamento");
    recordPreapproval({
      id: created.id,
      ...account,
      planId: plan.id,
      period: parsed.data.period,
      amount: price.amount,
      mpPlanRowId: price.id,
      status: created.status,
      payerEmail: email,
      initPoint: created.initPoint,
    });
    return NextResponse.json({ url: created.initPoint, preapprovalId: created.id });
  } catch (error) {
    console.error("[billing] assinatura falhou:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Não foi possível abrir a assinatura agora. Tente de novo em instantes." }, { status: 502 });
  }
}
