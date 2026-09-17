import { NextResponse } from "next/server";
import { z } from "zod";
import { getClient } from "@/lib/db";
import { guard, isDenied } from "@/lib/guard";
import { GenerationError } from "@/lib/claude";
import { aiErrorResponse, beginAi } from "@/lib/metering";
import { createJob, finishJob, logActivity } from "@/lib/marketplace-db";
import { todayKey } from "@/lib/calendar-utils";
import { sanitizeCampaignInput } from "@/lib/campaign-rules";
import { generateCampaignPlan } from "@/lib/campaign-ai";
import { createCampaignFromPlan, listCampaigns } from "@/lib/campaigns-db";
import { isAiMock } from "@/lib/ai-mock";

type Context = { params: Promise<{ id: string }> };
export const maxDuration = 300;

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guard(["agency", "admin", "client"], { clientId: id });
  if (isDenied(auth)) return auth;
  if (!getClient(id)) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  return NextResponse.json({ campaigns: listCampaigns(id) });
}

const schema = z.object({
  goal: z.string().max(600).default(""),
  channels: z.array(z.string().max(40)).max(10).default([]),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  days: z.number().int().min(7).max(60).default(30),
  postsPerWeek: z.number().int().min(1).max(7).default(3),
});

// Gera a campanha de 30 dias e insere todos os posts como rascunho no
// calendário (encaixados nos buracos), para revisão post a post.
export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guard(["agency", "admin", "client"], { clientId: id });
  if (isDenied(auth)) return auth;
  const client = getClient(id);
  if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  if (auth.role === "client" && !client.selfServe) {
    return NextResponse.json({ error: "Peça a campanha à sua agência." }, { status: 403 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  const input = sanitizeCampaignInput(parsed.data, client.channels, todayKey());
  const ticket = await beginAi(request, auth, "campaign_30d", { agencyId: client.agencyId });
  if (isDenied(ticket)) return ticket;
  const job = createJob({ kind: "campaign_30d", label: `Campanha de ${input.days} dias — ${client.name}`, clientId: id, agencyId: client.agencyId });
  try {
    const plan = await ticket.run(() => generateCampaignPlan(client, input));
    const { campaign, posts } = createCampaignFromPlan({ clientId: id, input, plan, demo: isAiMock() });
    finishJob(job.id, "done");
    logActivity({
      audience: "agency",
      clientId: id,
      text: `🗓 Campanha de ${input.days} dias pronta para ${client.name}: ${posts.length} posts rascunhados`,
      href: `/clients/${id}?tab=campaign30`,
    });
    return NextResponse.json({ campaign, posts }, { status: 201 });
  } catch (error) {
    ticket.refund();
    finishJob(job.id, "error", error instanceof GenerationError ? error.message : "erro");
    return aiErrorResponse(error);
  }
}
