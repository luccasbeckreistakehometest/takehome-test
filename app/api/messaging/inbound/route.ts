import { NextResponse } from "next/server";
import { listInbound, markInboundRead } from "@/lib/messaging-db";
import { agencyOnly, isDenied } from "@/lib/guard";

export async function GET() {
  const auth = await agencyOnly();
  if (isDenied(auth)) return auth;
  return NextResponse.json({ inbound: listInbound() });
}

export async function PATCH() {
  const auth = await agencyOnly();
  if (isDenied(auth)) return auth;
  markInboundRead();
  return NextResponse.json({ ok: true });
}
