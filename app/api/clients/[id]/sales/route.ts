import { NextResponse } from "next/server";
import { z } from "zod";
import { createSale, deleteSale, listSales, salesTotals } from "@/lib/integrations-db";
import { guard, isDenied } from "@/lib/guard";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guard(["agency", "admin", "client"], { clientId: id });
  if (isDenied(auth)) return auth;
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
// O lote vem PRIMEIRO na união: como todo campo da venda tem default e o zod
// descarta chaves desconhecidas, `{ rows: [...] }` casava com a venda única e
// virava uma venda vazia de R$ 0 (a importação de CSV não gravava nada).
const bodySchema = z.union([z.object({ rows: z.array(saleSchema).min(1).max(5000) }), saleSchema]);

export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guard(["agency", "admin", "client"], { clientId: id, selfServe: true });
  if (isDenied(auth)) return auth;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }
  const rows = "rows" in parsed.data ? parsed.data.rows : [parsed.data];
  const created = rows.map((row) => createSale({ clientId: id, ...row }));
  return NextResponse.json({ created: created.length, totals: salesTotals(id) }, { status: 201 });
}

export async function DELETE(request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guard(["agency", "admin", "client"], { clientId: id, selfServe: true });
  if (isDenied(auth)) return auth;
  const saleId = new URL(request.url).searchParams.get("saleId");
  if (!saleId) return NextResponse.json({ error: "saleId ausente" }, { status: 400 });
  deleteSale(saleId, id);
  return NextResponse.json({ ok: true });
}
