import { NextResponse } from "next/server";
import { getProposalByToken, markProposalViewed } from "@/lib/proposals-db";
import { proposalState, validityLabel } from "@/lib/proposal-rules";
import { getAgency } from "@/lib/agencies";
import { agencyLogoUrl } from "@/lib/branding";

type Context = { params: Promise<{ token: string }> };

// Leitura pública da proposta pelo token (página /proposta). Só leitura: a
// primeira abertura é registrada pelo POST (a página chama; pré-visualização
// de link em apps de mensagem não conta). Nunca expõe dados internos.
export async function GET(_request: Request, { params }: Context) {
  const { token } = await params;
  const proposal = getProposalByToken(token);
  if (!proposal) return NextResponse.json({ error: "Proposta não encontrada" }, { status: 404 });
  const state = proposalState(proposal);
  // Marca da agência que enviou a proposta.
  const agency = getAgency(proposal.agencyId);
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
      name: agency?.name ?? "",
      tagline: agency?.tagline ?? "",
      accentColor: agency?.accentColor ?? "#f76b15",
      hasLogo: Boolean(agency?.logoMime),
      logoUrl: agency ? agencyLogoUrl(agency) : "",
    },
  });
}

export async function POST(_request: Request, { params }: Context) {
  const { token } = await params;
  const proposal = getProposalByToken(token);
  if (!proposal) return NextResponse.json({ error: "Proposta não encontrada" }, { status: 404 });
  if (proposalState(proposal) === "open") markProposalViewed(proposal.id);
  return NextResponse.json({ ok: true });
}
