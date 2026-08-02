import { NextResponse } from "next/server";
import { listUsers } from "@/lib/auth";

// Lista de logins para a tela de login (app local — facilita o acesso;
// remove-se quando houver cadastro de senha individual)
export async function GET() {
  return NextResponse.json(listUsers());
}
