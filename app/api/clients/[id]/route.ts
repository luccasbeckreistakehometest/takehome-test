import { NextResponse } from "next/server";
import { deleteClient, getClient, updateClient } from "@/lib/db";
import { clientSchema } from "@/lib/validation";
import { guardClient, isDenied } from "@/lib/guard";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guardClient(id, "view");
  if (isDenied(auth)) return auth;
  const client = getClient(id);
  if (!client) {
    return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }
  return NextResponse.json(client);
}

export async function PUT(request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guardClient(id, "workspace");
  if (isDenied(auth)) return auth;
  const parsed = clientSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
      { status: 400 }
    );
  }
  const updated = updateClient(id, parsed.data);
  if (!updated) {
    return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }
  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guardClient(id, "agency");
  if (isDenied(auth)) return auth;
  if (!deleteClient(id)) {
    return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
