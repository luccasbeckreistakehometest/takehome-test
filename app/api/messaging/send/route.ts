import { NextResponse } from "next/server";
import { processApiOutbox } from "@/lib/messaging/send";

export const maxDuration = 300;

// Dispara o processamento da fila em modo API. Mensagens em modo "sessão"
// (Playwright) ficam para o worker local; retornamos quantas foram puladas.
export async function POST() {
  const result = await processApiOutbox();
  return NextResponse.json(result);
}
