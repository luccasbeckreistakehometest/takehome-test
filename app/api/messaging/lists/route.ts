import { NextResponse } from "next/server";
import { z } from "zod";
import { createBroadcastList, deleteBroadcastList, listBroadcastLists } from "@/lib/messaging-db";
import { agencyOnly, isDenied } from "@/lib/guard";

export async function GET() {
  const auth = await agencyOnly();
  if (isDenied(auth)) return auth;
  return NextResponse.json({ lists: listBroadcastLists() });
}

const schema = z.object({
  name: z.string().trim().min(1, "Informe o nome da lista"),
  channel: z.enum(["whatsapp", "instagram"]),
  contactIds: z.array(z.string()).min(1, "Selecione ao menos um contato"),
});

export async function POST(request: Request) {
  const auth = await agencyOnly();
  if (isDenied(auth)) return auth;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }
  return NextResponse.json({ list: createBroadcastList(parsed.data) }, { status: 201 });
}

export async function DELETE(request: Request) {
  const auth = await agencyOnly();
  if (isDenied(auth)) return auth;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
  deleteBroadcastList(id);
  return NextResponse.json({ ok: true });
}
