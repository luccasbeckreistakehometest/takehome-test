import { NextResponse } from "next/server";
import { z } from "zod";
import { getClient } from "@/lib/db";
import {
  createAccountMessage,
  listAccountMessages,
  logActivity,
} from "@/lib/marketplace-db";

type Context = { params: Promise<{ id: string }> };

// Chat da conta: canal direto cliente ↔ agência (fora das demandas)
export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  return NextResponse.json(listAccountMessages(id));
}

export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  const client = getClient(id);
  if (!client) {
    return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }
  const parsed = z
    .object({ sender: z.enum(["agency", "client"]), text: z.string().trim().min(1) })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Mensagem inválida" }, { status: 400 });
  }
  const message = createAccountMessage({ clientId: id, ...parsed.data });
  logActivity({
    audience: parsed.data.sender === "client" ? "agency" : "client",
    clientId: id,
    text:
      parsed.data.sender === "client"
        ? `${client.name} enviou uma mensagem: "${parsed.data.text.slice(0, 80)}"`
        : `A agência respondeu na conta ${client.name}`,
    href: parsed.data.sender === "client" ? `/clients/${id}` : `/portal/client/${id}`,
  });
  return NextResponse.json(message, { status: 201 });
}
