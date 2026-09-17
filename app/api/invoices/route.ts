import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, isDenied, tenantOf } from "@/lib/guard";
import { createDraftInvoice, listInvoices, receivablesSummary } from "@/lib/invoices-db";
import { invoicesCsv } from "@/lib/invoice-rules";

// Cobranças da agência: lista (ou CSV) e rascunho novo.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const clientId = url.searchParams.get("clientId") || undefined;
  const auth = await guard(["agency", "admin"], clientId ? { clientId } : {});
  if (isDenied(auth)) return auth;
  const scope = tenantOf(auth, request);
  const invoices = listInvoices({ scope, clientId, month: url.searchParams.get("month") || undefined });
  if (url.searchParams.get("format") === "csv") {
    const csv = invoicesCsv(invoices.map((i) => ({ clientName: i.clientName, month: i.month, total: i.total, dueDate: i.dueDate, state: i.state, paidAt: i.paidAt })));
    return new NextResponse(`﻿${csv}`, {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="cobrancas.csv"` },
    });
  }
  return NextResponse.json({ invoices, summary: receivablesSummary(scope) });
}

const schema = z.object({
  clientId: z.string().min(1).max(100),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  manual: z.array(z.object({ label: z.string().trim().min(1).max(120), amount: z.number().positive().max(1_000_000) })).max(20).default([]),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Escolha o cliente e o mês." }, { status: 400 });
  const auth = await guard(["agency", "admin"], { clientId: parsed.data.clientId });
  if (isDenied(auth)) return auth;
  const result = createDraftInvoice(parsed.data.clientId, parsed.data.month, parsed.data.manual);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result, { status: 201 });
}
