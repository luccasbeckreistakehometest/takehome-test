import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, isDenied, notFound } from "@/lib/guard";
import { getInvoice, sendInvoice, setInvoicePaid, updateDraftInvoice, voidInvoice } from "@/lib/invoices-db";
import { brazilToday, invoiceShareText, reminderText } from "@/lib/invoice-rules";
import { whatsappShareUrl } from "@/lib/approval-link-rules";
import { appBaseUrl } from "@/lib/legal";
import { getClient } from "@/lib/db";
import { getAgency } from "@/lib/agencies";

type Context = { params: Promise<{ id: string }> };

async function authorize(id: string) {
  const invoice = getInvoice(id);
  if (!invoice) return notFound("Fatura não encontrada");
  const auth = await guard(["agency", "admin"], { clientId: invoice.clientId });
  return isDenied(auth) ? auth : invoice;
}

function share(invoiceId: string, kind: "send" | "reminder") {
  const invoice = getInvoice(invoiceId)!;
  const client = getClient(invoice.clientId)!;
  const agencyName = getAgency(invoice.agencyId)?.name ?? "";
  const url = `${appBaseUrl()}/fatura/${invoice.token}`;
  const text =
    kind === "send"
      ? invoiceShareText({ agencyName, clientName: client.name, month: invoice.month, total: invoice.total, dueDate: invoice.dueDate, url, lang: client.language })
      : reminderText({ agencyName, total: invoice.total, dueDate: invoice.dueDate, url, today: brazilToday(), lang: client.language });
  return { url, text, whatsappUrl: whatsappShareUrl(text) };
}

// Lembrete pronto para o WhatsApp.
export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const invoice = await authorize(id);
  if (invoice instanceof NextResponse) return invoice;
  if (invoice.status === "draft") return NextResponse.json({ error: "Envie a fatura primeiro." }, { status: 409 });
  return NextResponse.json({ invoice, ...share(id, "reminder") });
}

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("update"),
    items: z
      .array(z.object({ label: z.string().max(120), amount: z.number().min(0).max(1_000_000), kind: z.enum(["fee", "extra", "manual"]), ref: z.string().max(100).optional() }))
      .max(30)
      .optional(),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }),
  z.object({ action: z.literal("send") }),
  z.object({ action: z.literal("paid") }),
  z.object({ action: z.literal("unpaid") }),
  z.object({ action: z.literal("void") }),
]);

export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;
  const invoice = await authorize(id);
  if (invoice instanceof NextResponse) return invoice;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  const input = parsed.data;
  if (input.action === "update") {
    const result = updateDraftInvoice(id, { items: input.items, dueDate: input.dueDate });
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ invoice: result });
  }
  const result = input.action === "send" ? sendInvoice(id) : input.action === "void" ? voidInvoice(id) : setInvoicePaid(id, input.action === "paid");
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ invoice: result, ...(input.action === "send" ? share(id, "send") : {}) });
}
