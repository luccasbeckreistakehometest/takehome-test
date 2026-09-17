// Assinatura de sessão compartilhada entre o middleware (edge) e o servidor.
// Usa Web Crypto (disponível nos dois runtimes). Nada aqui toca o banco: a
// checagem de revogação (versão da sessão, conta desativada) fica em
// lib/session.ts, que roda só no Node.
//
// AUTH_SECRET é obrigatório em produção. O middleware é compilado com o valor
// inlinado no build (build arg AUTH_SECRET no Dockerfile/compose), então build
// e runtime precisam do MESMO valor. Sem ele, em produção, nenhuma sessão é
// aceita nem emitida (falha fechada) — ver também next.config.ts, que recusa o
// build de produção sem o segredo.

export const SESSION_COOKIE = "agencyhub_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 dias
export const MIN_SECRET_LENGTH = 32;

export type SessionPayload = {
  userId: string;
  role: "admin" | "agency" | "client" | "professional";
  refId: string | null; // clientId ou professionalId
  name: string;
  // Whitelabel: "agency" = vê a marca da agência que o convidou; "platform" =
  // auto-cadastrado, vê a marca da plataforma. Ausente = agência (legado).
  brandSource?: "agency" | "platform";
  // Só para marca (role client): true = modo autônomo (workspace próprio);
  // false = gerenciada por uma agência (portal read-only). Fica na sessão para
  // o middleware (edge, sem banco) rotear sem consultar o SQLite.
  selfServe?: boolean;
  // Versão da sessão do usuário no momento da emissão. Trocar a senha,
  // desativar a conta ou "sair de todos os dispositivos" incrementa a versão
  // no banco e derruba todos os cookies antigos.
  sv?: number;
  iat?: number; // emitido em (segundos)
  exp?: number; // expira em (segundos)
};

export type SessionInput = Omit<SessionPayload, "iat" | "exp">;

// Só para desenvolvimento/testes locais. Nunca aceito em produção.
const DEV_ONLY_SECRET = "insecure-dev-only-secret-do-not-use-in-production";

export function authSecret(): string {
  const secret = process.env.AUTH_SECRET ?? "";
  if (secret.length >= MIN_SECRET_LENGTH) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      `AUTH_SECRET ausente ou curto (mínimo ${MIN_SECRET_LENGTH} caracteres) — obrigatório em produção.`
    );
  }
  return secret || DEV_ONLY_SECRET;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const out = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(authSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function signSession(
  payload: SessionInput,
  now: number = Date.now()
): Promise<string> {
  const iat = Math.floor(now / 1000);
  const full: SessionPayload = { ...payload, iat, exp: iat + SESSION_MAX_AGE_SECONDS };
  const body = toBase64Url(new TextEncoder().encode(JSON.stringify(full)));
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(), new TextEncoder().encode(body));
  return `${body}.${toBase64Url(new Uint8Array(signature))}`;
}

// Verifica assinatura (comparação em tempo constante via crypto.subtle.verify)
// e expiração. Tokens antigos sem `exp` (emitidos antes desta versão) são
// recusados: a pessoa só precisa entrar de novo.
export async function verifySession(
  token: string | undefined,
  now: number = Date.now()
): Promise<SessionPayload | null> {
  if (!token || token.length > 4096) return null;
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra !== undefined) return null;
  try {
    const valid = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(),
      fromBase64Url(signature),
      new TextEncoder().encode(body)
    );
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp * 1000 <= now) return null;
    if (!payload.userId || !payload.role) return null;
    return payload;
  } catch (error) {
    // Segredo ausente em produção: falha fechada, mas deixa rastro no log.
    if (error instanceof Error && error.message.startsWith("AUTH_SECRET")) console.error(error.message);
    return null;
  }
}

// Opções do cookie de sessão. Secure em produção (o Caddy serve só HTTPS).
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}
