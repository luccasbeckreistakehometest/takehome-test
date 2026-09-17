import { NextResponse } from "next/server";
import { guard, isDenied } from "@/lib/guard";
import { pulseOverview } from "@/lib/pulse-db";

// Visão da agência: satisfação por cliente (tendência) e quem está em risco.
export async function GET() {
  const auth = await guard(["agency", "admin"]);
  if (isDenied(auth)) return auth;
  return NextResponse.json(pulseOverview());
}
