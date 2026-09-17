import { NextResponse } from "next/server";
import type { SessionPayload } from "./auth-shared";
import { chargeUsage, getSubscription, refundUsage } from "./billing-db";
import { AI_UNAVAILABLE, assertAiAvailable, GenerationError } from "./claude";
import { recordAiError, runWithAiContext, type AiContext } from "./ai-spend";
import { getPlan, type AccountType } from "./plans";
import { checkLimits, clientIp, retryAfterHeader, type LimitName } from "./rate-limit";
import { billingAccount } from "./session";

// Porteiro único das rotas de IA:
//  1. limite de taxa por conta e por IP;
//  2. disjuntor global de gasto diário;
//  3. cobrança (reserva) de coins de quem paga — a agência paga pelos
//     clientes que atende; marca e profissional pagam por si; admin não paga;
//  4. executa a geração no contexto (atribuição de gasto + teto de qualidade);
//  5. falhou → estorna e devolve um erro neutro (detalhe só no log/admin).
//
// Uso:
//   const result = await meterAi(request, session, "ideas", () => gerar());
//   if (result instanceof NextResponse) return result;

export type Payer = { accountType: AccountType; accountId: string } | null;

export function payerFor(session: Pick<SessionPayload, "role" | "refId" | "agencyId">): Payer {
  if (session.role === "admin") return null;
  return billingAccount(session);
}

export function aiErrorResponse(error: unknown): NextResponse {
  if (error instanceof GenerationError) {
    const status = error.status >= 400 && error.status < 600 ? error.status : 502;
    return NextResponse.json({ error: error.message }, { status });
  }
  recordAiError("unexpected", error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : String(error));
  return NextResponse.json({ error: AI_UNAVAILABLE }, { status: 502 });
}

const NO_COINS = "Seus coins acabaram. Veja os planos ou compre um pacote de coins para continuar.";

export type AiTicket = {
  // executa a geração com atribuição de gasto e teto de qualidade do plano
  run: <T>(fn: () => Promise<T>) => Promise<T>;
  // devolve os coins reservados (idempotente)
  refund: () => void;
};

export type AiGate =
  | { ok: true; refund: () => void }
  | { ok: false; status: number; reason: string; headers?: Record<string, string> };

// Contexto de atribuição (quem paga, teto de qualidade do plano).
export function aiContextFor(session: SessionPayload, action: string, agencyId?: string | null): AiContext {
  const payer = payerFor(session);
  const quality = payer ? (getPlan(getSubscription(payer.accountType, payer.accountId).planId)?.quality ?? null) : null;
  return {
    action,
    // admin agindo num recurso de outra agência pode informar a agência dele
    agencyId: session.role === "admin" ? (agencyId ?? null) : (session.agencyId ?? null),
    accountType: payer?.accountType ?? null,
    accountId: payer?.accountId ?? null,
    userId: session.userId,
    quality,
  };
}

// Limites + disjuntor + reserva de coins, sem executar nada. Para libs que só
// cobram quando a IA roda de verdade (cache antes).
export function gateAi(
  request: Request,
  session: SessionPayload,
  action: string,
  opts: { units?: number; limits?: [LimitName, LimitName] } = {}
): AiGate {
  const [perAccount, perIp] = opts.limits ?? ["aiPerAccount", "aiPerIp"];
  if (session.role !== "admin") {
    const verdict = checkLimits([
      [perAccount, session.userId],
      [perIp, clientIp(request)],
    ]);
    if (!verdict.ok) {
      return {
        ok: false,
        status: 429,
        reason: "Muitos pedidos de IA em pouco tempo. Espere alguns minutos e tente de novo.",
        headers: retryAfterHeader(verdict),
      };
    }
  }
  try {
    assertAiAvailable();
  } catch (error) {
    const status = error instanceof GenerationError ? error.status : 503;
    return { ok: false, status, reason: error instanceof Error ? error.message : AI_UNAVAILABLE };
  }
  const payer = payerFor(session);
  const charge = payer ? chargeUsage({ ...payer, action, units: opts.units }) : null;
  if (charge && !charge.ok) return { ok: false, status: 402, reason: charge.reason ?? NO_COINS };
  let refunded = false;
  return {
    ok: true,
    refund: () => {
      if (refunded || !payer || !charge) return;
      refunded = true;
      refundUsage(payer, action, charge);
    },
  };
}

// Checa limites, disjuntor e saldo; reserva os coins. Quem chama executa com
// ticket.run(...) e chama ticket.refund() se a geração falhar.
export async function beginAi(
  request: Request,
  session: SessionPayload,
  action: string,
  opts: { units?: number; limits?: [LimitName, LimitName]; agencyId?: string | null } = {}
): Promise<NextResponse | AiTicket> {
  const gate = gateAi(request, session, action, opts);
  if (!gate.ok) {
    return NextResponse.json(
      { error: gate.reason, ...(gate.status === 402 ? { code: "no_coins" } : {}) },
      { status: gate.status, headers: gate.headers }
    );
  }
  const ctx = aiContextFor(session, action, opts.agencyId);
  return {
    run: (fn) => runWithAiContext(ctx, fn),
    refund: gate.refund,
  };
}

export async function meterAi<T>(
  request: Request,
  session: SessionPayload,
  action: string,
  fn: () => Promise<T>,
  opts: { units?: number; limits?: [LimitName, LimitName]; agencyId?: string | null } = {}
): Promise<T | NextResponse> {
  const ticket = await beginAi(request, session, action, opts);
  if (ticket instanceof NextResponse) return ticket;
  try {
    return await ticket.run(fn);
  } catch (error) {
    ticket.refund();
    return aiErrorResponse(error);
  }
}
