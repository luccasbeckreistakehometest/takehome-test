import { NextResponse } from "next/server";
import { z } from "zod";
import { guardClient, isDenied, notFound } from "@/lib/guard";
import { carouselBrand, getCarousel, updateCarousel } from "@/lib/carousels-db";
import { slideHashes } from "@/lib/carousel-render";
import { captionText, contentProblems } from "@/lib/carousel-rules";
import { createScheduledPost, getScheduledPost, setPostMedia, updateScheduledPost } from "@/lib/marketplace-db";
import { signMedia } from "@/lib/media-sign";
import { appBaseUrl } from "@/lib/legal";

type Context = { params: Promise<{ id: string }> };

const schema = z.object({
  scheduledFor: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/),
  channel: z.string().trim().min(1).max(40).default("Instagram"),
  status: z.enum(["draft", "scheduled"]).default("draft"),
});

// Leva o carrossel para o calendário (cria ou atualiza o post) com a legenda
// e as imagens em endereço público assinado — com o Instagram conectado, o
// agendador publica como carrossel de verdade.
export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  const carousel = getCarousel(id);
  if (!carousel) return notFound("Carrossel não encontrado");
  const auth = await guardClient(carousel.clientId, "workspace");
  if (isDenied(auth)) return auth;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Escolha a data e a hora." }, { status: 400 });
  const problems = contentProblems(carousel.content);
  if (problems.length) return NextResponse.json({ error: problems[0] }, { status: 400 });
  const brand = carouselBrand(carousel.clientId)!;
  const hashes = slideHashes(carousel, brand);
  const base = appBaseUrl();
  const urls = hashes
    .map((hash, index) => {
      const sig = signMedia(carousel.id, index, hash);
      return sig ? `${base}/api/c/${carousel.id}/${index}-${hash}.png?sig=${sig}` : null;
    })
    .filter((u): u is string => Boolean(u));
  const caption = captionText(carousel.content);
  const existing = carousel.postId ? getScheduledPost(carousel.postId) : null;
  let postId: string;
  if (existing && existing.clientId === carousel.clientId && existing.status !== "published") {
    updateScheduledPost(existing.id, { caption, format: "Carrossel", scheduledFor: parsed.data.scheduledFor, status: parsed.data.status });
    postId = existing.id;
  } else {
    const post = createScheduledPost({
      clientId: carousel.clientId,
      title: carousel.content.hook || carousel.topic,
      channel: parsed.data.channel,
      caption,
      hashtags: [],
      scheduledFor: parsed.data.scheduledFor,
      status: parsed.data.status,
      format: "Carrossel",
      imageBrief: carousel.content.slides.map((s, i) => `${i + 1}. ${s.title}${s.visualHint ? ` — ${s.visualHint}` : ""}`).join("\n"),
    });
    postId = post.id;
    updateCarousel(carousel.id, { postId });
  }
  setPostMedia(postId, urls);
  return NextResponse.json({ postId, mediaCount: urls.length }, { status: 201 });
}
