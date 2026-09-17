import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Saúde do app para o healthcheck do compose e monitores externos.
// Público, só leitura, sem segredos.
export async function GET() {
  let dbOk = false;
  try {
    dbOk = (db.prepare("SELECT 1 AS ok").get() as { ok: number } | undefined)?.ok === 1;
  } catch {
    dbOk = false;
  }
  return NextResponse.json(
    { ok: dbOk, db: dbOk ? "ok" : "error" },
    { status: dbOk ? 200 : 503, headers: { "Cache-Control": "no-store" } }
  );
}
