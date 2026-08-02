import { NextResponse } from "next/server";
import { z } from "zod";
import { createComment, deleteComment, listComments } from "@/lib/comments-db";
import { getDeliverable } from "@/lib/marketplace-db";

type Context = { params: Promise<{ id: string }> };

const commentSchema = z.object({
  author: z.enum(["agency", "client", "professional"]).default("agency"),
  authorName: z.string().trim().max(80).default(""),
  body: z.string().trim().min(1),
});

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  return NextResponse.json(listComments(id));
}

export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  if (!getDeliverable(id)) {
    return NextResponse.json({ error: "Entrega não encontrada" }, { status: 404 });
  }
  const parsed = commentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Comentário inválido" }, { status: 400 });
  }
  const comment = createComment({ deliverableId: id, ...parsed.data });
  return NextResponse.json(comment, { status: 201 });
}

export async function DELETE(request: Request, { params }: Context) {
  await params;
  const commentId = new URL(request.url).searchParams.get("commentId");
  if (!commentId) {
    return NextResponse.json({ error: "commentId é obrigatório" }, { status: 400 });
  }
  if (!deleteComment(commentId)) {
    return NextResponse.json({ error: "Comentário não encontrado" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
