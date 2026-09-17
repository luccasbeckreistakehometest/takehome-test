import { NextResponse } from "next/server";
import type { SessionPayload } from "./auth-shared";
import { chargeUsage, getSubscription, refundUsage } from "./billing-db";
import { AI_UNAVAILABLE, assertAiAvailable, GenerationError } from "./claude";
import { recordAiError, runWithAiContext } from "./ai-spend";
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

export function payerFor(session: Pick<SessionPayload, "role" | "refId">): Payer {
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

// Checa limites, disjuntor e saldo; reserva os coins. Quem chama executa com
// ticket.run(...) e chama ticket.refund() se a geração falhar.
export async function beginAi(
  request: Request,
  session: SessionPayload,
  action: string,
  opts: { units?: number; limits?: [LimitName, LimitName] } = {}
): Promise<NextResponse | AiTicket> {
  const [perAccount, perIp] = opts.limits ?? ["aiPerAccount", "aiPerIp"];
  if (session.role !== "admin") {
    const verdict = checkLimits([
      [perAccount, session.userId],
      [perIp, clientIp(request)],
    ]);
    if (!verdict.ok) {
      return NextResponse.json(
        { error: "Muitos pedidos de IA em pouco tempo. Espere alguns minutos e tente de novo." },
        { status: 429, headers: retryAfterHeader(verdict) }
      );
    }
  }
  try {
    assertAiAvailable();
  } catch (error) {
    return aiErrorResponse(error);
  }
  const payer = payerFor(session);
  const charge = payer ? chargeUsage({ ...payer, action, units: opts.units }) : null;
  if (charge && !charge.ok) {
    return NextResponse.json({ error: charge.reason ?? NO_COINS, code: "no_coins" }, { status: 402 });
  }
  const quality = payer ? (getPlan(getSubscription(payer.accountType, payer.accountId).planId)?.quality ?? null) : null;
  const ctx = {
    action,
    accountType: payer?.accountType ?? null,
    accountId: payer?.accountId ?? null,
    userId: session.userId,
    quality,
  };
  let refunded = false;
  return {
    run: (fn) => runWithAiContext(ctx, fn),
    refund: () => {
      if (refunded || !payer || !charge) return;
      refunded = true;
      refundUsage(payer, action, charge);
    },
  };
}

export async function meterAi<T>(
  request: Request,
  session: SessionPayload,
  action: string,
  fn: () => Promise<T>,
  opts: { units?: number; limits?: [LimitName, LimitName] } = {}
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
