import { NextResponse } from "next/server";
import { getClient } from "@/lib/db";
import { createSale } from "@/lib/integrations-db";
import { salesTokenAccepted } from "@/lib/webhook-auth";
import { checkLimits, clientIp } from "@/lib/rate-limit";

type Context = { params: Promise<{ clientId: string }> };

// Webhook GENÉRICO de vendas: recebe pedidos de marketplaces/lojas (Shopify,
// Mercado Livre, loja própria) e registra como venda do cliente, alimentando
// ROI e Insights. Funciona para produto OU serviço.
// Configure na origem: URL = /api/webhooks/sales/<clientId>?token=<token do
// cliente> (ou o cabeçalho X-Webhook-Token). Sem token válido, nada entra.
export async function POST(request: Request, { params }: Context) {
  const { clientId } = await params;
  if (!checkLimits([["webhookPerIp", clientIp(request)]]).ok) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }
  const presented = request.headers.get("x-webhook-token") ?? new URL(request.url).searchParams.get("token");
  // Mesmo erro para cliente inexistente e token errado (não revela ids).
  if (!getClient(clientId) || !salesTokenAccepted(clientId, presented)) {
    return NextResponse.json({ error: "token inválido" }, { status: 403 });
  }

  const payload = await request.json().catch(() => null);
  if (!payload) return NextResponse.json({ error: "payload vazio" }, { status: 400 });

  // Normaliza os formatos mais comuns:
  let revenue = 0;
  let units = 0;
  let source = "webhook";
  let currency = "BRL";
  let kind: "product" | "service" = "product";

  if (payload.total_price !== undefined || Array.isArray(payload.line_items)) {
    // Shopify: order/create
    revenue = Number(payload.total_price ?? 0);
    units = (payload.line_items ?? []).reduce(
      (sum: number, li: { quantity?: number }) => sum + Number(li.quantity ?? 0),
      0
    );
    currency = payload.currency ?? "BRL";
    source = "Shopify";
  } else if (payload.order !== undefined || payload.total_amount !== undefined) {
    // Mercado Livre / genérico simplificado
    revenue = Number(payload.total_amount ?? payload.order?.total_amount ?? 0);
    units = Number(payload.quantity ?? payload.order?.quantity ?? 1);
    currency = payload.currency_id ?? "BRL";
    source = "Mercado Livre";
  } else {
    // Payload normalizado próprio
    revenue = Number(payload.revenue ?? 0);
    units = Number(payload.units ?? 0);
    source = String(payload.source ?? "webhook");
    currency = String(payload.currency ?? "BRL");
    kind = payload.kind === "service" ? "service" : "product";
  }

  if (!Number.isFinite(revenue) || !revenue || revenue < 0 || revenue > 100_000_000) {
    return NextResponse.json({ error: "sem valor de venda no payload" }, { status: 400 });
  }
  const today = new Date().toISOString().slice(0, 10);
  const sale = createSale({
    clientId,
    source,
    kind,
    periodStart: today,
    periodEnd: today,
    revenue,
    units,
    currency,
    note: "via webhook",
  });
  return NextResponse.json({ ok: true, saleId: sale.id, revenue, units }, { status: 201 });
}
