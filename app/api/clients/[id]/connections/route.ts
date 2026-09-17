import { NextResponse } from "next/server";
import { z } from "zod";
import { guardClient, isDenied } from "@/lib/guard";
import { deleteConnection, listConnections, upsertConnection, type ConnectorPlatform } from "@/lib/integrations-db";

type Context = { params: Promise<{ id: string }> };

// Nunca devolve o token; só se está configurado.
export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guardClient(id, "workspace");
  if (isDenied(auth)) return auth;
  const connections = listConnections(id).map((c) => ({
    platform: c.platform,
    accountId: c.accountId,
    status: c.status,
    lastSyncAt: c.lastSyncAt,
    lastError: c.lastError,
    hasToken: !!c.accessToken,
  }));
  return NextResponse.json({ connections });
}

const schema = z.object({
  platform: z.enum(["ga4", "meta_ads", "google_ads", "tiktok_ads", "sales_api"]),
  accountId: z.string().trim().default(""),
  accessToken: z.string().trim().default(""),
  // OAuth (opcional) — para renovar o token automaticamente (GA4/Google)
  refreshToken: z.string().trim().default(""),
  oauthClientId: z.string().trim().default(""),
  oauthClientSecret: z.string().trim().default(""),
});

export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guardClient(id, "workspace");
  if (isDenied(auth)) return auth;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }
  const conn = upsertConnection({ clientId: id, ...parsed.data });
  return NextResponse.json({ platform: conn.platform, status: conn.status }, { status: 201 });
}

export async function DELETE(request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guardClient(id, "workspace");
  if (isDenied(auth)) return auth;
  const platform = new URL(request.url).searchParams.get("platform") as ConnectorPlatform | null;
  if (!platform) return NextResponse.json({ error: "platform ausente" }, { status: 400 });
  deleteConnection(id, platform);
  return NextResponse.json({ ok: true });
}
