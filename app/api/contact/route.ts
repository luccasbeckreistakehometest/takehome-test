import { NextResponse } from "next/server";
import { z } from "zod";
import { createInboxMessage } from "@/lib/contact-db";
import { isValidEmail, normalizeEmail } from "@/lib/auth";
import { getSession } from "@/lib/session";
import { checkLimits, clientIp, retryAfterHeader } from "@/lib/rate-limit";

const schema = z.object({
  kind: z.enum(["contact", "access_request"]).default("contact"),
  name: z.string().trim().min(2, "Informe seu nome").max(120),
  email: z.string().trim().max(200),
  topic: z.enum(["duvida", "pagamento", "acesso", "privacidade", "parceria", "outro"]).default("duvida"),
  message: z.string().trim().min(10, "Conte um pouco mais (mínimo 10 caracteres)").max(5000),
  // pedido de acesso de agência
  company: z.string().trim().max(120).default(""),
  website: z.string().trim().max(200).default(""),
  // honeypot: humanos não preenchem
  fax: z.string().max(200).optional(),
});

// Formulário de contato e pedido de acesso (agência). Guarda no SQLite para
// o admin responder; limitado por IP e por conta.
export async function POST(request: Request) {
  const ip = clientIp(request);
  const session = await getSession();
  const verdict = checkLimits([
    ["contactPerIp", ip],
    ...(session ? ([["contactPerIp", `user:${session.userId}`]] as ["contactPerIp", string][]) : []),
  ]);
  if (!verdict.ok) {
    return NextResponse.json(
      { error: "Recebemos várias mensagens daqui. Tente de novo mais tarde." },
      { status: 429, headers: retryAfterHeader(verdict) }
    );
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }
  const data = parsed.data;
  // Robô preencheu o campo invisível: finge sucesso e não grava.
  if (data.fax) return NextResponse.json({ ok: true }, { status: 201 });
  const email = normalizeEmail(data.email);
  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: "Informe um e-mail válido para a resposta." }, { status: 400 });
  }
  const meta: Record<string, string> = {};
  if (data.company) meta.company = data.company;
  if (data.website) meta.website = data.website;
  createInboxMessage({
    kind: data.kind,
    name: data.name,
    email,
    topic: data.kind === "access_request" ? "acesso" : data.topic,
    message: data.message,
    meta,
    userId: session?.userId ?? null,
    ip,
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}
