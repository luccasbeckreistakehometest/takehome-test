import { NextResponse } from "next/server";
import { listInbound, markInboundRead } from "@/lib/messaging-db";
import { agencyOnly, isDenied, tenantOf } from "@/lib/guard";

export async function GET(request: Request) {
  const auth = await agencyOnly();
  if (isDenied(auth)) return auth;
  return NextResponse.json({ inbound: listInbound(tenantOf(auth, request)) });
}

export async function PATCH() {
  const auth = await agencyOnly();
  if (isDenied(auth)) return auth;
  markInboundRead(tenantOf(auth));
  return NextResponse.json({ ok: true });
}
