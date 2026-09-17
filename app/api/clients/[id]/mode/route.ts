import { NextResponse } from "next/server";
import { z } from "zod";
import { clientAgencyId, setClientSelfServe } from "@/lib/db";
import { getSession, reissueSession } from "@/lib/session";
import { homeForUser } from "@/lib/auth";

type Context = { params: Promise<{ id: string }> };

// Define como a marca quer trabalhar:
//  - selfServe: true  → autônoma (workspace próprio)
//  - selfServe: false → gerenciada por uma agência (portal read-only)
// A própria marca decide; agência/admin também podem alternar por ela.
// Quando é a própria marca, reemite a sessão para o middleware/rotas passarem a
// enxergar o novo modo sem precisar relogar.
export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const isOwner = session.role === "client" && session.refId === id;
  // Agência só troca o modo de marca dela.
  const isManager =
    session.role === "admin" || (session.role === "agency" && clientAgencyId(id) === session.agencyId);
  if (!isOwner && !isManager) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
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
