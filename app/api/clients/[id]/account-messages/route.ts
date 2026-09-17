import { NextResponse } from "next/server";
import { z } from "zod";
import { getClient } from "@/lib/db";
import {
  createAccountMessage,
  listAccountMessages,
  logActivity,
} from "@/lib/marketplace-db";
import { actorRole, guardClient, isDenied } from "@/lib/guard";

type Context = { params: Promise<{ id: string }> };

// Chat da conta: canal direto cliente ↔ agência (fora das demandas)
export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guardClient(id, "view");
  if (isDenied(auth)) return auth;
  return NextResponse.json(listAccountMessages(id));
}

export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guardClient(id, "portal");
  if (isDenied(auth)) return auth;
  const client = getClient(id);
  if (!client) {
    return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }
  const parsed = z
    .object({ text: z.string().trim().min(1).max(4000) })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Mensagem inválida" }, { status: 400 });
  }
  // Quem envia vem da sessão (a marca não fala "como agência").
  const sender = actorRole(auth) === "client" ? "client" : "agency";
  const data = { sender, text: parsed.data.text } as const;
  const message = createAccountMessage({ clientId: id, ...data });
  logActivity({
    audience: data.sender === "client" ? "agency" : "client",
    clientId: id,
    text:
      data.sender === "client"
        ? `${client.name} enviou uma mensagem: "${data.text.slice(0, 80)}"`
        : `A agência respondeu na conta ${client.name}`,
    href: data.sender === "client" ? `/clients/${id}` : `/portal/client/${id}`,
  });
  return NextResponse.json(message, { status: 201 });
}
