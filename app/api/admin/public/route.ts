import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, isDenied } from "@/lib/guard";
import { bioIndexable, listBiosForAdmin, listLinksForAdmin, setBioPublished, setClientPageIndexable, updateLink } from "@/lib/links-db";

// Moderação do que a Marqa publica no próprio domínio: páginas de bio
// (/b/slug) e links curtos (/l/código). Só admin da plataforma.
export async function GET() {
  const auth = await guard(["admin"]);
  if (isDenied(auth)) return auth;
  return NextResponse.json({
    bios: listBiosForAdmin().map((b) => ({ ...b, indexed: bioIndexable(b.clientId) })),
    links: listLinksForAdmin(),
  });
}

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("unpublish_bio"), clientId: z.string().min(1).max(100) }),
  z.object({ action: z.literal("publish_bio"), clientId: z.string().min(1).max(100) }),
  z.object({ action: z.literal("allow_index"), clientId: z.string().min(1).max(100), on: z.boolean() }),
  z.object({ action: z.literal("archive_link"), code: z.string().min(1).max(20) }),
  z.object({ action: z.literal("restore_link"), code: z.string().min(1).max(20) }),
]);

export async function POST(request: Request) {
  const auth = await guard(["admin"]);
  if (isDenied(auth)) return auth;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  const input = parsed.data;
  const ok =
    input.action === "unpublish_bio"
      ? setBioPublished(input.clientId, false)
      : input.action === "publish_bio"
        ? setBioPublished(input.clientId, true)
        : input.action === "allow_index"
          ? setClientPageIndexable(input.clientId, input.on)
          : Boolean(updateLink(input.code, { archived: input.action === "archive_link" }));
  if (!ok) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
