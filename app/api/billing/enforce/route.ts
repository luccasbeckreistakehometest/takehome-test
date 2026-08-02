import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { isEnforced, setEnforced } from "@/lib/billing-db";

// Liga/desliga o bloqueio de IA por saldo (só admin). Default OFF para não
// travar a operação em teste; liga-se quando for cobrar de verdade.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "apenas admin" }, { status: 403 });
  }
  const parsed = z.object({ on: z.boolean() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  setEnforced(parsed.data.on);
  return NextResponse.json({ enforced: isEnforced() });
}
