import { NextResponse } from "next/server";
import { z } from "zod";
import { getClient } from "@/lib/db";
import { guard, isDenied } from "@/lib/guard";
import { GenerationError } from "@/lib/claude";
import { chargeUsage } from "@/lib/billing-db";
import { getBrandVoicePolicy } from "@/lib/brand-voice-db";
import { checkBrandVoice } from "@/lib/brand-voice-ai";

type Context = { params: Promise<{ id: string }> };
export const maxDuration = 60;

const schema = z.object({ text: z.string().trim().min(1).max(4000), kind: z.enum(["post", "reply"]).default("post") });

// Checagem em 1 clique antes de agendar um post ou enviar uma resposta:
// regras da política + nota de tom da IA. Cache por hash: repetir o mesmo
// texto não chama a IA nem cobra coins.
export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guard(["agency", "admin", "client"], { clientId: id });
  if (isDenied(auth)) return auth;
  const client = getClient(id);
  if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Escreva o texto a checar." }, { status: 400 });
  try {
    const outcome = await checkBrandVoice({
      client,
      policy: getBrandVoicePolicy(id),
      text: parsed.data.text,
      kind: parsed.data.kind,
      charge: () => chargeUsage({ accountType: "client", accountId: id, action: "brand_voice_check" }),
    });
    if ("error" in outcome) return NextResponse.json({ error: outcome.error }, { status: outcome.status });
    return NextResponse.json(outcome.result);
  } catch (error) {
    const message = error instanceof GenerationError ? error.message : "Erro ao checar a voz da marca.";
    return NextResponse.json({ error: message }, { status: error instanceof GenerationError ? error.status : 500 });
  }
}
