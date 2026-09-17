import { getLink, recordClick } from "@/lib/links-db";
import { deviceOf, isBot, mergeUtm, referrerHost } from "@/lib/links-rules";
import { visitorHash } from "@/lib/visitor";
import { recordEvent } from "@/lib/analytics-db";
import { checkLimits, clientIp } from "@/lib/rate-limit";

type Context = { params: Promise<{ code: string }> };

// Link curto: redireciona (302) para o destino GUARDADO, com UTM. Parâmetros
// da URL do link são ignorados (sem redirecionamento aberto). Robôs seguem,
// mas não contam clique.
export async function GET(request: Request, { params }: Context) {
  const { code } = await params;
  const link = getLink(code);
  if (!link || link.archivedAt) {
    return new Response("Link não encontrado", { status: 404, headers: { "X-Robots-Tag": "noindex", "Content-Type": "text/plain; charset=utf-8" } });
  }
  const ua = request.headers.get("user-agent");
  const limited = !checkLimits([["publicReadPerIp", clientIp(request)]]).ok;
  if (!isBot(ua, { testMode: process.env.TRACKING_TEST_MODE === "1" }) && !limited) {
    try {
      recordClick(link, {
        visitorHash: visitorHash(clientIp(request), ua ?? ""),
        device: deviceOf(ua),
        referrerHost: referrerHost(request.headers.get("referer")),
      });
      if (/\/b\/[^/]+$/.test(request.headers.get("referer") ?? "")) {
        recordEvent({ name: "bio_click", path: "/b/:slug", audience: "geral", meta: { code: link.code } });
      }
    } catch (error) {
      console.error("[links] clique não registrado:", error);
    }
  }
  const target = mergeUtm(link.destUrl, link.utm);
  return new Response(null, {
    status: 302,
    headers: { Location: target, "Cache-Control": "no-store", "X-Robots-Tag": "noindex", "Referrer-Policy": "no-referrer-when-downgrade" },
  });
}
