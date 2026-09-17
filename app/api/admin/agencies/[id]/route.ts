import { NextResponse } from "next/server";
import { z } from "zod";
import { getAgency, saveAgencyPageConfig, setAgencyPageIndexable } from "@/lib/agencies";
import { guard, isDenied } from "@/lib/guard";
import { HOUSE_AGENCY_ID } from "@/lib/tenancy-rules";

type Context = { params: Promise<{ id: string }> };

const schema = z.object({
  // libera (true) ou tira (false) a página do Google
  pageIndexable: z.boolean().optional(),
  // despublica a página (denúncia, abuso); a agência pode publicar de novo
  unpublish: z.literal(true).optional(),
});

// Moderação da página pública de uma agência (só admin).
export async function PATCH(request: Request, { params }: Context) {
  const auth = await guard(["admin"]);
  if (isDenied(auth)) return auth;
  const { id } = await params;
  if (!getAgency(id)) return NextResponse.json({ error: "Agência não encontrada" }, { status: 404 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  if (parsed.data.pageIndexable !== undefined) {
    if (id === HOUSE_AGENCY_ID) return NextResponse.json({ error: "A página da casa é sempre indexada." }, { status: 400 });
    setAgencyPageIndexable(id, parsed.data.pageIndexable);
  }
  if (parsed.data.unpublish) {
    const result = saveAgencyPageConfig(id, { published: false });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
