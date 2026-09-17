import { NextResponse } from "next/server";
import { z } from "zod";
import { getClient } from "@/lib/db";
import { createScheduledPost, listScheduledPosts } from "@/lib/marketplace-db";
import { guard, isDenied, tenantOf } from "@/lib/guard";

const scheduleSchema = z.object({
  clientId: z.string().min(1),
  title: z.string().trim().min(1),
  channel: z.string().trim().min(1),
  caption: z.string().trim().default(""),
  hashtags: z.array(z.string()).default([]),
  scheduledFor: z.string().trim().min(1),
  status: z.enum(["draft", "scheduled"]).default("scheduled"),
  format: z.string().trim().max(40).default(""),
  hookType: z.string().trim().max(40).default(""),
});

export async function GET(request: Request) {
  const auth = await guard(["agency", "admin", "client"]);
  if (isDenied(auth)) return auth;
  // A marca só vê a própria fila.
  const clientId =
    auth.role === "client" ? (auth.refId ?? "-") : (new URL(request.url).searchParams.get("clientId") ?? undefined);
  return NextResponse.json(listScheduledPosts(tenantOf(auth, request), clientId));
}

// Agenda um post na fila de publicação. O disparo automático nas redes é
// ativado quando a integração (Meta/TikTok) estiver conectada; até lá a fila
// avisa o que está no horário e a publicação é confirmada manualmente.
export async function POST(request: Request) {
  const parsed = scheduleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }
  const auth = await guard(["agency", "admin", "client"], { clientId: parsed.data.clientId, selfServe: true });
  if (isDenied(auth)) return auth;
  if (!getClient(parsed.data.clientId)) {
    return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }
  return NextResponse.json(createScheduledPost(parsed.data), { status: 201 });
}
