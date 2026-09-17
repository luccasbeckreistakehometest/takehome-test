import { createHash, randomBytes } from "crypto";
import { getKv, setKv } from "./kv-settings";

// Identificador de visitante sem cookie: hash(sal do dia + IP + navegador),
// cortado em 16 caracteres. O sal muda todo dia e nunca sai do servidor, então
// não dá para seguir alguém de um dia para o outro (LGPD).
const memory: { day: string; salt: string } = { day: "", salt: "" };

export function dailySalt(now: Date = new Date()): string {
  const day = now.toISOString().slice(0, 10);
  if (memory.day === day && memory.salt) return memory.salt;
  const stored = getKv<{ day: string; salt: string }>("visitor_salt", { day: "", salt: "" });
  if (stored.day === day && stored.salt) {
    memory.day = day;
    memory.salt = stored.salt;
    return stored.salt;
  }
  const salt = randomBytes(16).toString("hex");
  setKv("visitor_salt", { day, salt });
  memory.day = day;
  memory.salt = salt;
  return salt;
}

export function visitorHash(ip: string, userAgent: string, now: Date = new Date()): string {
  return createHash("sha256").update(`${dailySalt(now)}|${ip}|${userAgent}`).digest("hex").slice(0, 16);
}
