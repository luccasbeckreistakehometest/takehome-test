import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { db } from "./db";

// Autenticação dos webhooks de entrada.

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

// ---------- Vendas (Shopify, Mercado Livre, loja própria) ----------
// Cada cliente tem o próprio token (mostrado na aba Vendas & Dados);
// SALES_WEBHOOK_SECRET é um token global opcional de reserva.
db.exec(`
  CREATE TABLE IF NOT EXISTS client_webhook_tokens (
    clientId TEXT PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    createdAt TEXT NOT NULL
  );
`);

export function getSalesWebhookToken(clientId: string): string | null {
  const row = db.prepare("SELECT token FROM client_webhook_tokens WHERE clientId = ?").get(clientId) as
    | { token: string }
    | undefined;
  return row?.token ?? null;
}

export function rotateSalesWebhookToken(clientId: string): string {
  const token = randomBytes(24).toString("hex");
  db.prepare(
    `INSERT INTO client_webhook_tokens (clientId, token, createdAt) VALUES (?, ?, ?)
     ON CONFLICT(clientId) DO UPDATE SET token = excluded.token, createdAt = excluded.createdAt`
  ).run(clientId, token, new Date().toISOString());
  return token;
}

export function salesTokenAccepted(clientId: string, presented: string | null): boolean {
  if (!presented) return false;
  const own = getSalesWebhookToken(clientId);
  if (own && safeEqual(presented, own)) return true;
  const global = (process.env.SALES_WEBHOOK_SECRET ?? "").trim();
  return global.length >= 16 && safeEqual(presented, global);
}
