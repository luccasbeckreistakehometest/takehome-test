import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, isDenied } from "@/lib/guard";
import { GenerationError } from "@/lib/claude";
import { chargeUsage } from "@/lib/billing-db";
import { createJob, finishJob, getProspect } from "@/lib/marketplace-db";
import { createProposal, listProposalsForProspect } from "@/lib/proposals-db";
import { generateProposalContent } from "@/lib/proposal-ai";
import { DEFAULT_PROPOSAL_DAYS, expiryFromNow } from "@/lib/proposal-rules";

export const maxDuration = 120;

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guard(["agency", "admin"]);
  if (isDenied(auth)) return auth;
  return NextResponse.json({ proposals: listProposalsForProspect(id) });
}

const schema = z.object({
  services: z.string().trim().max(3000).default(""),
  notes: z.string().trim().max(2000).default(""),
  expiresInDays: z.number().int().min(1).max(90).default(DEFAULT_PROPOSAL_DAYS),
  lang: z.enum(["pt-BR", "en"]).default("pt-BR"),
  currency: z.string().trim().min(3).max(3).default("BRL"),
});

// Proposta em 5 minutos: a IA escreve a página a partir do prospect + oferta
// da agência; sai um link público com validade.
export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guard(["agency", "admin"]);
  if (isDenied(auth)) return auth;
  const prospect = getProspect(id);
  if (!prospect) return NextResponse.json({ error: "Prospect não encontrado" }, { status: 404 });
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }
  const charge = chargeUsage({ accountType: "agency", accountId: "agency", action: "proposal" });
  if (!charge.ok) return NextResponse.json({ error: charge.reason }, { status: 402 });

  const job = createJob({ kind: "proposal", label: `Proposta — ${prospect.name}` });
  try {
    const content = await generateProposalContent({
      prospect,
      services: parsed.data.services,
      notes: parsed.data.notes,
      lang: parsed.data.lang,
      currency: parsed.data.currency.toUpperCase(),
    });
    const proposal = createProposal({
      prospectId: prospect.id,
      prospectName: prospect.name,
      segment: prospect.segment,
      lang: parsed.data.lang,
      currency: parsed.data.currency.toUpperCase(),
      content,
      expiresAt: expiryFromNow(new Date(), parsed.data.expiresInDays),
    });
    finishJob(job.id, "done");
    return NextResponse.json({ proposal, url: `/proposta/${proposal.token}` }, { status: 201 });
  } catch (error) {
    const message = error instanceof GenerationError ? error.message : "Erro ao gerar a proposta.";
    finishJob(job.id, "error", message);
    return NextResponse.json({ error: message }, { status: error instanceof GenerationError ? error.status : 500 });
  }
}
