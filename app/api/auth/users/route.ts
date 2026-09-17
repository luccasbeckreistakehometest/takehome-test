import { NextResponse } from "next/server";
import { listLoginHints } from "@/lib/auth";

// Lista de logins para a tela de login — só em desenvolvimento local. Em
// produção não expõe usernames (o middleware também não libera a rota).
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json([], { status: 404 });
  }
  return NextResponse.json(listLoginHints());
}
