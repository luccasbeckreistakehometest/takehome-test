import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteScheduledPost, getScheduledPost, updateScheduledPost } from "@/lib/marketplace-db";
import { guardClient, isDenied, notFound } from "@/lib/guard";

async function authorize(id: string) {
  const post = getScheduledPost(id);
  if (!post) return notFound("Agendamento não encontrado");
  return guardClient(post.clientId, "workspace");
}

type Context = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  scheduledFor: z.string().trim().min(1).optional(),
  status: z.enum(["draft", "scheduled", "published", "canceled"]).optional(),
  caption: z.string().trim().optional(),
  title: z.string().trim().min(1).optional(),
  channel: z.string().trim().min(1).optional(),
  format: z.string().trim().max(40).optional(),
  hookType: z.string().trim().max(40).optional(),
});

export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await authorize(id);
  if (isDenied(auth)) return auth;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }
  if (!updateScheduledPost(id, parsed.data)) {
    return NextResponse.json({ error: "Agendamento não encontrado" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await authorize(id);
  if (isDenied(auth)) return auth;
  if (!deleteScheduledPost(id)) {
    return NextResponse.json({ error: "Agendamento não encontrado" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
