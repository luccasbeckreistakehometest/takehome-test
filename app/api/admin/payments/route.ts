import { NextResponse } from "next/server";
import { listPayments, listTransactions, platformRevenue } from "@/lib/billing-db";
import { guard, isDenied } from "@/lib/guard";

// Pagamentos do Mercado Pago e lançamentos recentes (admin). ?agency=<id> filtra.
export async function GET(request: Request) {
  const auth = await guard(["admin"]);
  if (isDenied(auth)) return auth;
  const agencyId = new URL(request.url).searchParams.get("agency") || null;
  return NextResponse.json({
    payments: listPayments({ agencyId, limit: 200 }),
    transactions: listTransactions({ agencyId, limit: 100 }),
    revenue: platformRevenue(agencyId),
  });
}
