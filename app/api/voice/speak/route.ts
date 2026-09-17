import { NextResponse } from "next/server";
import { z } from "zod";
import { synthesise, ttsProvider } from "@/lib/tts";
import { guard, isDenied } from "@/lib/guard";
import { beginAi } from "@/lib/metering";

const schema = z.object({ text: z.string().min(1).max(600), lang: z.enum(["pt", "en"]).default("pt") });

// Devolve a voz de IA lendo `text`, ou 204 quando não há provedor configurado
// (a interface mostra o texto). Limitada por conta e por IP.
export async function POST(request: Request) {
  const auth = await guard(["agency", "admin", "client"]);
  if (isDenied(auth)) return auth;
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  if (!ttsProvider()) return new Response(null, { status: 204 });
  const ticket = await beginAi(request, auth, "tts", { limits: ["ttsPerAccount", "ttsPerIp"] });
  if (isDenied(ticket)) return ticket;
  try {
    const audio = await ticket.run(() => synthesise(parsed.data.text, parsed.data.lang));
    if (!audio) return new Response(null, { status: 204 });
    return new Response(new Uint8Array(audio), { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=86400" } });
  } catch (error) {
    console.error("[tts]", error instanceof Error ? error.message : error);
    return new Response(null, { status: 204 });
  }
}

export async function GET() {
  const auth = await guard(["agency", "admin", "client"]);
  if (isDenied(auth)) return auth;
  return NextResponse.json({ provider: ttsProvider() });
}
