import { NextResponse } from "next/server";
import { listJobs } from "@/lib/marketplace-db";
import { getSession } from "@/lib/session";

// Jobs de IA em andamento/recentes — a UI mostra progresso mesmo após refresh.
// A agência vê todos; a marca só os dela; os demais, nenhum.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const jobs = listJobs();
  if (session.role === "agency" || session.role === "admin") return NextResponse.json(jobs);
  if (session.role === "client") return NextResponse.json(jobs.filter((job) => job.clientId === session.refId));
  return NextResponse.json([]);
}
