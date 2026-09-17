import { randomBytes } from "crypto";
import { db } from "./db";

// Autenticação dos webhooks de entrada.

import { safeEqual } from "./webhook-auth-pure";

export { metaVerifyToken, safeEqual, verifyMetaSignature } from "./webhook-auth-pure";

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
