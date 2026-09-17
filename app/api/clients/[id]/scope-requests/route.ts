import { NextResponse } from "next/server";
import { z } from "zod";
import { guardClient, isDenied } from "@/lib/guard";
import { createScopeRequest, listScopeRequests } from "@/lib/scope-db";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guardClient(id, "view");
  if (isDenied(auth)) return auth;
  return NextResponse.json(listScopeRequests(id));
}

const schema = z.object({
  text: z.string().trim().min(3).max(2000),
  itemKey: z.string().trim().max(30).default(""),
  qty: z.number().int().min(1).max(50).default(1),
  classifiedBy: z.enum(["ai", "manual", "rules"]).default("manual"),
  aiReasoning: z.string().max(500).optional(),
});

// Pedido de produção pelo portal: dentro do pacote vira demanda; fora dele
// espera o cliente aprovar o valor do extra.
export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guardClient(id, "portal");
  if (isDenied(auth)) return auth;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Conte o que você precisa." }, { status: 400 });
  const result = createScopeRequest({ clientId: id, ...parsed.data });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result, { status: 201 });
}
