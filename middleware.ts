import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession, type SessionPayload } from "@/lib/auth-shared";

// Porteiro de borda (edge, sem banco): assinatura + validade da sessão e
// roteamento por papel. A revogação (versão da sessão, conta desativada) e a
// posse de cada recurso são checadas nas rotas (lib/session.ts, lib/guard.ts).

// Páginas públicas (sem login). Tudo o que não for público nem privado
// conhecido segue adiante e, se não existir, vira 404 (não redireciona).
const PUBLIC_EXACT = new Set([
  "/",
  "/login",
  "/cadastro",
  "/criar-conta",
  "/pedir-acesso",
  "/contato",
  "/contact",
  "/termos",
  "/terms",
  "/privacidade",
  "/privacy",
  "/reembolso",
  "/refunds",
  "/cookies",
  "/cookie-policy",
  "/robots.txt",
  "/sitemap.xml",
  "/favicon.ico",
  "/icon.svg",
  "/apple-icon.png",
  "/opengraph-image",
  "/manifest.webmanifest",
]);
const PUBLIC_PREFIXES = [
  "/_next",
  "/convite/",
  "/proposta/",
  "/print/report/",
  "/para-", // landings de funil (/para-agencias, /para-marcas, ...)
  "/a/", // página pública da agência (/a/[slug])
  "/aprovar/", // aprovação por link, sem login
  "/fatura/", // fatura Pix do cliente, sem login
  "/opengraph-image",
  "/legal/",
];

// Áreas logadas: sem sessão → /login.
const PRIVATE_PREFIXES = [
  "/admin",
  "/agenda",
  "/assistant",
  "/calendar",
  "/clients",
  "/conta",
  "/finance",
  "/growth",
  "/ideas",
  "/insights",
  "/invoices",
  "/messages",
  "/plans",
  "/portal",
  "/print",
  "/production",
  "/professionals",
  "/prospecting",
  "/settings",
  "/treinamento",
];

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix.endsWith("/") || prefix.endsWith("-") ? prefix : `${prefix}/`);
}

