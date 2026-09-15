import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { synthesise, ttsProvider } from "@/lib/tts";

const schema = z.object({ text: z.string().min(1).max(600), lang: z.enum(["pt", "en"]).default("pt") });

// Devolve a voz de IA lendo `text`, ou 204 quando não há provedor configurado.
export async function POST(request: Request) {
  if (!(await getSession())) return NextResponse.json({ error: "Faça login" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  if (!ttsProvider()) return new Response(null, { status: 204 });
  try {
    const audio = await synthesise(parsed.data.text, parsed.data.lang);
    if (!audio) return new Response(null, { status: 204 });
    return new Response(new Uint8Array(audio), { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=86400" } });
  } catch (error) {
    console.error("tts", error);
    return new Response(null, { status: 204 });
  }
}

export async function GET() {
  return NextResponse.json({ provider: ttsProvider() });
}
