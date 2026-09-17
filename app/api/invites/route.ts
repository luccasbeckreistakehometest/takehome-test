import { NextResponse } from "next/server";
import { z } from "zod";
import { createInvite, listInvites, revokeInvite } from "@/lib/invites-db";
import { actingAgencyId, agencyOnly, isDenied, tenantOf } from "@/lib/guard";
import { getAgency } from "@/lib/agencies";

// Convites da agência (admin: todos, ou os do ?agency=). Quem aceita entra
// na agência que convidou — "agência" = alguém do time.
export async function GET(request: Request) {
  const auth = await agencyOnly();
  if (isDenied(auth)) return auth;
  return NextResponse.json({ invites: listInvites(tenantOf(auth, request)) });
}

const schema = z.object({
  role: z.enum(["client", "professional", "agency"]),
  note: z.string().trim().default(""),
  expiresInDays: z.number().int().positive().max(365).optional(),
});

export async function POST(request: Request) {
  const auth = await agencyOnly();
  if (isDenied(auth)) return auth;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }
  const agencyId = actingAgencyId(auth, request);
  if (!getAgency(agencyId)) return NextResponse.json({ error: "Agência não encontrada" }, { status: 404 });
  return NextResponse.json({ invite: createInvite({ ...parsed.data, agencyId }) }, { status: 201 });
}

export async function DELETE(request: Request) {
  const auth = await agencyOnly();
  if (isDenied(auth)) return auth;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
  if (!revokeInvite(tenantOf(auth), id)) return NextResponse.json({ error: "Convite não encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
