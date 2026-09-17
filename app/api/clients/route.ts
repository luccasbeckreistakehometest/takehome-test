import { NextResponse } from "next/server";
import { createClient, deleteClient, listClients } from "@/lib/db";
import { createUser, randomPassword } from "@/lib/auth";
import { startAccount } from "@/lib/billing-db";
import { clientSchema } from "@/lib/validation";
import { guard, isDenied } from "@/lib/guard";

// Carteira de clientes da agência. Só agência/admin.
export async function GET() {
  const auth = await guard(["agency", "admin"]);
  if (isDenied(auth)) return auth;
  return NextResponse.json(listClients());
}

// Cria o cliente e o login do portal com uma senha provisória aleatória,
// devolvida UMA vez (a agência repassa; no primeiro acesso a marca troca).
export async function POST(request: Request) {
  const auth = await guard(["agency", "admin"]);
  if (isDenied(auth)) return auth;
  const parsed = clientSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }
  const client = createClient(parsed.data);
  const password = randomPassword();
  try {
    const login = await createUser({
      password,
      role: "client",
      refId: client.id,
      name: client.name,
      mustChangePassword: true,
    });
    startAccount("client", client.id);
    return NextResponse.json(
      { ...client, login: { username: login.username, password, oneTime: true } },
      { status: 201 }
    );
  } catch (error) {
    deleteClient(client.id);
    throw error;
  }
}
