import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteMeeting, getMeeting, updateMeeting } from "@/lib/marketplace-db";
import { guard, guardClient, isDenied, notFound } from "@/lib/guard";

// Reunião de uma marca: quem opera a marca; reunião geral: a agência dona.
async function authorize(id: string) {
  const row = getMeeting(id);
  if (!row) return notFound("Reunião não encontrada");
  if (row.clientId) return guardClient(row.clientId, "workspace");
  return guard(["agency", "admin"], { agencyId: row.agencyId });
}

type Context = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  title: z.string().trim().min(1).optional(),
  scheduledAt: z.string().trim().min(1).optional(),
  link: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

// Edição de reuniões — inclusive as agendadas pela IA
export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await authorize(id);
  if (isDenied(auth)) return auth;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }
  const updated = updateMeeting(id, parsed.data);
  if (!updated) {
    return NextResponse.json({ error: "Reunião não encontrada" }, { status: 404 });
  }
  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await authorize(id);
  if (isDenied(auth)) return auth;
  if (!deleteMeeting(id)) {
    return NextResponse.json({ error: "Reunião não encontrada" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
