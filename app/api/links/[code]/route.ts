import { NextResponse } from "next/server";
import { z } from "zod";
import { guardClient, isDenied, notFound } from "@/lib/guard";
import { getLink, updateLink } from "@/lib/links-db";

type Context = { params: Promise<{ code: string }> };

const schema = z.object({ label: z.string().trim().max(80).optional(), archived: z.boolean().optional() });

// Renomear ou arquivar um link (arquivado = /l/código deixa de redirecionar).
export async function PATCH(request: Request, { params }: Context) {
  const { code } = await params;
  const link = getLink(code);
  if (!link) return notFound("Link não encontrado");
  const auth = await guardClient(link.clientId, "workspace");
  if (isDenied(auth)) return auth;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  return NextResponse.json(updateLink(code, parsed.data));
}
