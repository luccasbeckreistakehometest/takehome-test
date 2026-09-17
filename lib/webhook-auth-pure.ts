import { createHmac, timingSafeEqual } from "crypto";

// Verificações puras dos webhooks (sem banco).

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

// ---------- Meta (WhatsApp Cloud / Instagram) ----------
// A Meta assina o corpo cru com o App Secret: X-Hub-Signature-256: sha256=<hex>.
// Sem META_APP_SECRET, nenhum POST é aceito (não há como provar a origem).
export function verifyMetaSignature(rawBody: string, header: string | null, secret = process.env.META_APP_SECRET ?? ""): boolean {
  if (!secret || !header || !header.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  return safeEqual(header.slice("sha256=".length).toLowerCase(), expected);
}

// Token do handshake. O valor público antigo ("agencyhub-verify") nunca vale.
const PUBLIC_DEFAULT_VERIFY_TOKEN = "agencyhub-verify";
export function metaVerifyToken(): string | null {
  const token = (process.env.META_VERIFY_TOKEN ?? "").trim();
  if (token.length < 16 || token === PUBLIC_DEFAULT_VERIFY_TOKEN) return null;
  return token;
}

