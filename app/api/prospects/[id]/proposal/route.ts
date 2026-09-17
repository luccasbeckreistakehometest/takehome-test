import { NextResponse } from "next/server";
import { z } from "zod";
import { guardProspect, isDenied } from "@/lib/guard";
import { GenerationError } from "@/lib/claude";
import { aiErrorResponse, beginAi } from "@/lib/metering";
import { createJob, finishJob } from "@/lib/marketplace-db";
import { createProposal, listProposalsForProspect } from "@/lib/proposals-db";
import { generateProposalContent } from "@/lib/proposal-ai";
import { DEFAULT_PROPOSAL_DAYS, expiryFromNow } from "@/lib/proposal-rules";

export const maxDuration = 120;

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const guarded = await guardProspect(id);
  if (isDenied(guarded)) return guarded;
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
  const guarded = await guardProspect(id);
  if (isDenied(guarded)) return guarded;
  const { session: auth, prospect } = guarded;
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }
  const ticket = await beginAi(request, auth, "proposal", { agencyId: prospect.agencyId });
  if (isDenied(ticket)) return ticket;

  const job = createJob({ kind: "proposal", label: `Proposta — ${prospect.name}`, agencyId: prospect.agencyId });
  try {
    const content = await ticket.run(() => generateProposalContent({
      prospect,
      services: parsed.data.services,
      notes: parsed.data.notes,
      lang: parsed.data.lang,
      currency: parsed.data.currency.toUpperCase(),
    }));
    const proposal = createProposal({
      agencyId: prospect.agencyId,
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
    ticket.refund();
    finishJob(job.id, "error", error instanceof GenerationError ? error.message : "erro");
    return aiErrorResponse(error);
  }
}
