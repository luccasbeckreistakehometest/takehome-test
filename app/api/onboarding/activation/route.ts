import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { activationFor } from "@/lib/activation-db";
import { dismissActivation } from "@/lib/onboarding-db";

export const dynamic = "force-dynamic";

// "Primeiros passos" de quem está logado (agência, marca, cliente gerenciado
// ou profissional). Os passos marcam sozinhos a partir dos dados da conta.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Faça login" }, { status: 401 });
  const payload = activationFor(session);
  if (!payload) return NextResponse.json({ role: null, steps: [], progress: null, dismissed: true });
  return NextResponse.json(payload);
}

// Fechar o card: só depois de concluir tudo.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Faça login" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { dismiss?: unknown };
  if (body.dismiss !== true) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  const payload = activationFor(session);
  if (!payload) return NextResponse.json({ error: "Sem primeiros passos para esta conta" }, { status: 400 });
  if (!payload.progress.complete) return NextResponse.json({ error: "Conclua os primeiros passos antes de fechar." }, { status: 409 });
  dismissActivation(session.userId);
  return NextResponse.json({ ...payload, dismissed: true });
}
