import { NextResponse } from "next/server";
import { listPayments, listTransactions, platformRevenue } from "@/lib/billing-db";
import { guard, isDenied } from "@/lib/guard";

// Pagamentos do Mercado Pago e lançamentos recentes (admin).
export async function GET() {
  const auth = await guard(["admin"]);
  if (isDenied(auth)) return auth;
  return NextResponse.json({
    payments: listPayments({ limit: 200 }),
    transactions: listTransactions({ limit: 100 }),
    revenue: platformRevenue(),
  });
}
