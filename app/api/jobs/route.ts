import { NextResponse } from "next/server";
import { listJobs } from "@/lib/marketplace-db";
import { getSession } from "@/lib/session";
import { tenantOf } from "@/lib/guard";

// Jobs de IA em andamento/recentes — a UI mostra progresso mesmo após refresh.
// A agência vê os dela (admin, todos); a marca só os dela; os demais, nenhum.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (session.role === "agency" || session.role === "admin") return NextResponse.json(listJobs(tenantOf(session)));
  if (session.role === "client" && session.refId) {
    return NextResponse.json(listJobs(tenantOf(session), session.refId));
  }
  return NextResponse.json([]);
}
