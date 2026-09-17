import { NextResponse } from "next/server";
import { processApiOutbox } from "@/lib/messaging/send";
import { agencyOnly, isDenied } from "@/lib/guard";

export const maxDuration = 300;

// Dispara o processamento da fila em modo API. Mensagens em modo "sessão"
// (Playwright) ficam para o worker local; retornamos quantas foram puladas.
export async function POST() {
  const auth = await agencyOnly();
  if (isDenied(auth)) return auth;
  const result = await processApiOutbox();
  return NextResponse.json(result);
}
