import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteScheduledPost, getScheduledPost, releasePostApproval, updateScheduledPost } from "@/lib/marketplace-db";
import { recordEvent } from "@/lib/approvals-db";
import { guardClient, isDenied, notFound } from "@/lib/guard";

async function authorize(id: string) {
  const post = getScheduledPost(id);
  if (!post) return notFound("Agendamento não encontrado");
  return guardClient(post.clientId, "workspace");
}

type Context = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  scheduledFor: z.string().trim().min(1).optional(),
  status: z.enum(["draft", "scheduled", "published", "canceled"]).optional(),
  caption: z.string().trim().optional(),
  title: z.string().trim().min(1).optional(),
  channel: z.string().trim().min(1).optional(),
  format: z.string().trim().max(40).optional(),
  hookType: z.string().trim().max(40).optional(),
  // a agência libera o post sem esperar a resposta do cliente ao link
  releaseApproval: z.literal(true).optional(),
});

export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await authorize(id);
  if (isDenied(auth)) return auth;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }
  const { releaseApproval, ...patch } = parsed.data;
  if (!updateScheduledPost(id, patch)) {
    return NextResponse.json({ error: "Agendamento não encontrado" }, { status: 404 });
  }
  if (releaseApproval) {
    const post = getScheduledPost(id)!;
    if (post.clientApproval === "pending" || post.clientApproval === "changes_requested") {
      releasePostApproval(id);
      recordEvent({
        deliverableId: "",
        projectId: "",
        clientId: post.clientId,
        actor: "agency",
        decision: "approved",
        note: "Liberado pela agência sem a resposta do cliente",
        actions: [{ type: "activity", reason: "released_by_agency" }],
        source: "portal",
        approverName: auth.name ?? "",
        postId: post.id,
      });
    }
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await authorize(id);
  if (isDenied(auth)) return auth;
  if (!deleteScheduledPost(id)) {
    return NextResponse.json({ error: "Agendamento não encontrado" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
