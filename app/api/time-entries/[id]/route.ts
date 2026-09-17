import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, isDenied } from "@/lib/guard";
import { deleteEntry, getEntry, stopTimer, updateEntry } from "@/lib/finance-db";

type Context = { params: Promise<{ id: string }> };

const schema = z.object({
  action: z.enum(["stop", "edit"]).default("edit"),
  note: z.string().max(300).optional(),
  minutes: z.number().min(1).max(24 * 60).optional(),
  professionalId: z.string().nullable().optional(),
});

// Parar o cronômetro ou editar um apontamento fechado.
export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guard(["agency", "admin"]);
  if (isDenied(auth)) return auth;
  if (!getEntry(id)) return NextResponse.json({ error: "Apontamento não encontrado" }, { status: 404 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  if (parsed.data.action === "stop") return NextResponse.json({ entry: stopTimer(id) });
  const { note, minutes, professionalId } = parsed.data;
  return NextResponse.json({ entry: updateEntry(id, { note, minutes, professionalId }) });
}

export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guard(["agency", "admin"]);
  if (isDenied(auth)) return auth;
  if (!deleteEntry(id)) return NextResponse.json({ error: "Apontamento não encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
