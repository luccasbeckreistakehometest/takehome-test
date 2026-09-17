import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, isDenied } from "@/lib/guard";
import { acceptAllCampaignPosts, campaignReview, decideCampaignPost, getCampaign } from "@/lib/campaigns-db";

type Context = { params: Promise<{ id: string }> };

// Revisão da campanha: cada post com aceitar (agendar) / pular (remover).
export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const campaign = getCampaign(id);
  if (!campaign) return NextResponse.json({ error: "Campanha não encontrada" }, { status: 404 });
  const auth = await guard(["agency", "admin", "client"], { clientId: campaign.clientId });
  if (isDenied(auth)) return auth;
  return NextResponse.json(campaignReview(id));
}

const schema = z.object({
  action: z.enum(["accept", "skip", "accept_all"]),
  postId: z.string().optional(),
});

export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;
  const campaign = getCampaign(id);
  if (!campaign) return NextResponse.json({ error: "Campanha não encontrada" }, { status: 404 });
  const auth = await guard(["agency", "admin", "client"], { clientId: campaign.clientId });
  if (isDenied(auth)) return auth;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  if (parsed.data.action === "accept_all") {
    return NextResponse.json({ accepted: acceptAllCampaignPosts(id), ...campaignReview(id) });
  }
  if (!parsed.data.postId) return NextResponse.json({ error: "Informe o post" }, { status: 400 });
  if (!decideCampaignPost(id, parsed.data.postId, parsed.data.action)) {
    return NextResponse.json({ error: "Post não encontrado nesta campanha" }, { status: 404 });
  }
  return NextResponse.json(campaignReview(id));
}
