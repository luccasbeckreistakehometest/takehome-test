import { NextResponse } from "next/server";
import { processApiOutbox } from "@/lib/messaging/send";
import { agencyOnly, isDenied } from "@/lib/guard";
import { HOUSE_AGENCY_ID } from "@/lib/tenancy-rules";

export const maxDuration = 300;

// Dispara o processamento da fila em modo API. Mensagens em modo "sessão"
// (Playwright) ficam para o worker local; retornamos quantas foram puladas.
export async function POST() {
  const auth = await agencyOnly();
  if (isDenied(auth)) return auth;
  // Agência processa só a fila dela; admin, todas.
  const result = await processApiOutbox(undefined, auth.role === "admin" ? undefined : (auth.agencyId ?? HOUSE_AGENCY_ID));
  return NextResponse.json(result);
}
