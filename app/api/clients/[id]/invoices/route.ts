import { NextResponse } from "next/server";
import { guardClient, isDenied } from "@/lib/guard";
import { listInvoices } from "@/lib/invoices-db";
import { ALL_AGENCIES } from "@/lib/tenancy-rules";

type Context = { params: Promise<{ id: string }> };

// Faturas do cliente (portal): só as enviadas, com o link da página de pagamento.
export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guardClient(id, "view");
  if (isDenied(auth)) return auth;
  const invoices = listInvoices({ scope: ALL_AGENCIES, clientId: id, limit: 24 })
    .filter((i) => i.status !== "draft" && i.status !== "void")
    .map((i) => ({ id: i.id, month: i.month, total: i.total, dueDate: i.dueDate, state: i.state, token: i.token, paidAt: i.paidAt }));
  return NextResponse.json(invoices);
}
