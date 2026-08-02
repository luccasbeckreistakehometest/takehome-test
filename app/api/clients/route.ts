import { NextResponse } from "next/server";
import { createClient, listClients } from "@/lib/db";
import { createUser } from "@/lib/auth";
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
  const client = createClient(parsed.data);
  const login = createUser({
    password: "luccas123",
    role: "client",
    refId: client.id,
    name: client.name,
  });
  return NextResponse.json(
    { ...client, login: { username: login.username, password: "luccas123" } },
    { status: 201 }
  );
}
