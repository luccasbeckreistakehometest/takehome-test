import { NextResponse } from "next/server";
import { getInvite } from "@/lib/invites-db";
import { getAgency } from "@/lib/agencies";
import { agencyLogoUrl } from "@/lib/branding";

type Context = { params: Promise<{ token: string }> };

// Lookup público: a página de convite descobre o papel e a validade.
export async function GET(_request: Request, { params }: Context) {
  const { token } = await params;
  const invite = getInvite(token);
  if (!invite) return NextResponse.json({ valid: false, reason: "not_found" }, { status: 404 });
  const expired = invite.expiresAt ? invite.expiresAt < new Date().toISOString() : false;
  const valid = invite.status === "pending" && !expired;
  const agency = valid ? getAgency(invite.agencyId) : null;
  return NextResponse.json({
    agency: agency ? { name: agency.name, accentColor: agency.accentColor, logoUrl: agencyLogoUrl(agency) } : null,
    valid,
    reason: !valid ? (expired ? "expired" : invite.status) : null,
    role: invite.role,
    note: invite.note,
  });
}
