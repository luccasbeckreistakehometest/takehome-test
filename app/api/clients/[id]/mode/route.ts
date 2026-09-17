import { NextResponse } from "next/server";
import { z } from "zod";
import { clientAgencyId, getClient, setClientSelfServe } from "@/lib/db";
import { getSession, reissueSession } from "@/lib/session";
import { getUserById, homeForUser } from "@/lib/auth";
import { brandOwnsItsWorkspace } from "@/lib/tenancy-rules";

type Context = { params: Promise<{ id: string }> };

// Define como a marca quer trabalhar:
//  - selfServe: true  → autônoma (workspace próprio)
//  - selfServe: false → gerenciada por uma agência (portal read-only)
// A marca que se cadastrou sozinha decide; marca de uma agência (criada,
// convidada ou fechada por proposta) só muda pela agência. Admin sempre.
// Quando é a própria marca, reemite a sessão para o middleware/rotas passarem a
// enxergar o novo modo sem precisar relogar.
export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const client0 = session.role === "client" && session.refId === id ? getClient(id) : null;
  const isOwner = Boolean(
    client0 &&
      brandOwnsItsWorkspace({
        source: client0.source,
        brandSource: getUserById(session.userId)?.brandSource,
        agencyId: client0.agencyId,
      })
  );
  // Agência só troca o modo de marca dela.
  const isManager =
    session.role === "admin" || (session.role === "agency" && clientAgencyId(id) === session.agencyId);
  if (!isOwner && !isManager) {
    const error = session.role === "client" ? "Quem muda o modo da sua marca é a sua agência." : "Acesso negado";
    return NextResponse.json({ error }, { status: 403 });
  }
  const parsed = z
    .object({ selfServe: z.boolean() })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Modo inválido" }, { status: 400 });
  }
  const client = setClientSelfServe(id, parsed.data.selfServe);
  if (!client) {
    return NextResponse.json({ error: "Marca não encontrada" }, { status: 404 });
  }

  const home = homeForUser(
    { role: "client", refId: id },
    { selfServe: parsed.data.selfServe }
  );
  const response = NextResponse.json({ ok: true, selfServe: parsed.data.selfServe, home });

  // Só reemite a sessão quando quem troca é a própria marca.
  if (isOwner) {
    await reissueSession(response, session, { selfServe: parsed.data.selfServe });
  }
  return response;
}
