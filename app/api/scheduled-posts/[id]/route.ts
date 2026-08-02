import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteScheduledPost, updateScheduledPost } from "@/lib/marketplace-db";

type Context = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  scheduledFor: z.string().trim().min(1).optional(),
  status: z.enum(["scheduled", "published", "canceled"]).optional(),
  caption: z.string().trim().optional(),
});

export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;
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
  if (!deleteScheduledPost(id)) {
    return NextResponse.json({ error: "Agendamento não encontrado" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
