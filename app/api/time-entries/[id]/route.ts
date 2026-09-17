import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, isDenied } from "@/lib/guard";
import { deleteEntry, getEntry, stopTimer, updateEntry } from "@/lib/finance-db";
import { clientAgencyId } from "@/lib/db";
import { getProfessional, professionalWorkedWith } from "@/lib/marketplace-db";

type Context = { params: Promise<{ id: string }> };

const schema = z.object({
  action: z.enum(["stop", "edit"]).default("edit"),
  note: z.string().max(300).optional(),
  minutes: z.number().min(1).max(24 * 60).optional(),
  professionalId: z.string().nullable().optional(),
});

// O apontamento é da agência da marca: outra agência recebe 404.
async function guardEntry(id: string) {
  const entry = getEntry(id);
  if (!entry) return NextResponse.json({ error: "Apontamento não encontrado" }, { status: 404 });
  return guard(["agency", "admin"], { clientId: entry.clientId });
}

// Parar o cronômetro ou editar um apontamento fechado.
export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guardEntry(id);
  if (isDenied(auth)) return auth;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  if (parsed.data.action === "stop") return NextResponse.json({ entry: stopTimer(id) });
  const { note, minutes, professionalId } = parsed.data;
  if (professionalId) {
    const entry = getEntry(id)!;
    const professional = getProfessional(professionalId);
    const agencyId = clientAgencyId(entry.clientId) ?? "";
    const visible =
      professional &&
      (professional.agencyId === null || professional.agencyId === agencyId || professionalWorkedWith(professional.id, agencyId));
    if (!visible) return NextResponse.json({ error: "Profissional não encontrado" }, { status: 404 });
  }
  return NextResponse.json({ entry: updateEntry(id, { note, minutes, professionalId }) });
}

export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guardEntry(id);
  if (isDenied(auth)) return auth;
  if (!deleteEntry(id)) return NextResponse.json({ error: "Apontamento não encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
