import { NextResponse } from "next/server";
import { z } from "zod";
import { getClient } from "@/lib/db";
import { guard, isDenied } from "@/lib/guard";
import { aiContextFor, aiErrorResponse, gateAi, type AiGate } from "@/lib/metering";
import { runWithAiContext } from "@/lib/ai-spend";
import { getBrandVoicePolicy } from "@/lib/brand-voice-db";
import { rewriteInBrandVoice } from "@/lib/brand-voice-ai";

type Context = { params: Promise<{ id: string }> };
export const maxDuration = 60;

const schema = z.object({ text: z.string().trim().min(1).max(4000), kind: z.enum(["post", "reply"]).default("post") });

// "Reescrever no tom": devolve o texto no tom da marca respeitando a política.
export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guard(["agency", "admin", "client"], { clientId: id, selfServe: true });
  if (isDenied(auth)) return auth;
  const client = getClient(id);
  if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Escreva o texto a reescrever." }, { status: 400 });
  let gate: AiGate | null = null;
  try {
    const outcome = await runWithAiContext(aiContextFor(auth, "brand_voice_rewrite"), () => rewriteInBrandVoice({
      client,
      policy: getBrandVoicePolicy(id),
      text: parsed.data.text,
      kind: parsed.data.kind,
      charge: () => {
        gate = gateAi(request, auth, "brand_voice_rewrite");
        return gate.ok ? { ok: true } : { ok: false, reason: gate.reason, status: gate.status };
      },
    }));
    if ("error" in outcome) return NextResponse.json({ error: outcome.error }, { status: outcome.status });
    return NextResponse.json(outcome);
  } catch (error) {
    const g = gate as AiGate | null;
    if (g?.ok) g.refund();
    return aiErrorResponse(error);
  }
}
