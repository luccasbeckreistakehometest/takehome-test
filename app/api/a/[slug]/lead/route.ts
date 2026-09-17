import { NextResponse } from "next/server";
import { createLeadFromPage, getAgencyPage } from "@/lib/agency-page-db";
import { createRateLimiter, isPageLive, leadRateLimitPerHour, validateLead } from "@/lib/agency-page-rules";

type Context = { params: Promise<{ slug: string }> };

// Limite por IP e por hora, em memória (sobrevive ao HMR no globalThis).
// LEAD_RATE_LIMIT_PER_HOUR (default 5) — ver .env.example.
const g = globalThis as unknown as { __agencyhubLeadLimiter?: ReturnType<typeof createRateLimiter> };
const limiter =
  g.__agencyhubLeadLimiter ??
  createRateLimiter({ limit: leadRateLimitPerHour(process.env.LEAD_RATE_LIMIT_PER_HOUR), windowMs: 60 * 60 * 1000 });
g.__agencyhubLeadLimiter = limiter;

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip")?.trim() || "local";
}

// Formulário público da página da agência: vira prospect + contato e avisa a
// agência. Honeypot preenchido = finge sucesso e não grava nada.
export async function POST(request: Request, { params }: Context) {
  const { slug } = await params;
  const config = getAgencyPage();
  if (!isPageLive(config, slug)) return NextResponse.json({ error: "Página não encontrada" }, { status: 404 });
  const ip = clientIp(request);
  const verdict = limiter.check(ip);
  if (!verdict.ok) {
    return NextResponse.json(
      { error: "Muitos envios em pouco tempo. Tente de novo mais tarde." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(verdict.retryAfterMs / 1000)) } }
    );
  }
  const check = validateLead(await request.json().catch(() => null));
  if (!check.ok) {
    if (check.reason === "honeypot") return NextResponse.json({ ok: true }, { status: 200 });
    const messages: Record<string, string> = {
      name: "Diga como podemos te chamar.",
      whatsapp: "Informe um WhatsApp válido (DDD + número).",
      need: "Conte em uma frase o que você precisa.",
      budget: "Escolha uma faixa de verba.",
    };
    return NextResponse.json({ error: messages[check.reason] ?? "Dados inválidos", field: check.reason }, { status: 400 });
  }
  createLeadFromPage({ slug: config.slug, lead: check.lead, ip });
  return NextResponse.json({ ok: true }, { status: 201 });
}
