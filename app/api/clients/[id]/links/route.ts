import { NextResponse } from "next/server";
import { z } from "zod";
import { guardClient, isDenied } from "@/lib/guard";
import { createLink, getBio, listLinks, suggestBioSlug } from "@/lib/links-db";
import { validateDestUrl } from "@/lib/links-rules";
import { getScheduledPost } from "@/lib/marketplace-db";
import { appBaseUrl } from "@/lib/legal";
import { checkLimits, retryAfterHeader } from "@/lib/rate-limit";

type Context = { params: Promise<{ id: string }> };

const withUrl = <T extends { code: string }>(link: T) => ({ ...link, shortUrl: `${appBaseUrl()}/l/${link.code}` });

// Links rastreáveis do cliente (+ a página de bio).
export async function GET(request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guardClient(id, "view");
  if (isDenied(auth)) return auth;
  const url = new URL(request.url);
  const postId = url.searchParams.get("postId") ?? undefined;
  return NextResponse.json({
    links: listLinks(id, { postId, includeArchived: url.searchParams.get("archived") === "1" }).map(withUrl),
    bio: getBio(id),
    suggestedSlug: suggestBioSlug(id),
    base: appBaseUrl(),
  });
}

const schema = z.object({
  destUrl: z.string().max(2000),
  label: z.string().trim().max(80).default(""),
  postId: z.string().max(100).optional(),
  channel: z.string().trim().max(40).optional(),
});

export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guardClient(id, "workspace");
  if (isDenied(auth)) return auth;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  const verdict = checkLimits([["linksPerAccount", auth.userId]]);
  if (!verdict.ok) {
    return NextResponse.json({ error: "Muitos links criados agora há pouco. Espere um pouco." }, { status: 429, headers: retryAfterHeader(verdict) });
  }
  const dest = validateDestUrl(parsed.data.destUrl, new URL(appBaseUrl()).hostname);
  if (!dest.ok) return NextResponse.json({ error: dest.error }, { status: 400 });
  if (parsed.data.postId) {
    const post = getScheduledPost(parsed.data.postId);
    if (!post || post.clientId !== id) return NextResponse.json({ error: "Post não encontrado" }, { status: 404 });
  }
  const link = createLink({ clientId: id, destUrl: dest.url, label: parsed.data.label, postId: parsed.data.postId ?? null, channel: parsed.data.channel ?? null });
  return NextResponse.json(withUrl(link), { status: 201 });
}
