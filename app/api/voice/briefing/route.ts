import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { extractVoiceBriefing } from "@/lib/voice-briefing";
import { recordOnboardingEvent, saveVoiceBriefing, voiceBriefingTurns } from "@/lib/onboarding-db";
import { MAX_VOICE_TURNS } from "@/lib/turn-taking";
import { guard, isDenied } from "@/lib/guard";
import { meterAi } from "@/lib/metering";

export const maxDuration = 120;

const schema = z.object({
  transcript: z.string().min(3).max(8000),
  lang: z.enum(["pt", "en"]).default("pt"),
  briefingId: z.string().max(80).optional(),
  prior: z.unknown().optional(),
});

// Um turno do briefing falado. Devolve o que foi entendido e a próxima pergunta.
// Quem preenche briefing: a agência (cadastro de cliente) ou a marca autônoma.
export async function POST(request: Request) {
  const auth = await guard(["agency", "admin", "client"], { selfServe: true });
  if (isDenied(auth)) return auth;
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Fale um pouco mais e tente de novo." }, { status: 400 });
  // 1 coin por conversa (a primeira fala); as seguintes não cobram, até 12.
  const turns = parsed.data.briefingId ? voiceBriefingTurns(parsed.data.briefingId, auth.userId) : 0;
  if (turns >= MAX_VOICE_TURNS) {
    return NextResponse.json({ error: "Chegamos ao limite de conversa deste briefing. Revise os campos ou complete digitando." }, { status: 429 });
  }
  const action = turns > 0 ? "voice_briefing_turn" : "voice_briefing";
  return meterAi(request, auth, action, async () => {
    const briefing = await extractVoiceBriefing({
      transcript: parsed.data.transcript,
      lang: parsed.data.lang,
      prior: (parsed.data.prior as never) ?? null,
    });
    const id = parsed.data.briefingId ?? randomUUID();
    saveVoiceBriefing({ id, userId: auth.userId, lang: parsed.data.lang, transcript: parsed.data.transcript, extracted: briefing });
    recordOnboardingEvent(auth.userId, "voice_turn", { missing: briefing.missing.length });
    return NextResponse.json({ briefingId: id, briefing });
  });
}
