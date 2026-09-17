import { NextResponse } from "next/server";
import { z } from "zod";
import { clientAgencyId, getClient } from "@/lib/db";
import { agencyScope } from "@/lib/tenancy-rules";
import { guard, isDenied } from "@/lib/guard";
import { attendantStats, getAttendant, listReplies, saveAttendant } from "@/lib/attendant-db";
import { DEFAULT_ATTENDANT_CONFIG } from "@/lib/attendant-rules";
import { resolveSendMode } from "@/lib/attendant";
import { listInbound } from "@/lib/messaging-db";

type Context = { params: Promise<{ id: string }> };

function view(clientId: string) {
  const cfg = getAttendant(clientId) ?? DEFAULT_ATTENDANT_CONFIG;
  const agencyId = clientAgencyId(clientId) ?? "";
  const route = resolveSendMode(cfg, agencyId);
  return {
    config: { ...cfg, apiToken: "", hasToken: Boolean(cfg.apiToken) },
    channel: {
      ready: route.ok,
      via: route.ok ? (cfg.phoneNumberId && cfg.apiToken ? "own_number" : `agency_${route.mode}`) : "none",
    },
    stats: attendantStats(clientId),
    replies: listReplies(clientId, 50),
    inbound: listInbound(agencyScope(agencyId), 50, clientId),
  };
}

// Atendente de WhatsApp com IA do cliente: configuração (token nunca volta ao
// navegador), log de respostas e mensagens recebidas. Agência, admin e a
// própria marca.
export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guard(["agency", "admin"], { clientId: id });
  if (isDenied(auth)) return auth;
  if (!getClient(id)) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  return NextResponse.json(view(id));
}

const schema = z.object({
  mode: z.enum(["off", "draft", "auto"]).optional(),
  phoneNumberId: z.string().trim().max(64).optional(),
  // vazio = manter; "clear" = apagar
  apiToken: z.string().trim().max(512).optional(),
  hoursStart: z.number().int().min(0).max(23).optional(),
  hoursEnd: z.number().int().min(1).max(24).optional(),
  days: z.array(z.number().int().min(0).max(6)).optional(),
  timezone: z.string().trim().max(64).optional(),
  maxAutoPerContactPerDay: z.number().int().min(1).max(50).optional(),
  minConfidence: z.number().min(0).max(1).optional(),
  instructions: z.string().max(4000).optional(),
  handoffMessage: z.string().max(500).optional(),
});

export async function PUT(request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guard(["agency", "admin"], { clientId: id });
  if (isDenied(auth)) return auth;
  if (!getClient(id)) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }
  const current = getAttendant(id) ?? DEFAULT_ATTENDANT_CONFIG;
  const { apiToken, ...rest } = parsed.data;
  const token = apiToken === undefined || apiToken === "" ? current.apiToken : apiToken.toLowerCase() === "clear" ? "" : apiToken;
  saveAttendant(id, { ...rest, apiToken: token });
  return NextResponse.json(view(id));
}
