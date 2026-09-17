import { NextResponse } from "next/server";
import { z } from "zod";
import { getClient } from "@/lib/db";
import { guardClient, isDenied } from "@/lib/guard";
import { clientPackageUsage, deletePackage, listScopeRequests, savePackage } from "@/lib/scope-db";
import { PACKAGE_PRESETS, SCOPE_UNITS } from "@/lib/scope-rules";
import { scopeAiAvailable } from "@/lib/scope-ai";

type Context = { params: Promise<{ id: string }> };

// Pacote do mês e uso (agência e o próprio cliente no portal).
export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guardClient(id, "view");
  if (isDenied(auth)) return auth;
  if (!getClient(id)) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  const agencyView = auth.role !== "client";
  return NextResponse.json({
    ...clientPackageUsage(id),
    requests: listScopeRequests(id),
    aiClassifier: scopeAiAvailable(),
    ...(agencyView ? { presets: PACKAGE_PRESETS, units: SCOPE_UNITS } : {}),
  });
}

const itemSchema = z.object({
  key: z.string().trim().max(30).optional(),
  label: z.string().trim().min(1).max(60),
  unit: z.enum(SCOPE_UNITS),
  qty: z.number().int().min(0).max(999),
  extraPrice: z.number().min(0).max(100000),
});
const schema = z.object({ items: z.array(itemSchema).max(12), rolloverUnused: z.boolean().default(false) });

// Só a agência define o pacote.
export async function PUT(request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guardClient(id, "agency");
  if (isDenied(auth)) return auth;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Confira os itens do pacote." }, { status: 400 });
  if (parsed.data.items.length === 0) {
    deletePackage(id);
    return NextResponse.json(clientPackageUsage(id));
  }
  savePackage(id, parsed.data);
  return NextResponse.json(clientPackageUsage(id));
}
