import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { extractVoiceBriefing } from "@/lib/voice-briefing";
import { recordOnboardingEvent, saveVoiceBriefing } from "@/lib/onboarding-db";

export const maxDuration = 120;

const schema = z.object({
  transcript: z.string().min(3).max(8000),
  lang: z.enum(["pt", "en"]).default("pt"),
  briefingId: z.string().optional(),
  prior: z.unknown().optional(),
});

// Um turno do briefing falado. Devolve o que foi entendido e a próxima pergunta.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Faça login" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Fale um pouco mais e tente de novo." }, { status: 400 });
  try {
    const briefing = await extractVoiceBriefing({ transcript: parsed.data.transcript, lang: parsed.data.lang, prior: (parsed.data.prior as never) ?? null });
    const id = parsed.data.briefingId ?? randomUUID();
    saveVoiceBriefing({ id, userId: session.userId, lang: parsed.data.lang, transcript: parsed.data.transcript, extracted: briefing });
    recordOnboardingEvent(session.userId, "voice_turn", { missing: briefing.missing.length });
    return NextResponse.json({ briefingId: id, briefing });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não consegui entender. Tente de novo." }, { status: 502 });
  }
}
