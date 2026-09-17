import { describe, expect, it } from "vitest";
import {
  contentHash,
  countEmojis,
  countHashtags,
  DEFAULT_BRAND_VOICE_POLICY,
  findClaims,
  hasCta,
  mergeCheck,
  mockRewrite,
  mockToneAssessment,
  parseTerms,
  ruleChecks,
  sanitizeBrandVoicePolicy,
  verdictFrom,
} from "@/lib/brand-voice-rules";

const policy = sanitizeBrandVoicePolicy({ bannedTerms: "barato, promoção relâmpago", requiredTerms: ["Café Aurora"], maxHashtags: 3, maxEmojis: 2 });

describe("policy", () => {
  it("parses terms from commas, semicolons and lines, deduplicating accent-insensitively", () => {
    expect(parseTerms("Barato, barato; grátis\n GRÁTIS \n\n")).toEqual(["Barato", "grátis"]);
  });
  it("clamps numbers and keeps base values for missing fields", () => {
    const p = sanitizeBrandVoicePolicy({ maxHashtags: 99, maxEmojis: -1 });
    expect(p.maxHashtags).toBe(30);
    expect(p.maxEmojis).toBe(0);
    expect(p.requireCta).toBe(true);
    expect(sanitizeBrandVoicePolicy({}, policy).bannedTerms).toEqual(["barato", "promoção relâmpago"]);
  });
});

describe("counters and detectors", () => {
  it("counts hashtags and emojis", () => {
    expect(countHashtags("oi #café #pão_quente #3")).toBe(3);
    expect(countHashtags("email#nao")).toBe(0);
    expect(countEmojis("☕🥐 bom dia 😀")).toBe(3);
  });
  it("finds calls to action in pt and en", () => {
    expect(hasCta("Vem tomar um café com a gente!")).toBe(true);
    expect(hasCta("Chame no WhatsApp para reservar")).toBe(true);
    expect(hasCta("Link na bio 👆")).toBe(true);
    expect(hasCta("Shop now and get yours")).toBe(true);
    expect(hasCta("Nosso pão sai às 7h todos os dias.")).toBe(false);
  });
  it("flags claims that need a source", () => {
    expect(findClaims("O melhor café da cidade, 100% arábica, resultado garantido")).toEqual(["100%", "o melhor", "resultado garantido"]);
    expect(findClaims("Café mais barato da cidade")).toEqual(["mais barato da"]);
    expect(findClaims("Clinically proven, #1 in town")).toEqual(["#1", "clinically"]);
    expect(findClaims("Pão quentinho às 7h")).toEqual([]);
  });
});

describe("ruleChecks", () => {
  it("blocks banned terms and warns on the rest", () => {
    const issues = ruleChecks("Café mais BARATO da cidade!!! ☕🥐😀 #a #b #c #d", policy, "post");
    expect(issues.map((i) => `${i.code}:${i.severity}`)).toEqual([
      "banned_term:block",
      "missing_term:warn",
      "no_cta:warn",
      "too_many_hashtags:warn",
      "too_many_emojis:warn",
      "claim_needs_source:warn",
    ]);
    expect(issues[0].detail).toBe("barato");
    expect(issues[3].detail).toBe("4/3");
  });
  it("matches multi-word banned terms literally and words on boundaries", () => {
    expect(ruleChecks("Promoção relâmpago hoje", policy).some((i) => i.code === "banned_term")).toBe(true);
    expect(ruleChecks("Um baratomóvel", policy).some((i) => i.code === "banned_term")).toBe(false);
  });
  it("does not demand a CTA in a WhatsApp reply", () => {
    const issues = ruleChecks("Oi! O Café Aurora abre às 7h.", policy, "reply");
    expect(issues).toEqual([]);
  });
  it("is clean for a good post", () => {
    expect(ruleChecks("Café Aurora: pão quentinho às 7h ☕. Vem tomar um café com a gente! #cafe #padaria", policy, "post")).toEqual([]);
  });
});

describe("verdict and merge", () => {
  it("block on banned term or low score; review on warnings or mid score; ok otherwise", () => {
    expect(verdictFrom(90, [])).toBe("ok");
    expect(verdictFrom(65, [])).toBe("review");
    expect(verdictFrom(90, [{ code: "no_cta", severity: "warn", detail: "" }])).toBe("review");
    expect(verdictFrom(90, [{ code: "banned_term", severity: "block", detail: "x" }])).toBe("block");
    expect(verdictFrom(40, [])).toBe("block");
  });
  it("merges the AI assessment with the rules and clamps the score", () => {
    const check = mergeCheck({ toneScore: 140, toneNotes: [], claims: [], suggestions: [] }, [], { cached: true, demo: false });
    expect(check.toneScore).toBe(100);
    expect(check.verdict).toBe("ok");
    expect(check.cached).toBe(true);
  });
  it("hashes content deterministically and sensitively", () => {
    const base = { op: "check" as const, clientId: "c", kind: "post" as const, text: "oi", policy, tone: "acolhedor" };
    expect(contentHash(base)).toBe(contentHash({ ...base, text: " oi " }));
    expect(contentHash(base)).not.toBe(contentHash({ ...base, text: "oi!" }));
    expect(contentHash(base)).not.toBe(contentHash({ ...base, op: "rewrite" }));
    expect(contentHash(base)).not.toBe(contentHash({ ...base, policy: { ...policy, maxEmojis: 1 } }));
  });
});

describe("fixtures", () => {
  it("scores shouting and banned terms down, praises a clean text", () => {
    const bad = mockToneAssessment("Café mais BARATO da cidade!!!", policy, "acolhedor", "pt-BR");
    expect(bad.toneScore).toBeLessThan(50);
    expect(bad.claims[0].text).toBe("mais barato da");
    const good = mockToneAssessment("Café Aurora: pão quentinho às 7h ☕. Vem tomar um café com a gente!", policy, "acolhedor", "pt-BR");
    expect(good.toneScore).toBeGreaterThanOrEqual(85);
    expect(good.toneNotes[0]).toContain("acolhedor");
  });
  it("rewrites into a text that passes the rules", () => {
    const rewritten = mockRewrite("Café mais BARATO da cidade!!! ☕🥐😀 #a #b #c #d", policy, "post", "pt-BR");
    expect(ruleChecks(rewritten, policy, "post")).toEqual([]);
    expect(rewritten).toContain("Café Aurora");
    expect(rewritten).not.toMatch(/barato/i);
    expect(countHashtags(rewritten)).toBe(3);
    expect(countEmojis(rewritten)).toBe(2);
    expect(hasCta(rewritten)).toBe(true);
    expect(mockRewrite("Cheapest coffee!!!", DEFAULT_BRAND_VOICE_POLICY, "post", "en")).toContain("WhatsApp");
  });
});
