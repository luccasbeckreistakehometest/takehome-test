import { NextResponse } from "next/server";
import { z } from "zod";
import { actingAgencyId, guard, isDenied } from "@/lib/guard";
import { getInvoiceSettings, saveInvoiceSettings } from "@/lib/invoices-db";
import { settingsReady } from "@/lib/invoice-rules";
import { buildPixPayload } from "@/lib/pix";

// Recebimentos da agência: chave Pix, favorecido, cidade e vencimento padrão.
export async function GET(request: Request) {
  const auth = await guard(["agency", "admin"]);
  if (isDenied(auth)) return auth;
  const settings = getInvoiceSettings(actingAgencyId(auth, request));
  return NextResponse.json({ settings, ready: settingsReady(settings) });
}

const schema = z.object({
  pixKey: z.string().trim().max(80).default(""),
  beneficiaryName: z.string().trim().max(60).default(""),
  city: z.string().trim().max(40).default(""),
  dueDay: z.number().int().min(1).max(28).default(10),
  lateNote: z.string().trim().max(200).default(""),
});

export async function PUT(request: Request) {
  const auth = await guard(["agency", "admin"]);
  if (isDenied(auth)) return auth;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Confira os dados de recebimento." }, { status: 400 });
  const result = saveInvoiceSettings(actingAgencyId(auth, request), parsed.data);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  const ready = settingsReady(result.settings);
  // confere que o código Pix sai válido com esses dados (R$ 1,00 de teste)
  if (ready) {
    try {
      buildPixPayload({ key: result.settings.pixKey, name: result.settings.beneficiaryName, city: result.settings.city, amount: 1 });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Dados de Pix inválidos." }, { status: 400 });
    }
  }
  return NextResponse.json({ settings: result.settings, ready });
}
