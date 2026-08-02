import { NextResponse } from "next/server";
import { z } from "zod";
import { createContact, deleteContact, listContacts } from "@/lib/messaging-db";

export async function GET(request: Request) {
  const clientId = new URL(request.url).searchParams.get("clientId") || undefined;
  return NextResponse.json({ contacts: listContacts(clientId) });
}

const schema = z.object({
  name: z.string().trim().min(1, "Informe o nome"),
  phone: z.string().trim().default(""),
  instagram: z.string().trim().default(""),
  clientId: z.string().nullable().default(null),
  tags: z.string().trim().default(""),
  notes: z.string().trim().default(""),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }
  if (!parsed.data.phone && !parsed.data.instagram) {
    return NextResponse.json({ error: "Informe ao menos um telefone ou @ do Instagram." }, { status: 400 });
  }
  return NextResponse.json({ contact: createContact(parsed.data) }, { status: 201 });
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
  deleteContact(id);
  return NextResponse.json({ ok: true });
}
