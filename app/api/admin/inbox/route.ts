import { NextResponse } from "next/server";
import { z } from "zod";
import { inboxCounts, listInbox, setInboxStatus, type InboxStatus } from "@/lib/contact-db";
import { guard, isDenied } from "@/lib/guard";

// Caixa de entrada: contato e pedidos de acesso (admin).
export async function GET(request: Request) {
  const auth = await guard(["admin"]);
  if (isDenied(auth)) return auth;
  const raw = new URL(request.url).searchParams.get("status");
  const statuses: InboxStatus[] = ["new", "in_progress", "done"];
  const filter = statuses.includes(raw as InboxStatus) ? { status: raw as InboxStatus } : {};
  return NextResponse.json({ messages: listInbox(filter), counts: inboxCounts() });
}

export async function PATCH(request: Request) {
  const auth = await guard(["admin"]);
  if (isDenied(auth)) return auth;
  const parsed = z
    .object({ id: z.string().min(1).max(80), status: z.enum(["new", "in_progress", "done"]) })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  if (!setInboxStatus(parsed.data.id, parsed.data.status)) {
    return NextResponse.json({ error: "Mensagem não encontrada" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, counts: inboxCounts() });
}
