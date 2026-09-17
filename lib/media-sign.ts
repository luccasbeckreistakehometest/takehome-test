import { createHmac, timingSafeEqual } from "crypto";

// Endereço público assinado para uma imagem de carrossel (o Instagram busca
// a mídia por URL). Assinatura HMAC com o AUTH_SECRET; sem segredo, nada.
function secret(): string {
  return process.env.AUTH_SECRET ?? "";
}

export function signMedia(carouselId: string, index: number, hash: string): string | null {
  const key = secret();
  if (key.length < 32) return null;
  return createHmac("sha256", key).update(`carousel:${carouselId}:${index}:${hash}`).digest("base64url").slice(0, 32);
}

export function verifyMedia(carouselId: string, index: number, hash: string, sig: string | null): boolean {
  const expected = signMedia(carouselId, index, hash);
  if (!expected || !sig || sig.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
}
