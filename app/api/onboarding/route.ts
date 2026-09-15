import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { markOnboarded } from "@/lib/auth";
import { getOnboarding, recordOnboardingEvent, setTourProgress } from "@/lib/onboarding-db";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ tourCompleted: false, tourStep: 0, anonymous: true });
  const o = getOnboarding(session.userId);
  return NextResponse.json({ tourCompleted: o.tourCompleted === 1, tourStep: o.tourStep, firstSeenAt: o.firstSeenAt });
}

const schema = z.object({
  step: z.number().int().min(0).max(50).optional(),
  completed: z.boolean().optional(),
  event: z.string().max(40).optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

// Progresso do tour e eventos da primeira sessão. Quem completa (ou pula) fica
// marcado como onboarded no usuário — é o que o admin usa como funil.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  const { step, completed, event, meta } = parsed.data;
  if (event) recordOnboardingEvent(session.userId, event, meta);
  let o = getOnboarding(session.userId);
  if (step !== undefined || completed !== undefined) {
    o = setTourProgress(session.userId, step ?? o.tourStep, completed ?? false);
    if (completed) markOnboarded(session.userId);
  }
  return NextResponse.json({ tourCompleted: o.tourCompleted === 1, tourStep: o.tourStep });
}
