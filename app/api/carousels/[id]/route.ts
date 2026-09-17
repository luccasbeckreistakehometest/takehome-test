import { NextResponse } from "next/server";
import { z } from "zod";
import { guardClient, isDenied, notFound } from "@/lib/guard";
import { carouselBrand, deleteCarousel, getCarousel, updateCarousel } from "@/lib/carousels-db";
import { removeCarouselFiles, slideHashes } from "@/lib/carousel-render";
import { CAROUSEL_TEMPLATES, contentProblems, MAX_SLIDES } from "@/lib/carousel-rules";

type Context = { params: Promise<{ id: string }> };

async function authorize(id: string, access: "view" | "workspace") {
  const carousel = getCarousel(id);
  if (!carousel) return notFound("Carrossel não encontrado");
  const auth = await guardClient(carousel.clientId, access);
  return isDenied(auth) ? auth : carousel;
}

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const carousel = await authorize(id, "view");
  if (carousel instanceof NextResponse) return carousel;
  return NextResponse.json({ ...carousel, hashes: slideHashes(carousel, carouselBrand(carousel.clientId)!) });
}

const slide = z.object({ title: z.string().max(200), body: z.string().max(600).default(""), visualHint: z.string().max(300).default("") });
const schema = z.object({
  template: z.enum(CAROUSEL_TEMPLATES).optional(),
  content: z
    .object({
      hook: z.string().max(200).default(""),
      slides: z.array(slide).min(1).max(MAX_SLIDES),
      cta: z.string().max(200).default(""),
      caption: z.string().max(2200).default(""),
      hashtags: z.array(z.string().max(60)).max(15).default([]),
    })
    .optional(),
});

// Editar texto ou modelo: só re-renderiza o que mudou, sem IA.
export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;
  const carousel = await authorize(id, "workspace");
  if (carousel instanceof NextResponse) return carousel;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  if (parsed.data.content) {
    const problems = contentProblems({ ...parsed.data.content, slides: parsed.data.content.slides.map((s) => ({ ...s, title: s.title.trim() })) });
    if (problems.length) return NextResponse.json({ error: problems[0] }, { status: 400 });
  }
  const updated = updateCarousel(id, parsed.data);
  if (!updated) return notFound("Carrossel não encontrado");
  return NextResponse.json({ ...updated, hashes: slideHashes(updated, carouselBrand(updated.clientId)!) });
}

export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  const carousel = await authorize(id, "workspace");
  if (carousel instanceof NextResponse) return carousel;
  deleteCarousel(id);
  removeCarouselFiles(id);
  return NextResponse.json({ ok: true });
}
