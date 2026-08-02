import { NextResponse } from "next/server";
import { listJobs } from "@/lib/marketplace-db";

// Jobs de IA em andamento/recentes — a UI mostra progresso mesmo após refresh
export async function GET() {
  return NextResponse.json(listJobs());
}
