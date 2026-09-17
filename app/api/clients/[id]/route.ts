import { NextResponse } from "next/server";
import { deleteClient, getClient, updateClient } from "@/lib/db";
import { clientSchema } from "@/lib/validation";
import { guardClient, isDenied } from "@/lib/guard";
import { getUserById } from "@/lib/auth";
import { brandOwnsItsWorkspace } from "@/lib/tenancy-rules";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guardClient(id, "view");
  if (isDenied(auth)) return auth;
  const client = getClient(id);
  if (!client) {
    return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }
  // A marca pode trocar o próprio modo? (a agência e o admin sempre podem)
  const canChooseMode =
    auth.role !== "client" ||
    brandOwnsItsWorkspace({ source: client.source, brandSource: getUserById(auth.userId)?.brandSource, agencyId: client.agencyId });
  return NextResponse.json({ ...client, canChooseMode });
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
  // O modo da marca só muda pela rota /mode (com as regras de quem pode).
  const current = getClient(id);
  if (!current) {
    return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }
  const input = auth.role === "client" ? { ...parsed.data, selfServe: current.selfServe } : parsed.data;
  const updated = updateClient(id, input);
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
