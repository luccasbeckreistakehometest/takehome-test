import { describe, expect, it } from "vitest";
import {
  createRateLimiter,
  isPageLive,
  isValidSlug,
  leadRateLimitPerHour,
  leadToProspectFields,
  normalizeSlug,
  sanitizeAgencyPage,
  validateLead,
} from "@/lib/agency-page-rules";

describe("slug", () => {
  it("strips accents, symbols and edges", () => {
    expect(normalizeSlug("Estúdio Sol & Cia")).toBe("estudio-sol-cia");
    expect(normalizeSlug("  --Marqa!! ")).toBe("marqa");
    expect(normalizeSlug("ção")).toBe("cao");
    expect(normalizeSlug("###")).toBe("");
  });
  it("caps the length without leaving a trailing dash", () => {
    const slug = normalizeSlug("a".repeat(39) + " b");
    expect(slug.length).toBeLessThanOrEqual(40);
    expect(slug.endsWith("-")).toBe(false);
  });
  it("validates", () => {
    expect(isValidSlug("estudio-sol")).toBe(true);
    expect(isValidSlug("-x")).toBe(false);
    expect(isValidSlug("a")).toBe(true);
    expect(isValidSlug("Estudio")).toBe(false);
  });
  it("page is live only when published with a matching slug", () => {
    expect(isPageLive({ slug: "sol", published: true }, "sol")).toBe(true);
    expect(isPageLive({ slug: "sol", published: true }, "SOL")).toBe(true);
    expect(isPageLive({ slug: "sol", published: false }, "sol")).toBe(false);
    expect(isPageLive({ slug: "", published: true }, "")).toBe(false);
  });
});

describe("sanitizeAgencyPage", () => {
  it("cleans services and testimonials and keeps base values for missing fields", () => {
    const cfg = sanitizeAgencyPage(
      { slug: "Estúdio Sol", services: [" Social ", "", "Tráfego"], testimonials: [{ author: "Ana", role: "", text: " Ótimo " }, { author: "", role: "x", text: "sem autor" }] },
      { ...sanitizeAgencyPage({}), headline: "Mantida" }
    );
    expect(cfg.slug).toBe("estudio-sol");
    expect(cfg.services).toEqual(["Social", "Tráfego"]);
    expect(cfg.testimonials).toEqual([{ author: "Ana", role: "", text: "Ótimo" }]);
    expect(cfg.headline).toBe("Mantida");
    expect(cfg.published).toBe(false);
  });
  it("keeps only digits in the WhatsApp number", () => {
    expect(sanitizeAgencyPage({ whatsapp: "+55 (11) 99999-0000" }).whatsapp).toBe("5511999990000");
  });
});

describe("validateLead", () => {
  const good = { name: "Dona Sol", whatsapp: "(11) 99999-0000", need: "Quero posts para a padaria", budgetBand: "1k-3k" };
  it("accepts a real lead and normalises the phone", () => {
    const r = validateLead(good);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.lead.whatsapp).toBe("11999990000");
  });
  it("flags the honeypot before anything else", () => {
    expect(validateLead({ ...good, website: "http://spam" })).toEqual({ ok: false, reason: "honeypot" });
  });
  it("rejects short names, bad phones, empty needs and unknown bands", () => {
    expect(validateLead({ ...good, name: "A" })).toEqual({ ok: false, reason: "name" });
    expect(validateLead({ ...good, whatsapp: "123" })).toEqual({ ok: false, reason: "whatsapp" });
    expect(validateLead({ ...good, need: "oi" })).toEqual({ ok: false, reason: "need" });
    expect(validateLead({ ...good, budgetBand: "muito" })).toEqual({ ok: false, reason: "budget" });
    expect(validateLead(null).ok).toBe(false);
  });
  it("maps the lead into prospect fields in both languages", () => {
    const r = validateLead(good);
    if (!r.ok) throw new Error("expected ok");
    expect(leadToProspectFields(r.lead).whyFit).toContain("Quero posts");
    expect(leadToProspectFields(r.lead).suggestedApproach).toContain("+11999990000");
    expect(leadToProspectFields(r.lead, "en").marketingMaturity).toContain("R$ 1k–3k");
  });
});

describe("rate limiter", () => {
  it("allows N per window per key, then refuses with a retry hint", () => {
    const limiter = createRateLimiter({ limit: 3, windowMs: 60_000 });
    const t0 = 1_000_000;
    expect(limiter.check("ip1", t0).ok).toBe(true);
    expect(limiter.check("ip1", t0 + 1).ok).toBe(true);
    expect(limiter.check("ip1", t0 + 2)).toEqual({ ok: true, remaining: 0, retryAfterMs: 0 });
    const refused = limiter.check("ip1", t0 + 3);
    expect(refused.ok).toBe(false);
    expect(refused.retryAfterMs).toBe(60_000 - 3);
    // outra chave não é afetada
    expect(limiter.check("ip2", t0 + 3).ok).toBe(true);
  });
  it("frees the slot once the window slides", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000 });
    expect(limiter.check("ip", 0).ok).toBe(true);
    expect(limiter.check("ip", 999).ok).toBe(false);
    expect(limiter.check("ip", 1000).ok).toBe(true);
  });
  it("refused attempts do not consume quota", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000 });
    limiter.check("ip", 0);
    limiter.check("ip", 10);
    limiter.check("ip", 20);
    expect(limiter.check("ip", 1000).ok).toBe(true);
  });
  it("reads the env with a safe default", () => {
    expect(leadRateLimitPerHour(undefined)).toBe(5);
    expect(leadRateLimitPerHour("abc")).toBe(5);
    expect(leadRateLimitPerHour("0")).toBe(5);
    expect(leadRateLimitPerHour("12")).toBe(12);
  });
});
