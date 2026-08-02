import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession, billingAccount } from "@/lib/session";
import { addCoins } from "@/lib/billing-db";
import { getCoinPack } from "@/lib/plans";

const schema = z.object({ packId: z.string() });

// Compra um pacote de coins on-demand (pagamento simulado).
export async function POST(request: Request) {
  const session = await getSession();
  const account = session ? billingAccount(session) : null;
  if (!account) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  const pack = getCoinPack(parsed.data.packId);
  if (!pack) return NextResponse.json({ error: "Pacote inválido" }, { status: 400 });
  const total = pack.coins + pack.bonus;
  const wallet = addCoins(
    account.accountType,
    account.accountId,
    total,
    `Compra de ${pack.coins}${pack.bonus ? ` +${pack.bonus} bônus` : ""} coins`,
    "coin_purchase",
    pack.price
  );
  return NextResponse.json({ wallet, added: total }, { status: 201 });
}
