import { NextResponse } from "next/server";
import { getProposalByToken, markProposalViewed } from "@/lib/proposals-db";
import { proposalState, validityLabel } from "@/lib/proposal-rules";
import { getSettings } from "@/lib/settings";

type Context = { params: Promise<{ token: string }> };

// Leitura pública da proposta pelo token (página /proposta). Registra a
// primeira abertura. Nunca expõe dados internos além da própria proposta.
export async function GET(_request: Request, { params }: Context) {
  const { token } = await params;
  const proposal = getProposalByToken(token);
  if (!proposal) return NextResponse.json({ error: "Proposta não encontrada" }, { status: 404 });
  const state = proposalState(proposal);
  if (state === "open") markProposalViewed(proposal.id);
  const settings = getSettings();
  return NextResponse.json({
    state,
    proposal: {
      prospectName: proposal.prospectName,
      lang: proposal.lang,
      currency: proposal.currency,
      content: proposal.content,
      expiresAt: proposal.expiresAt,
      validity: validityLabel(proposal.expiresAt, proposal.lang),
      acceptedPackage: proposal.acceptedPackage,
      createdAt: proposal.createdAt,
    },
    agency: {
      name: settings.agencyName,
      tagline: settings.tagline,
      accentColor: settings.accentColor,
      hasLogo: Boolean(settings.logoMime),
    },
  });
}