function isPublicPage(pathname: string): boolean {
  return PUBLIC_EXACT.has(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

// Rotas de API públicas (chamadas antes do login ou por sistemas externos).
export function isPublicApi(pathname: string, method: string): boolean {
  if (pathname.startsWith("/api/webhooks/")) return true; // cada webhook se autentica
  if (pathname === "/api/health" && method === "GET") return true;
  if (pathname === "/api/contact" && method === "POST") return true; // limite + honeypot na rota
  if (pathname === "/api/auth/login" && method === "POST") return true;
  if (pathname === "/api/auth/register" && method === "POST") return true;
  if (pathname === "/api/auth/logout" && method === "POST") return true;
  if (pathname === "/api/auth/me" && method === "GET") return true;
  if (pathname === "/api/settings/logo" && method === "GET") return true;
  // Lista de contas do login: só em desenvolvimento.
  if (pathname === "/api/auth/users" && method === "GET" && process.env.NODE_ENV !== "production") return true;
  if (method === "GET" && /^\/api\/invites\/[^/]+$/.test(pathname)) return true;
  if (method === "GET" && /^\/api\/reports\/[^/]+$/.test(pathname)) return true;
  if ((method === "GET" || method === "POST") && /^\/api\/proposals\/[^/]+$/.test(pathname)) return true;
  if (method === "POST" && /^\/api\/proposals\/[^/]+\/accept$/.test(pathname)) return true;
  if (method === "GET" && /^\/api\/a\/[^/]+\/(work|logo)\/[^/]+$/.test(pathname)) return true;
  if (method === "POST" && /^\/api\/a\/[^/]+\/lead$/.test(pathname)) return true;
  // aprovação por link: o token é a credencial (cada rota confere o item)
  if ((method === "GET" || method === "POST") && /^\/api\/approve\/[^/]+$/.test(pathname)) return true;
  if (method === "GET" && /^\/api\/approve\/[^/]+\/file\/[^/]+$/.test(pathname)) return true;
  if (method === "POST" && /^\/api\/fatura\/[^/]+\/paid$/.test(pathname)) return true;
  // slide de carrossel com assinatura (o Instagram baixa por URL)
  if (method === "GET" && /^\/api\/c\/[^/]+\/[^/]+$/.test(pathname)) return true;
  return false;
}

// Negação por padrão para marca e profissional: só as rotas que os portais
// usam. Cada rota ainda checa posse (a marca só enxerga o que é dela).
const SHARED_PORTAL_API = [
  /^\/api\/auth\//,
  /^\/api\/account(\/.*)?$/,
  /^\/api\/activities$/,
  /^\/api\/onboarding$/,
  /^\/api\/jobs$/,
  /^\/api\/settings$/,
  /^\/api\/billing(\/(checkout|subscribe|subscription|subscription\/cancel))?$/,
  /^\/api\/contact$/,
];
const CLIENT_API = [
  /^\/api\/generate$/,
  /^\/api\/generations(\/[^/]+(\/html)?)?$/,
  /^\/api\/projects(\/.*)?$/,
  /^\/api\/deliverables\/[^/]+(\/(annotations|approval|comments|review))?$/,
  /^\/api\/annotations\/[^/]+$/,
  /^\/api\/applications\/[^/]+$/,
  /^\/api\/meetings\/[^/]+$/,
  /^\/api\/files\/[^/]+$/,
  /^\/api\/assets\/[^/]+$/,
  /^\/api\/scheduled-posts(\/[^/]+)?$/,
  /^\/api\/campaigns\/[^/]+$/,
  /^\/api\/voice\/(briefing|speak)$/,
  /^\/api\/scope-requests\/[^/]+$/,
  /^\/api\/carousels\/[^/]+(\/(slide\/[^/]+|zip|schedule))?$/,
];
const PROFESSIONAL_API = [/^\/api\/professional-assets\/[^/]+$/, /^\/api\/projects\/[^/]+\/applications$/];

export function portalApiAllowed(session: Pick<SessionPayload, "role" | "refId">, pathname: string): boolean {
  if (session.role === "admin" || session.role === "agency") return true;
  if (SHARED_PORTAL_API.some((re) => re.test(pathname))) return true;
  const own = session.refId ?? "";
  if (session.role === "client") {
    const m = pathname.match(/^\/api\/clients\/([^/]+)(\/.*)?$/);
    if (m) return m[1] === own;
    return CLIENT_API.some((re) => re.test(pathname));
  }
  if (session.role === "professional") {
    const m = pathname.match(/^\/api\/professionals\/([^/]+)(\/.*)?$/);
    if (m) return m[1] === own;
    return PROFESSIONAL_API.some((re) => re.test(pathname));
  }
  return false;
}

const deny = (status: 401 | 403) =>
  NextResponse.json({ error: status === 401 ? "Não autenticado" : "Acesso negado" }, { status });

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // ---------- Rotas de API ----------
  if (pathname.startsWith("/api")) {
    if (isPublicApi(pathname, method)) return NextResponse.next();
    const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
    if (!session) return deny(401);
    if (!portalApiAllowed(session, pathname)) return deny(403);
    return NextResponse.next();
  }

  if (isPublicPage(pathname)) {
    const response = NextResponse.next();
    // Páginas com token nunca vão para buscadores.
    if (/^\/(convite|proposta|print|aprovar|fatura)\//.test(pathname)) response.headers.set("X-Robots-Tag", "noindex, nofollow");
    return response;
  }

  const isPrivate = PRIVATE_PREFIXES.some((p) => matchesPrefix(pathname, p));
  if (!isPrivate) return NextResponse.next(); // página desconhecida → 404 do app

  // ---------- Páginas protegidas ----------
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  const response = NextResponse.next();
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  // /admin é exclusivo do admin da plataforma
  if (pathname.startsWith("/admin") && session.role !== "admin") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }
  if (session.role === "admin" || session.role === "agency") return response;
  // Planos e conta: qualquer papel logado.
  if (matchesPrefix(pathname, "/plans") || matchesPrefix(pathname, "/conta")) return response;
  if (session.role === "client") {
    // A marca circula no próprio portal, no próprio workspace (/clients/<seuId>;
    // as ações de lá exigem marca autônoma, checado nas rotas com o valor atual
    // do banco) e na impressão dos próprios entregáveis.
    const portal = `/portal/client/${session.refId}`;
    const workspace = `/clients/${session.refId}`;
    const allowed =
      matchesPrefix(pathname, portal) || matchesPrefix(pathname, workspace) || pathname.startsWith("/print/");
    if (!allowed) {
      const url = request.nextUrl.clone();
      url.pathname = session.selfServe ? workspace : portal;
      url.search = "";
      return NextResponse.redirect(url);
    }
    return response;
  }
  if (session.role === "professional") {
    const own = `/professionals/${session.refId}`;
    if (!matchesPrefix(pathname, own)) {
      const url = request.nextUrl.clone();
      url.pathname = own;
      url.search = "";
      return NextResponse.redirect(url);
    }
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
