import { NextResponse } from "next/server";
import { getInvite } from "@/lib/invites-db";

type Context = { params: Promise<{ token: string }> };

// Lookup público: a página de convite descobre o papel e a validade.
export async function GET(_request: Request, { params }: Context) {
  const { token } = await params;
  const invite = getInvite(token);
  if (!invite) return NextResponse.json({ valid: false, reason: "not_found" }, { status: 404 });
  const expired = invite.expiresAt ? invite.expiresAt < new Date().toISOString() : false;
  const valid = invite.status === "pending" && !expired;
  return NextResponse.json({
    valid,
    reason: !valid ? (expired ? "expired" : invite.status) : null,
    role: invite.role,
    note: invite.note,
  });
}
