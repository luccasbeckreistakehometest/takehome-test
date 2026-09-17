import { recordEvent } from "@/lib/analytics-db";
import { MAX_BODY_BYTES, parseBeacon } from "@/lib/analytics-rules";
import { deviceOf, isBot } from "@/lib/links-rules";
import { visitorHash } from "@/lib/visitor";
import { checkLimits, clientIp } from "@/lib/rate-limit";

const empty = (status: number) => new Response(null, { status, headers: { "Cache-Control": "no-store" } });

// Coletor de eventos (sendBeacon, text/plain). Sem cookie, sem IP guardado:
// só um hash diário. Robôs são ignorados; corpo grande = 413; evento ou
// página fora da lista = 400.
export async function POST(request: Request) {
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > MAX_BODY_BYTES) return empty(413);
  if (!checkLimits([["analyticsPerIp", clientIp(request)]]).ok) return empty(429);
  const raw = await request.text();
  const parsed = parseBeacon(raw);
  if (!parsed.ok) return empty(parsed.status);
  const ua = request.headers.get("user-agent");
  if (isBot(ua, { testMode: process.env.TRACKING_TEST_MODE === "1" })) return empty(204);
  const input = parsed.value;
  try {
    recordEvent({
      name: input.name,
      path: input.path,
      audience: input.audience,
      utm: input.utm,
      referrerHost: input.referrerHost,
      lang: input.lang,
      device: deviceOf(ua),
      visitorHash: visitorHash(clientIp(request), ua ?? ""),
      meta: input.meta,
    });
  } catch (error) {
    console.error("[analytics] beacon:", error);
  }
  return empty(204);
}
