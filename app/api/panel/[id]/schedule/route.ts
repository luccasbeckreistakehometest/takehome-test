import { NextResponse } from "next/server";
import { z } from "zod";
import { guardClient, isDenied, notFound } from "@/lib/guard";
import { getPanelTest, linkVariantPost } from "@/lib/panel-db";
import { createScheduledPost, getScheduledPost } from "@/lib/marketplace-db";
import { LETTERS } from "@/lib/panel-rules";

type Context = { params: Promise<{ id: string }> };

const schema = z.object({
  variant: z.number().int().min(0).max(2),
  scheduledFor: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/),
  channel: z.string().trim().min(1).max(40).default("Instagram"),
});

// Leva uma variante ao calendário (rascunho) e liga o post ao teste: quando
// as variantes forem ao ar, os cliques dizem se o painel acertou.
export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  const test = getPanelTest(id);
  if (!test) return notFound("Teste não encontrado");
  const auth = await guardClient(test.clientId, "workspace");
  if (isDenied(auth)) return auth;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.variant >= test.variants.length) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  const base = test.postId ? getScheduledPost(test.postId) : null;
  const post = createScheduledPost({
    clientId: test.clientId,
    title: `${base?.title ?? "Teste do painel"} · variante ${LETTERS[parsed.data.variant]}`,
    channel: base?.channel ?? parsed.data.channel,
    caption: test.variants[parsed.data.variant],
    hashtags: [],
    scheduledFor: parsed.data.scheduledFor,
    status: "draft",
    format: base?.format ?? "",
  });
  return NextResponse.json({ test: linkVariantPost(id, parsed.data.variant, post.id), postId: post.id }, { status: 201 });
}
