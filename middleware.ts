import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth-shared";

// Painéis separados por login: agência vê tudo; cliente só o próprio portal;
// profissional só o próprio perfil. APIs ficam abertas localmente (a proteção
// fina por rota entra com o deploy).
const PUBLIC_PREFIXES = [
  "/login",
  "/api",
  "/_next",
  "/favicon",
  "/cadastro",
  "/criar-conta",
  "/convite",
  "/print",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  // /admin é exclusivo do admin da plataforma
  if (pathname.startsWith("/admin") && session.role !== "admin") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }
  // Admin e agência circulam livremente (admin vê tudo)
  if (session.role === "admin") {
    return NextResponse.next();
  }
  // Páginas de billing são acessíveis a qualquer conta logada
  if (pathname.startsWith("/plans")) {
    return NextResponse.next();
  }
  if (session.role === "client") {
    const allowed = `/portal/client/${session.refId}`;
    if (!pathname.startsWith(allowed)) {
      const url = request.nextUrl.clone();
      url.pathname = allowed;
      return NextResponse.redirect(url);
    }
  }
  if (session.role === "professional") {
    const allowed = `/professionals/${session.refId}`;
    if (!pathname.startsWith(allowed)) {
      const url = request.nextUrl.clone();
      url.pathname = allowed;
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
