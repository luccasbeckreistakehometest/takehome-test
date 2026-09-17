import { NextResponse } from "next/server";
import { z } from "zod";
import { listConnections, saveConnection } from "@/lib/messaging-db";
import { agencyOnly, isDenied } from "@/lib/guard";

export async function GET() {
  const auth = await agencyOnly();
  if (isDenied(auth)) return auth;
  // Nunca devolve o token cheio — só se está configurado
  const conns = listConnections().map((c) => ({
    ...c,
    apiToken: c.apiToken ? "•••• configurado" : "",
    hasToken: !!c.apiToken,
  }));
  return NextResponse.json({ connections: conns });
}

const schema = z.object({
  channel: z.enum(["whatsapp", "instagram"]),
  mode: z.enum(["api", "session"]),
  apiToken: z.string().trim().default(""),
  apiAccountId: z.string().trim().default(""),
  sessionReady: z.boolean().optional(),
});

export async function POST(request: Request) {
  const auth = await agencyOnly();
  if (isDenied(auth)) return auth;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }
  const conn = saveConnection(parsed.data);
  return NextResponse.json({ connection: { ...conn, apiToken: conn.apiToken ? "•••• configurado" : "" } }, { status: 201 });
}
