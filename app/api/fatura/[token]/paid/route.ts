import { NextResponse } from "next/server";
import { claimInvoicePaid } from "@/lib/invoices-db";
import { checkLimits, clientIp, retryAfterHeader } from "@/lib/rate-limit";

type Context = { params: Promise<{ token: string }> };

// "Já paguei" (sem login): avisa a agência, que confere no banco e confirma.
export async function POST(request: Request, { params }: Context) {
  const verdict = checkLimits([["publicDecisionPerIp", clientIp(request)]]);
  if (!verdict.ok) return NextResponse.json({ error: "Muitas tentativas." }, { status: 429, headers: retryAfterHeader(verdict) });
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{32}$/.test(token)) return NextResponse.json({ error: "Fatura não encontrada" }, { status: 404 });
  const result = claimInvoicePaid(token);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ status: result.status }, { headers: { "X-Robots-Tag": "noindex, nofollow" } });
}
