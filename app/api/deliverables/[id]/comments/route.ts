import { NextResponse } from "next/server";
import { z } from "zod";
import { createComment, deleteComment, listComments } from "@/lib/comments-db";
import { db } from "@/lib/db";
import { actorRole, guardDeliverable, isDenied } from "@/lib/guard";

type Context = { params: Promise<{ id: string }> };

const commentSchema = z.object({
  author: z.enum(["agency", "client", "professional"]).default("agency"),
  authorName: z.string().trim().max(80).default(""),
  body: z.string().trim().min(1).max(4000),
});

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guardDeliverable(id, "view");
  if (isDenied(auth)) return auth;
  return NextResponse.json(listComments(id));
}

export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guardDeliverable(id, "portal");
  if (isDenied(auth)) return auth;
  const parsed = commentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Comentário inválido" }, { status: 400 });
  }
  const data = auth.session.role === "client" ? { ...parsed.data, author: actorRole(auth.session) } : parsed.data;
  const comment = createComment({ deliverableId: id, ...data });
  return NextResponse.json(comment, { status: 201 });
}

export async function DELETE(request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guardDeliverable(id, "workspace");
  if (isDenied(auth)) return auth;
  const commentId = new URL(request.url).searchParams.get("commentId");
  if (!commentId) {
    return NextResponse.json({ error: "commentId é obrigatório" }, { status: 400 });
  }
  // O comentário precisa ser desta entrega.
  if (!db.prepare("SELECT 1 FROM deliverable_comments WHERE id = ? AND deliverableId = ?").get(commentId, id)) {
    return NextResponse.json({ error: "Comentário não encontrado" }, { status: 404 });
  }
  if (!deleteComment(commentId)) {
    return NextResponse.json({ error: "Comentário não encontrado" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
