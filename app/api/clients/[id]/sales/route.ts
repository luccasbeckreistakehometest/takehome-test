import { NextResponse } from "next/server";
import { z } from "zod";
import { createSale, deleteSale, listSales, salesTotals } from "@/lib/integrations-db";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  return NextResponse.json({ sales: listSales(id), totals: salesTotals(id) });
}

const saleSchema = z.object({
  source: z.string().trim().default(""),
  kind: z.enum(["product", "service"]).default("product"),
  periodStart: z.string().trim().default(""),
  periodEnd: z.string().trim().default(""),
  revenue: z.number().nonnegative().default(0),
  units: z.number().nonnegative().default(0),
  currency: z.string().trim().default("BRL"),
  note: z.string().trim().default(""),
});

// Aceita uma venda única ou um lote (CSV parseado no cliente vira array).
const bodySchema = z.union([saleSchema, z.object({ rows: z.array(saleSchema) })]);

export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }
  const rows = "rows" in parsed.data ? parsed.data.rows : [parsed.data];
  const created = rows.map((row) => createSale({ clientId: id, ...row }));
  return NextResponse.json({ created: created.length, totals: salesTotals(id) }, { status: 201 });
}

export async function DELETE(request: Request, { params }: Context) {
  await params;
  const saleId = new URL(request.url).searchParams.get("saleId");
  if (!saleId) return NextResponse.json({ error: "saleId ausente" }, { status: 400 });
  deleteSale(saleId);
  return NextResponse.json({ ok: true });
}
