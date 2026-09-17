import { NextResponse } from "next/server";
import { exportAccountData } from "@/lib/account-data";
import { guard, isDenied } from "@/lib/guard";

type Context = { params: Promise<{ id: string }> };

// LGPD (admin): exporta os dados de UMA conta quando a pessoa pede pelo
// suporte. Mesmo conteúdo do "Baixar meus dados", só dessa conta.
export async function GET(_request: Request, { params }: Context) {
  const auth = await guard(["admin"]);
  if (isDenied(auth)) return auth;
  const { id } = await params;
  const data = exportAccountData(id);
  if (!data) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="marqa-conta-${id.slice(0, 8)}-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
