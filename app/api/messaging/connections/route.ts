import { NextResponse } from "next/server";
import { z } from "zod";
import { listConnections, saveConnection } from "@/lib/messaging-db";
import { actingAgencyId, agencyOnly, isDenied } from "@/lib/guard";
import { sessionModeAvailableFor } from "@/lib/messaging/worker-manager";

// Conexões da agência (admin: a do ?agency=, ou a da casa).
export async function GET(request: Request) {
  const auth = await agencyOnly();
  if (isDenied(auth)) return auth;
  const agencyId = actingAgencyId(auth, request);
  // Nunca devolve o token cheio — só se está configurado
  const conns = listConnections(agencyId).map((c) => ({
    ...c,
    apiToken: c.apiToken ? "•••• configurado" : "",
    hasToken: !!c.apiToken,
  }));
  return NextResponse.json({ connections: conns, sessionModeAvailable: sessionModeAvailableFor(agencyId) });
}

const schema = z.object({
  channel: z.enum(["whatsapp", "instagram"]),
  mode: z.enum(["api", "session"]),
  apiToken: z.string().trim().max(1000).default(""),
  apiAccountId: z.string().trim().max(100).default(""),
  sessionReady: z.boolean().optional(),
});

export async function POST(request: Request) {
  const auth = await agencyOnly();
  if (isDenied(auth)) return auth;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }
  const agencyId = actingAgencyId(auth, request);
  if (parsed.data.mode === "session" && !sessionModeAvailableFor(agencyId)) {
    return NextResponse.json(
      { error: "O modo sessão não está disponível neste servidor. Use a API oficial da Meta." },
      { status: 400 }
    );
  }
  const conn = saveConnection({ ...parsed.data, agencyId });
  return NextResponse.json({ connection: { ...conn, apiToken: conn.apiToken ? "•••• configurado" : "" } }, { status: 201 });
}
