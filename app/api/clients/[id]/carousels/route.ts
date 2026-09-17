import { NextResponse } from "next/server";
import { z } from "zod";
import { getClient } from "@/lib/db";
import { guardClient, isDenied } from "@/lib/guard";
import { aiContextFor, aiErrorResponse, gateAi, type AiGate } from "@/lib/metering";
import { runWithAiContext } from "@/lib/ai-spend";
import { aiUsable } from "@/lib/ai-mock";
import { carouselBrand, createCarousel, listCarousels } from "@/lib/carousels-db";
import { cachedCarousel, draftCarousel } from "@/lib/carousel-ai";
import { slideHashes } from "@/lib/carousel-render";
import { CAROUSEL_TEMPLATES, MAX_SLIDES, MIN_SLIDES, sanitizeContent } from "@/lib/carousel-rules";

type Context = { params: Promise<{ id: string }> };
export const maxDuration = 120;

// Carrosséis do cliente (agência ou marca autônoma).
export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guardClient(id, "view");
  if (isDenied(auth)) return auth;
  const brand = carouselBrand(id);
  if (!brand) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  return NextResponse.json({
    aiAvailable: aiUsable(),
    palette: brand.palette,
    hasLogo: Boolean(brand.logo),
    carousels: listCarousels(id).map((c) => ({ ...c, hashes: slideHashes(c, brand) })),
  });
}

const slideSchema = z.object({ title: z.string().max(200), body: z.string().max(600).default(""), visualHint: z.string().max(300).default("") });
const schema = z.object({
  mode: z.enum(["ai", "manual"]),
  topic: z.string().trim().min(2).max(300),
  goal: z.string().trim().max(300).default(""),
  count: z.number().int().min(MIN_SLIDES).max(MAX_SLIDES).default(6),
  template: z.enum(CAROUSEL_TEMPLATES).default("editorial"),
  postId: z.string().max(100).optional(),
  slides: z.array(slideSchema).max(MAX_SLIDES).optional(),
  caption: z.string().max(2200).optional(),
});

// Novo carrossel: pela IA (3 coins; repetir o mesmo pedido sai do cache e
// não cobra) ou escrito à mão (sem IA, sem custo).
export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guardClient(id, "workspace");
  if (isDenied(auth)) return auth;
  const client = getClient(id);
  if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Informe o tema e de 5 a 8 slides." }, { status: 400 });
  const input = parsed.data;

  if (input.mode === "manual") {
    const blank = Array.from({ length: input.count }, (_, i) => ({ title: i === 0 ? input.topic : "", body: "", visualHint: "" }));
    const content = sanitizeContent({ hook: input.topic, slides: input.slides?.length ? input.slides : blank, caption: input.caption ?? "", cta: "", hashtags: [] });
    const carousel = createCarousel({ clientId: id, postId: input.postId ?? null, topic: input.topic, goal: input.goal, template: input.template, content, source: "manual" });
    return NextResponse.json({ carousel, charged: false }, { status: 201 });
  }

  const request_ = { topic: input.topic, goal: input.goal, count: input.count };
  const cached = cachedCarousel(client, request_);
  if (cached) {
    const carousel = createCarousel({ clientId: id, postId: input.postId ?? null, ...request_, template: input.template, content: cached.content, source: cached.demo ? "demo" : "ai" });
    return NextResponse.json({ carousel, charged: false, cached: true, voiceIssues: cached.voiceIssues }, { status: 201 });
  }
  if (!aiUsable()) return NextResponse.json({ error: "A IA não está disponível agora. Escreva os slides à mão.", code: "ai_unavailable" }, { status: 503 });
  let gate: AiGate | null = null;
  try {
    gate = gateAi(request, auth, "carousel", { agencyId: client.agencyId });
    if (!gate.ok) return NextResponse.json({ error: gate.reason, ...(gate.status === 402 ? { code: "no_coins" } : {}) }, { status: gate.status, headers: gate.headers });
    const draft = await runWithAiContext(aiContextFor(auth, "carousel", client.agencyId), () => draftCarousel(client, request_));
    const carousel = createCarousel({ clientId: id, postId: input.postId ?? null, ...request_, template: input.template, content: draft.content, source: draft.demo ? "demo" : "ai" });
    return NextResponse.json({ carousel, charged: true, cached: false, voiceIssues: draft.voiceIssues }, { status: 201 });
  } catch (error) {
    if (gate?.ok) gate.refund();
    return aiErrorResponse(error);
  }
}
