import { NextResponse } from "next/server";
import { getConnection, latestSnapshots, listConnections } from "@/lib/integrations-db";
import { syncConnection } from "@/lib/integrations/sync";
import { guardClient, isDenied } from "@/lib/guard";

export const maxDuration = 120;
type Context = { params: Promise<{ id: string }> };

// Puxa métricas de todas as conexões com token (ou de uma específica).
export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guardClient(id, "workspace");
  if (isDenied(auth)) return auth;
  const only = new URL(request.url).searchParams.get("platform");
  const targets = only
    ? [getConnection(id, only as never)].filter(Boolean)
    : listConnections(id).filter((c) => c.accessToken);
  if (targets.length === 0) {
    return NextResponse.json({ error: "Nenhuma conexão com credencial para sincronizar." }, { status: 400 });
  }
  const results: { platform: string; ok: boolean; error?: string }[] = [];
  for (const conn of targets) {
    try {
      await syncConnection(conn!);
      results.push({ platform: conn!.platform, ok: true });
    } catch (e) {
      results.push({ platform: conn!.platform, ok: false, error: e instanceof Error ? e.message : "erro" });
    }
  }
  return NextResponse.json({ results, snapshots: latestSnapshots(id) });
}

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guardClient(id, "view");
  if (isDenied(auth)) return auth;
  return NextResponse.json({ snapshots: latestSnapshots(id) });
}
