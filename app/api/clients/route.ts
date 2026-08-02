import { NextResponse } from "next/server";
import { createClient, listClients } from "@/lib/db";
import { clientSchema } from "@/lib/validation";

export async function GET() {
  return NextResponse.json(listClients());
}

export async function POST(request: Request) {
  const parsed = clientSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
      { status: 400 }
    );
  }
  return NextResponse.json(createClient(parsed.data), { status: 201 });
}
