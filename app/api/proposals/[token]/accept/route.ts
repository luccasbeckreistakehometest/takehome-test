import { NextResponse } from "next/server";
import { z } from "zod";
import { acceptProposal } from "@/lib/proposals-db";

type Context = { params: Promise<{ token: string }> };

const schema = z.object({
  packageName: z.string().trim().min(1).max(80),
  name: z.string().trim().min(2, "Informe seu nome").max(120),
  contact: z.string().trim().min(5, "Informe um WhatsApp ou e-mail").max(160),
});

// Aceite público: sem login. O token é o segredo; a proposta precisa estar
// aberta (não aceita, não expirada) e o pacote existir.
export async function POST(request: Request, { params }: Context) {
  const { token } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }
  const result = acceptProposal({ token, ...parsed.data });
  if (!result.ok) {
    const status = result.reason === "not_found" ? 404 : result.reason === "unknown_package" ? 400 : 409;
    return NextResponse.json({ error: result.reason }, { status });
  }
  return NextResponse.json(result, { status: 201 });
}
