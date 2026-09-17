import { db, tenantColumn } from "./db";
import {
  DEFAULT_BRAND_VOICE_POLICY,
  sanitizeBrandVoicePolicy,
  type BrandVoicePolicy,
  type BrandVoicePolicyInput,
  type CheckKind,
} from "./brand-voice-rules";

// Guardião da voz da marca: política por cliente + cache das checagens e
// reescritas por hash de conteúdo (mesmo texto = mesma resposta, sem cobrar).

db.exec(`
  CREATE TABLE IF NOT EXISTS brand_voice_policies (
    clientId TEXT PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
    bannedTerms TEXT NOT NULL DEFAULT '[]',
    requiredTerms TEXT NOT NULL DEFAULT '[]',
    requireCta INTEGER NOT NULL DEFAULT 1,
    maxHashtags INTEGER NOT NULL DEFAULT 10,
    maxEmojis INTEGER NOT NULL DEFAULT 4,
    flagClaims INTEGER NOT NULL DEFAULT 1,
    notes TEXT NOT NULL DEFAULT '',
    updatedAt TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS brand_voice_cache (
    hash TEXT PRIMARY KEY,
    clientId TEXT NOT NULL,
    op TEXT NOT NULL,
    kind TEXT NOT NULL,
    result TEXT NOT NULL,
    createdAt TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_voice_cache_client ON brand_voice_cache(clientId, createdAt);
`);
tenantColumn("brand_voice_policies");
tenantColumn("brand_voice_cache");

type PolicyRow = {
  bannedTerms: string;
  requiredTerms: string;
  requireCta: number;
  maxHashtags: number;
  maxEmojis: number;
  flagClaims: number;
  notes: string;
};

const parse = (json: string): string[] => {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
};

export function getBrandVoicePolicy(clientId: string): BrandVoicePolicy {
  const row = db.prepare("SELECT * FROM brand_voice_policies WHERE clientId = ?").get(clientId) as PolicyRow | undefined;
  if (!row) return { ...DEFAULT_BRAND_VOICE_POLICY };
  return sanitizeBrandVoicePolicy({
    bannedTerms: parse(row.bannedTerms),
    requiredTerms: parse(row.requiredTerms),
    requireCta: row.requireCta === 1,
    maxHashtags: row.maxHashtags,
    maxEmojis: row.maxEmojis,
    flagClaims: row.flagClaims === 1,
    notes: row.notes,
  });
}

export function saveBrandVoicePolicy(clientId: string, input: BrandVoicePolicyInput): BrandVoicePolicy {
  const policy = sanitizeBrandVoicePolicy(input, getBrandVoicePolicy(clientId));
  db.prepare(
    `INSERT INTO brand_voice_policies (clientId, agencyId, bannedTerms, requiredTerms, requireCta, maxHashtags, maxEmojis, flagClaims, notes, updatedAt)
     VALUES (@clientId, (SELECT agencyId FROM clients WHERE id = @clientId), @bannedTerms, @requiredTerms, @requireCta, @maxHashtags, @maxEmojis, @flagClaims, @notes, @updatedAt)
     ON CONFLICT(clientId) DO UPDATE SET bannedTerms=@bannedTerms, requiredTerms=@requiredTerms, requireCta=@requireCta, maxHashtags=@maxHashtags,
       maxEmojis=@maxEmojis, flagClaims=@flagClaims, notes=@notes, updatedAt=@updatedAt`
  ).run({
    clientId,
    bannedTerms: JSON.stringify(policy.bannedTerms),
    requiredTerms: JSON.stringify(policy.requiredTerms),
    requireCta: policy.requireCta ? 1 : 0,
    maxHashtags: policy.maxHashtags,
    maxEmojis: policy.maxEmojis,
    flagClaims: policy.flagClaims ? 1 : 0,
    notes: policy.notes,
    updatedAt: new Date().toISOString(),
  });
  return policy;
}

export function readCache<T>(hash: string): T | null {
  const row = db.prepare("SELECT result FROM brand_voice_cache WHERE hash = ?").get(hash) as { result: string } | undefined;
  if (!row) return null;
  try {
    return JSON.parse(row.result) as T;
  } catch {
    return null;
  }
}

export function writeCache(input: { hash: string; clientId: string; op: "check" | "rewrite"; kind: CheckKind; result: unknown }): void {
  db.prepare(
    `INSERT INTO brand_voice_cache (hash, agencyId, clientId, op, kind, result, createdAt)
     VALUES (?, (SELECT agencyId FROM clients WHERE id = ?), ?, ?, ?, ?, ?)
     ON CONFLICT(hash) DO UPDATE SET result = excluded.result, createdAt = excluded.createdAt`
  ).run(input.hash, input.clientId, input.clientId, input.op, input.kind, JSON.stringify(input.result), new Date().toISOString());
}

export function voiceCacheStats(clientId: string): { checks: number; rewrites: number } {
  const count = (op: string) => (db.prepare("SELECT COUNT(*) AS c FROM brand_voice_cache WHERE clientId = ? AND op = ?").get(clientId, op) as { c: number }).c;
  return { checks: count("check"), rewrites: count("rewrite") };
}
