// Assinatura de sessão compartilhada entre o middleware (edge) e o servidor.
// Usa Web Crypto (disponível nos dois runtimes). Segredo local — em produção
// vira variável de ambiente.
export const AUTH_SECRET = "agencyhub-local-secret-v1";
export const SESSION_COOKIE = "agencyhub_session";

export type SessionPayload = {
  userId: string;
  role: "agency" | "client" | "professional";
  refId: string | null; // clientId ou professionalId
  name: string;
};

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function hmac(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(AUTH_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload)
  );
  return toBase64Url(new Uint8Array(signature));
}

export async function signSession(payload: SessionPayload): Promise<string> {
  const body = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  return `${body}.${await hmac(body)}`;
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  if ((await hmac(body)) !== signature) return null;
  try {
    return JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as SessionPayload;
  } catch {
    return null;
  }
}
