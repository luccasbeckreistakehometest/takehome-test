import { NextResponse } from "next/server";
import { z } from "zod";
import { decideViaLink, linkPageData } from "@/lib/approval-links-db";
import { isApprovalToken, validateDecision } from "@/lib/approval-link-rules";
import { checkLimits, clientIp, retryAfterHeader } from "@/lib/rate-limit";

type Context = { params: Promise<{ token: string }> };
const NOINDEX = { "X-Robots-Tag": "noindex, nofollow", "Cache-Control": "no-store" };

// Página pública de aprovação: estado atual dos itens (sem login).
export async function GET(request: Request, { params }: Context) {
  const { token } = await params;
  const verdict = checkLimits([["publicReadPerIp", clientIp(request)]]);
  if (!verdict.ok) return NextResponse.json({ error: "Muitas tentativas." }, { status: 429, headers: retryAfterHeader(verdict) });
  const data = isApprovalToken(token) ? linkPageData(token) : null;
  if (!data) return NextResponse.json({ error: "Link não encontrado." }, { status: 404, headers: NOINDEX });
  return NextResponse.json({ state: data.state, items: data.items }, { headers: NOINDEX });
}

const schema = z.object({
  kind: z.enum(["post", "deliverable"]),
  id: z.string().min(1).max(100),
  decision: z.string(),
  note: z.string().max(5000).optional(),
  approver: z.string().max(500).optional(),
});

// Decisão de um item (aprovar / pedir ajuste). O token é a credencial; o
// item precisa estar no link.
export async function POST(request: Request, { params }: Context) {
  const { token } = await params;
  const verdict = checkLimits([["publicDecisionPerIp", clientIp(request)]]);
  if (!verdict.ok) {
    return NextResponse.json({ error: "Muitas respostas em pouco tempo. Espere alguns minutos." }, { status: 429, headers: retryAfterHeader(verdict) });
  }
  if (!isApprovalToken(token)) return NextResponse.json({ error: "Link não encontrado." }, { status: 404, headers: NOINDEX });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos." }, { status: 400, headers: NOINDEX });
  const decision = validateDecision(parsed.data);
  if (!decision.ok) return NextResponse.json({ error: decision.error }, { status: 400, headers: NOINDEX });
  const outcome = decideViaLink(token, { kind: parsed.data.kind, id: parsed.data.id }, decision.value);
  if (!outcome.ok) return NextResponse.json({ error: outcome.error }, { status: outcome.status, headers: NOINDEX });
  return NextResponse.json({ item: outcome.item, alreadyDecided: outcome.alreadyDecided }, { headers: NOINDEX });
}
