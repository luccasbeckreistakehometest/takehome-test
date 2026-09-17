import { guardGeneration, isDenied } from "@/lib/guard";

type Context = { params: Promise<{ id: string }> };

// HTML gerado pela IA é conteúdo não confiável: servido com CSP `sandbox`
// (sem allow-same-origin), então scripts que o modelo emitir rodam numa
// origem opaca, sem acesso à sessão nem às APIs do Marqa.
const SANDBOX_CSP = "sandbox allow-forms allow-popups allow-popups-to-escape-sandbox allow-scripts; frame-ancestors 'self'";

export async function GET(request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guardGeneration(id, "view");
  if (isDenied(auth)) return auth;
  const generation = auth.generation;
  if (generation.type !== "landing_page") {
    return new Response("Landing page não encontrada", { status: 404 });
  }
  const headers: Record<string, string> = {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Security-Policy": SANDBOX_CSP,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-store",
    "X-Robots-Tag": "noindex, nofollow",
  };
  if (new URL(request.url).searchParams.get("download") === "1") {
    const slug = generation.title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    headers["Content-Disposition"] = `attachment; filename="${slug || "landing-page"}.html"`;
  }
  return new Response(generation.content, { headers });
}
