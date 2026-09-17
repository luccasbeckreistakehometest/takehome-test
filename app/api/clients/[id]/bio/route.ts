import { NextResponse } from "next/server";
import { z } from "zod";
import { guardClient, isDenied } from "@/lib/guard";
import { saveBio } from "@/lib/links-db";

type Context = { params: Promise<{ id: string }> };

const schema = z.object({
  slug: z.string().trim().max(60).optional(),
  title: z.string().trim().max(80).optional(),
  bio: z.string().trim().max(280).optional(),
  buttons: z.array(z.object({ code: z.string().max(10), label: z.string().max(80).default("") })).max(8).optional(),
  published: z.boolean().optional(),
  indexable: z.boolean().optional(),
});

// Página "link na bio" do cliente: endereço, textos, botões (links
// rastreáveis) e se aparece no Google (padrão: não).
export async function PUT(request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guardClient(id, "workspace");
  if (isDenied(auth)) return auth;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  const result = saveBio(id, parsed.data);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result.bio);
}
