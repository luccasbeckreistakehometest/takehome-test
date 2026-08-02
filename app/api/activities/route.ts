import { NextResponse } from "next/server";
import { z } from "zod";
import { listActivities, markActivitiesRead } from "@/lib/marketplace-db";

// Central de atividade: feed por papel (agência, cliente, profissional)
export async function GET(request: Request) {
  const url = new URL(request.url);
  const audience = (url.searchParams.get("audience") ?? "agency") as
    | "agency"
    | "client"
    | "professional";
  return NextResponse.json(
    listActivities({
      audience,
      clientId: url.searchParams.get("clientId") ?? undefined,
      professionalId: url.searchParams.get("professionalId") ?? undefined,
    })
  );
}

export async function PATCH(request: Request) {
  const parsed = z
    .object({ audience: z.enum(["agency", "client", "professional"]) })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }
  markActivitiesRead(parsed.data.audience);
  return NextResponse.json({ ok: true });
}
