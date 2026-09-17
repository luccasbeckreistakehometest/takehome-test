import { NextResponse } from "next/server";
import { z } from "zod";
import { getClient, listGenerations } from "@/lib/db";
import { guardClient, isDenied } from "@/lib/guard";
import { aiContextFor, aiErrorResponse, gateAi, type AiGate } from "@/lib/metering";
import { runWithAiContext } from "@/lib/ai-spend";
import { aiUsable } from "@/lib/ai-mock";
import { genericPersonas, personasFromStrategy, validateVariants } from "@/lib/panel-rules";
import { clientCalibration, findByHash, listPanelTests, savePanelTest } from "@/lib/panel-db";
import { panelHash, runPanel } from "@/lib/panel-ai";
import { getScheduledPost } from "@/lib/marketplace-db";

type Context = { params: Promise<{ id: string }> };
export const maxDuration = 90;

function personasFor(clientId: string, audience: string, lang: "pt-BR" | "en") {
  const fromStrategy = personasFromStrategy(listGenerations(clientId, "strategy_analysis")[0]?.content);
  if (fromStrategy.length >= 2) return { personas: fromStrategy.slice(0, 6), generic: false };
  return { personas: genericPersonas(audience, lang), generic: true };
}

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guardClient(id, "view");
  if (isDenied(auth)) return auth;
  const client = getClient(id);
  if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  const { generic } = personasFor(id, client.audience, client.language);
  return NextResponse.json({ tests: listPanelTests(id), calibration: clientCalibration(id), genericPersonas: generic, aiAvailable: aiUsable() });
}

const schema = z.object({ variants: z.array(z.string().max(2500)).max(10), postId: z.string().max(100).optional() });

// Painel sintético: 2 a 3 variantes, uma chamada (2 coins). Mesmas variantes
// e personas = resultado guardado, sem custo e sem nova chamada.
export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guardClient(id, "workspace");
  if (isDenied(auth)) return auth;
  const client = getClient(id);
  if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Teste de 2 a 3 variantes." }, { status: 400 });
  const valid = validateVariants(parsed.data.variants);
  if (!valid.ok) return NextResponse.json({ error: valid.error }, { status: 400 });
  if (parsed.data.postId) {
    const post = getScheduledPost(parsed.data.postId);
    if (!post || post.clientId !== id) return NextResponse.json({ error: "Post não encontrado" }, { status: 404 });
  }
  const { personas, generic } = personasFor(id, client.audience, client.language);
  const hash = panelHash(id, valid.variants, personas);
  const cached = findByHash(hash);
  if (cached) return NextResponse.json({ test: cached, cached: true, charged: false });
  if (!aiUsable()) return NextResponse.json({ error: "A IA não está disponível agora." }, { status: 503 });
  let gate: AiGate | null = null;
  try {
    gate = gateAi(request, auth, "panel_test", { agencyId: client.agencyId });
    if (!gate.ok) return NextResponse.json({ error: gate.reason, ...(gate.status === 402 ? { code: "no_coins" } : {}) }, { status: gate.status, headers: gate.headers });
    const { result, demo } = await runWithAiContext(aiContextFor(auth, "panel_test", client.agencyId), () => runPanel(client, valid.variants, personas));
    const test = savePanelTest({ clientId: id, postId: parsed.data.postId ?? null, variants: valid.variants, personas, generic, result, hash, demo });
    return NextResponse.json({ test, cached: false, charged: true }, { status: 201 });
  } catch (error) {
    if (gate?.ok) gate.refund();
    return aiErrorResponse(error);
  }
}
