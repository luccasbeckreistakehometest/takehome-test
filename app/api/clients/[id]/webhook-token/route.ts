import { NextResponse } from "next/server";
import { guardClient, isDenied } from "@/lib/guard";
import { getSalesWebhookToken, rotateSalesWebhookToken } from "@/lib/webhook-auth";

type Context = { params: Promise<{ id: string }> };

// Token do webhook de vendas deste cliente (URL para a loja/marketplace).
export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guardClient(id, "workspace");
  if (isDenied(auth)) return auth;
  return NextResponse.json({ token: getSalesWebhookToken(id) });
}

// Gera (ou troca) o token. O anterior para de funcionar na hora.
export async function POST(_request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guardClient(id, "workspace");
  if (isDenied(auth)) return auth;
  return NextResponse.json({ token: rotateSalesWebhookToken(id) }, { status: 201 });
}
