import { NextResponse } from "next/server";
import { z } from "zod";
import { guardClient, isDenied, notFound } from "@/lib/guard";
import { chargeAsExtra, decideScopeRequest, getScopeRequest } from "@/lib/scope-db";

type Context = { params: Promise<{ id: string }> };

const schema = z.object({
  decision: z.enum(["approved", "declined", "waived", "charge_extra"]),
  price: z.number().min(0).max(100_000).optional(),
});

// Decisão de um pedido fora do escopo. Cliente: aprova ou desiste do extra.
// Agência: dispensa a cobrança (inclui sem custo) ou cancela.
export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;
  const scope = getScopeRequest(id);
  if (!scope) return notFound("Pedido não encontrado");
  const auth = await guardClient(scope.clientId, "portal");
  if (isDenied(auth)) return auth;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  const actor = auth.role === "client" ? "client" : "agency";
  if (actor === "agency" && parsed.data.decision === "approved") {
    return NextResponse.json({ error: "Quem aprova o valor do extra é o cliente." }, { status: 403 });
  }
  if (parsed.data.decision === "charge_extra") {
    if (actor !== "agency") return NextResponse.json({ error: "Ação inválida" }, { status: 403 });
    const charged = chargeAsExtra(id, parsed.data.price ?? 0);
    if ("error" in charged) return NextResponse.json({ error: charged.error }, { status: charged.status });
    return NextResponse.json(charged);
  }
  const result = decideScopeRequest(id, parsed.data.decision, actor);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}
