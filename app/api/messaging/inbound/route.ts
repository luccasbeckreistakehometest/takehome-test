import { NextResponse } from "next/server";
import { listInbound, markInboundRead } from "@/lib/messaging-db";

export async function GET() {
  return NextResponse.json({ inbound: listInbound() });
}

export async function PATCH() {
  markInboundRead();
  return NextResponse.json({ ok: true });
}
