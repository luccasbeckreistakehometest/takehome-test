import { NextResponse } from "next/server";
import { z } from "zod";
import { createContact, deleteContact, listContacts } from "@/lib/messaging-db";
import { actingAgencyId, agencyOnly, guard, isDenied, tenantOf } from "@/lib/guard";
import { clientAgencyId } from "@/lib/db";

export async function GET(request: Request) {
  const auth = await agencyOnly();
  if (isDenied(auth)) return auth;
  const clientId = new URL(request.url).searchParams.get("clientId") || undefined;
  return NextResponse.json({ contacts: listContacts(tenantOf(auth, request), clientId) });
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
  const auth = await agencyOnly();
  if (isDenied(auth)) return auth;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }
  if (!parsed.data.phone && !parsed.data.instagram) {
    return NextResponse.json({ error: "Informe ao menos um telefone ou @ do Instagram." }, { status: 400 });
  }
  // Contato vinculado a uma marca: a marca precisa ser da agência.
  const agencyId = parsed.data.clientId ? clientAgencyId(parsed.data.clientId) : actingAgencyId(auth, request);
  if (parsed.data.clientId) {
    const owner = await guard(["agency", "admin"], { clientId: parsed.data.clientId });
    if (isDenied(owner)) return owner;
  }
  if (!agencyId) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  return NextResponse.json({ contact: createContact({ ...parsed.data, agencyId }) }, { status: 201 });
}

export async function DELETE(request: Request) {
  const auth = await agencyOnly();
  if (isDenied(auth)) return auth;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
  if (!deleteContact(tenantOf(auth), id)) return NextResponse.json({ error: "Contato não encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
