import { NextResponse } from "next/server";
import { listGenerations } from "@/lib/db";
import { GENERATION_TYPES, type GenerationType } from "@/lib/types";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const clientId = url.searchParams.get("clientId");
  const type = url.searchParams.get("type");
  if (!clientId) {
    return NextResponse.json({ error: "clientId é obrigatório" }, { status: 400 });
  }
  const validType = GENERATION_TYPES.includes(type as GenerationType)
    ? (type as GenerationType)
    : undefined;
  return NextResponse.json(listGenerations(clientId, validType));
}
