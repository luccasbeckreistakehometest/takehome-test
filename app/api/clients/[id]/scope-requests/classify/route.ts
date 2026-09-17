import { NextResponse } from "next/server";
import { z } from "zod";
import { getClient } from "@/lib/db";
import { guardClient, isDenied } from "@/lib/guard";
import { aiContextFor, aiErrorResponse, gateAi, type AiGate } from "@/lib/metering";
import { runWithAiContext } from "@/lib/ai-spend";
import { getPackage } from "@/lib/scope-db";
import { guessItem } from "@/lib/scope-rules";
import { cachedScopeGuess, classifyScopeRequest, scopeAiAvailable } from "@/lib/scope-ai";
import type { SessionPayload } from "@/lib/auth-shared";

type Context = { params: Promise<{ id: string }> };
export const maxDuration = 30;

const schema = z.object({ text: z.string().trim().min(3).max(2000) });

// Sugere o item do pacote para o pedido. A IA (modelo barato, 1 coin pago
// pela agência) só roda com chave e saldo; senão o menu vem pré-marcado por
// palavras-chave e nada é cobrado.
export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guardClient(id, "portal");
  if (isDenied(auth)) return auth;
  const client = getClient(id);
  if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Conte o que você precisa." }, { status: 400 });
  const pkg = getPackage(id);
  if (!pkg || pkg.items.length === 0) return NextResponse.json({ itemKey: "", qty: 1, confidence: 0, reasoning: "", source: "manual", noPackage: true });
  const manual = () => NextResponse.json({ ...guessItem(parsed.data.text, pkg), reasoning: "", source: "manual", charged: false });
  const cached = cachedScopeGuess(parsed.data.text, pkg);
  if (cached) return NextResponse.json({ ...cached, charged: false });
  if (!scopeAiAvailable()) return manual();
  // quem paga é a agência da marca (a marca gerenciada não compra IA)
  const payer: SessionPayload = auth.role === "client" && !client.selfServe ? { ...auth, role: "agency", refId: null, agencyId: client.agencyId } : auth;
  const gate: AiGate = gateAi(request, payer, "scope_classify", { agencyId: client.agencyId });
  if (!gate.ok) return manual();
  try {
    const guess = await runWithAiContext(aiContextFor(payer, "scope_classify", client.agencyId), () =>
      classifyScopeRequest(id, parsed.data.text, pkg, client.language)
    );
    return NextResponse.json({ ...guess, charged: true });
  } catch (error) {
    gate.refund();
    return aiErrorResponse(error);
  }
}
