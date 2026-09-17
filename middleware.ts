import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth-shared";

// Páginas públicas (sem login).
const PUBLIC_PAGES = [
  "/login",
  "/_next",
  "/favicon",
  "/cadastro",
  "/criar-conta",
  "/convite",
  "/print",
  "/para-", // landings de funil públicas (/para-agencias, /para-marcas, ...)
];

// Rotas de API públicas (chamadas antes do login ou por sistemas externos).
// Tudo o que NÃO estiver aqui exige sessão válida.
function isPublicApi(pathname: string, method: string): boolean {
  // Webhooks externos (Meta, vendas) — chamados por terceiros, sem sessão.
  if (pathname.startsWith("/api/webhooks/")) return true;
  // Login / cadastro / logout / checagem de sessão.
  if (pathname === "/api/auth/login" && method === "POST") return true;
  if (pathname === "/api/auth/register" && method === "POST") return true;
  if (pathname === "/api/auth/logout" && method === "POST") return true;
  if (pathname === "/api/auth/me" && method === "GET") return true;
  // Logo whitelabel exibido em telas públicas (só leitura).
  if (pathname === "/api/settings/logo" && method === "GET") return true;
  // Lista de contas do login = conveniência só de desenvolvimento (em produção
  // fica protegida para não expor usernames).
  if (
    pathname === "/api/auth/users" &&
    method === "GET" &&
    process.env.NODE_ENV !== "production"
  )
    return true;
  // Consulta pública de um convite pelo token (página /convite). O caminho tem
  // um segmento de token depois de /api/invites/ ; criar/listar/revogar (sem
  // token, em /api/invites) continua protegido.
  if (method === "GET" && /^\/api\/invites\/[^/]+$/.test(pathname)) return true;
  // Relatório mensal por token (link imprimível/compartilhável) — só leitura.
  if (method === "GET" && /^\/api\/reports\/[^/]+$/.test(pathname)) return true;
  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // ---------- Rotas de API ----------
  if (pathname.startsWith("/api")) {
    if (isPublicApi(pathname, method)) return NextResponse.next();
    const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
    if (!session) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    // Isolamento básico: uma marca só acessa a API do próprio cliente. Bloqueia
    // /api/clients/<outroId>...; a rota do seu próprio id continua liberada.
    if (session.role === "client") {
      const m = pathname.match(/^\/api\/clients\/([^/]+)/);
      if (m && m[1] !== session.refId) {
        return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
      }
    }
    return NextResponse.next();
  }

  // Landing pública na raiz (a própria página decide: landing p/ anônimo,
  // painel p/ logado). Match exato — não usar startsWith com "/".
  if (pathname === "/") {
    return NextResponse.next();
  }

  // ---------- Páginas públicas ----------
  if (PUBLIC_PAGES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  // ---------- Páginas protegidas ----------
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
    // A marca circula no próprio portal e — se autônoma — no próprio workspace
    // (/clients/<seuId>). Qualquer outra rota volta pra home dela.
    const portal = `/portal/client/${session.refId}`;
    const workspace = `/clients/${session.refId}`;
    const canWorkspace =
      pathname === workspace || pathname.startsWith(`${workspace}/`);
    if (!pathname.startsWith(portal) && !canWorkspace) {
      const url = request.nextUrl.clone();
      url.pathname = session.selfServe ? workspace : portal;
      url.search = "";
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
