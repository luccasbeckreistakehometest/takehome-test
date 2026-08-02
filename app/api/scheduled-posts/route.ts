import { NextResponse } from "next/server";
import { z } from "zod";
import { getClient } from "@/lib/db";
import { createScheduledPost, listScheduledPosts } from "@/lib/marketplace-db";

const scheduleSchema = z.object({
  clientId: z.string().min(1),
  title: z.string().trim().min(1),
  channel: z.string().trim().min(1),
  caption: z.string().trim().default(""),
  hashtags: z.array(z.string()).default([]),
  scheduledFor: z.string().trim().min(1),
});

export async function GET(request: Request) {
  const clientId = new URL(request.url).searchParams.get("clientId") ?? undefined;
  return NextResponse.json(listScheduledPosts(clientId));
}

// Agenda um post na fila de publicação. O disparo automático nas redes é
// ativado quando a integração (Meta/TikTok) estiver conectada; até lá a fila
// avisa o que está no horário e a publicação é confirmada manualmente.
export async function POST(request: Request) {
  const parsed = scheduleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }
  if (!getClient(parsed.data.clientId)) {
    return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }
  return NextResponse.json(createScheduledPost(parsed.data), { status: 201 });
}
