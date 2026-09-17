import { describe, expect, it } from "vitest";
import {
  alreadyDecided,
  isApprovalToken,
  isStale,
  linkCovers,
  linkExpiry,
  linkState,
  normalizeItems,
  postStatusAfter,
  shareText,
  validateDecision,
  whatsappShareUrl,
} from "@/lib/approval-link-rules";

const now = new Date("2026-09-17T12:00:00.000Z");

describe("approval link rules", () => {
  it("accepts only 43-char base64url tokens", () => {
    expect(isApprovalToken("a".repeat(43))).toBe(true);
    expect(isApprovalToken("a".repeat(42))).toBe(false);
    expect(isApprovalToken("a".repeat(42) + "/")).toBe(false);
    expect(isApprovalToken(null)).toBe(false);
  });

  it("is open until it expires or is closed", () => {
    expect(linkState({ status: "open", expiresAt: "2026-09-18T00:00:00.000Z" }, now)).toBe("open");
    expect(linkState({ status: "open", expiresAt: "2026-09-17T12:00:00.000Z" }, now)).toBe("expired");
    expect(linkState({ status: "closed", expiresAt: "2026-12-01T00:00:00.000Z" }, now)).toBe("closed");
  });

  it("defaults to 14 days and clamps the validity", () => {
    expect(linkExpiry(undefined, now)).toBe("2026-10-01T12:00:00.000Z");
    expect(linkExpiry(0, now)).toBe("2026-09-18T12:00:00.000Z");
    expect(linkExpiry(999, now)).toBe("2026-11-16T12:00:00.000Z");
  });

  it("dedupes items, drops junk and checks coverage by kind and id", () => {
    const items = normalizeItems([
      { kind: "post", id: "p1" },
      { kind: "post", id: "p1" },
      { kind: "deliverable", id: "d1" },
      { kind: "other" as never, id: "x" },
      { kind: "post", id: "" },
    ]);
    expect(items).toEqual([
      { kind: "post", id: "p1" },
      { kind: "deliverable", id: "d1" },
    ]);
    expect(linkCovers(items, "post", "p1")).toBe(true);
    expect(linkCovers(items, "deliverable", "p1")).toBe(false);
    expect(linkCovers(items, "post", "p2")).toBe(false);
    expect(normalizeItems(Array.from({ length: 50 }, (_, i) => ({ kind: "post" as const, id: `p${i}` })))).toHaveLength(30);
  });

  it("requires a comment only when asking for changes", () => {
    expect(validateDecision({ decision: "approved" })).toEqual({ ok: true, value: { decision: "approved", note: "", approver: "" } });
    expect(validateDecision({ decision: "changes_requested", note: "  " }).ok).toBe(false);
    expect(validateDecision({ decision: "changes_requested", note: "ok" }).ok).toBe(false);
    expect(validateDecision({ decision: "changes_requested", note: "Trocar a foto" }).ok).toBe(true);
    expect(validateDecision({ decision: "maybe" }).ok).toBe(false);
    expect(validateDecision({ decision: "approved", note: "x".repeat(1001) }).ok).toBe(false);
    const named = validateDecision({ decision: "approved", approver: "  Ana   Paula  " });
    expect(named.ok && named.value.approver).toBe("Ana Paula");
  });

  it("moves an approved draft into the schedule and keeps changes as a draft", () => {
    expect(postStatusAfter("draft", "approved")).toBe("scheduled");
    expect(postStatusAfter("scheduled", "approved")).toBe("scheduled");
    expect(postStatusAfter("scheduled", "changes_requested")).toBe("draft");
    expect(postStatusAfter("published", "changes_requested")).toBe("published");
    expect(alreadyDecided("approved", "approved")).toBe(true);
    expect(alreadyDecided("approved", "changes_requested")).toBe(false);
  });

  it("writes the WhatsApp message in the client's language", () => {
    const pt = shareText({ clientName: "Café Aurora", agencyName: "Agência Sol", url: "https://x/aprovar/t", count: 3 });
    expect(pt).toContain("3 peças de Café Aurora");
    expect(pt).toContain("não precisa de senha");
    const en = shareText({ clientName: "Aurora", agencyName: "Sun", url: "https://x/aprovar/t", count: 1, lang: "en" });
    expect(en).toContain("There is 1 item");
    expect(whatsappShareUrl("oi & tchau", "+55 (11) 99999-0000")).toBe("https://wa.me/5511999990000?text=oi%20%26%20tchau");
    expect(whatsappShareUrl("oi")).toBe("https://wa.me/?text=oi");
  });

  it("flags links waiting for 48 hours or more", () => {
    expect(isStale("2026-09-15T12:00:00.000Z", 48, now)).toBe(true);
    expect(isStale("2026-09-15T12:00:01.000Z", 48, now)).toBe(false);
  });
});
