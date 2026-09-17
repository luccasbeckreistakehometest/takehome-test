import { NextResponse } from "next/server";
import { z } from "zod";
import { createBroadcastList, deleteBroadcastList, listBroadcastLists } from "@/lib/messaging-db";
import { actingAgencyId, agencyOnly, isDenied, tenantOf } from "@/lib/guard";

export async function GET(request: Request) {
  const auth = await agencyOnly();
  if (isDenied(auth)) return auth;
  return NextResponse.json({ lists: listBroadcastLists(tenantOf(auth, request)) });
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
  const list = createBroadcastList({ ...parsed.data, agencyId: actingAgencyId(auth, request) });
  if (list.contactIds.length === 0) {
    return NextResponse.json({ error: "Nenhum dos contatos escolhidos foi encontrado." }, { status: 400 });
  }
  return NextResponse.json({ list }, { status: 201 });
}

export async function DELETE(request: Request) {
  const auth = await agencyOnly();
  if (isDenied(auth)) return auth;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
  if (!deleteBroadcastList(tenantOf(auth), id)) return NextResponse.json({ error: "Lista não encontrada" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
