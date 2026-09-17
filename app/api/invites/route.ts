import { NextResponse } from "next/server";
import { z } from "zod";
import { createInvite, listInvites, revokeInvite } from "@/lib/invites-db";
import { agencyOnly, isDenied } from "@/lib/guard";

export async function GET() {
  const auth = await agencyOnly();
  if (isDenied(auth)) return auth;
  return NextResponse.json({ invites: listInvites() });
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
  return NextResponse.json({ invite: createInvite(parsed.data) }, { status: 201 });
}

export async function DELETE(request: Request) {
  const auth = await agencyOnly();
  if (isDenied(auth)) return auth;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
  revokeInvite(id);
  return NextResponse.json({ ok: true });
}
