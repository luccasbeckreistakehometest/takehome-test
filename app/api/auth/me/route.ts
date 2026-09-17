import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

// Sessão atual (já checada contra revogação e conta desativada).
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ role: null });
  const { userId, role, refId, name, brandSource, selfServe } = session;
  return NextResponse.json({ userId, role, refId, name, brandSource, selfServe });
}
