import { NextResponse } from "next/server";
import { exportAccountData } from "@/lib/account-data";
import { getSession } from "@/lib/session";
import { checkLimits, retryAfterHeader } from "@/lib/rate-limit";

// "Baixar meus dados": JSON com tudo o que a conta tem na plataforma.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const verdict = checkLimits([["exportPerAccount", session.userId]]);
  if (!verdict.ok) {
    return NextResponse.json({ error: "Você já baixou seus dados agora há pouco. Tente mais tarde." }, { status: 429, headers: retryAfterHeader(verdict) });
  }
  const data = exportAccountData(session.userId);
  if (!data) return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="marqa-meus-dados-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
