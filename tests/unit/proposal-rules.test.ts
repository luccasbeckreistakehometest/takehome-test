import { describe, expect, it } from "vitest";
import {
  canAccept,
  expiryFromNow,
  isProposalExpired,
  mockProposalContent,
  proposalState,
  validityLabel,
} from "@/lib/proposal-rules";

const now = new Date("2026-09-17T12:00:00Z");
const packages = [
  { name: "Essencial", price: 1500, period: "mês", items: [], recommended: false },
  { name: "Crescimento", price: 2900, period: "mês", items: [], recommended: true },
];

describe("expiry", () => {
  it("adds N days and clamps to 1..90", () => {
    expect(expiryFromNow(now, 14)).toBe("2026-10-01T12:00:00.000Z");
    expect(expiryFromNow(now, 0)).toBe("2026-09-18T12:00:00.000Z");
    expect(expiryFromNow(now, 400)).toBe("2026-12-16T12:00:00.000Z");
    expect(expiryFromNow(now, Number.NaN)).toBe("2026-10-01T12:00:00.000Z");
  });
  it("expires at the exact instant and never for accepted proposals", () => {
    expect(isProposalExpired({ expiresAt: "2026-09-17T12:00:00.000Z", status: "sent" }, now)).toBe(true);
    expect(isProposalExpired({ expiresAt: "2026-09-17T12:00:00.001Z", status: "viewed" }, now)).toBe(false);
    expect(isProposalExpired({ expiresAt: "2020-01-01T00:00:00.000Z", status: "accepted" }, now)).toBe(false);
  });
  it("maps to a public state", () => {
    expect(proposalState({ expiresAt: "2026-10-01T00:00:00.000Z", status: "sent" }, now)).toBe("open");
    expect(proposalState({ expiresAt: "2026-09-01T00:00:00.000Z", status: "viewed" }, now)).toBe("expired");
    expect(proposalState({ expiresAt: "2026-09-01T00:00:00.000Z", status: "accepted" }, now)).toBe("accepted");
  });
});

describe("canAccept", () => {
  const open = { expiresAt: "2026-10-01T00:00:00.000Z", status: "sent" as const, content: { packages } };
  it("accepts an open proposal with a known package", () => {
    expect(canAccept(open, "Crescimento", now)).toEqual({ ok: true });
  });
  it("refuses expired, already accepted and unknown packages", () => {
    expect(canAccept({ ...open, expiresAt: "2026-09-01T00:00:00.000Z" }, "Crescimento", now)).toEqual({ ok: false, reason: "expired" });
    expect(canAccept({ ...open, status: "accepted" }, "Crescimento", now)).toEqual({ ok: false, reason: "accepted" });
    expect(canAccept(open, "Platina", now)).toEqual({ ok: false, reason: "unknown_package" });
  });
});

describe("copy", () => {
  it("writes the validity line in each language", () => {
    expect(validityLabel("2026-10-01T12:00:00.000Z", "pt-BR")).toMatch(/^Válida até /);
    expect(validityLabel("2026-10-01T12:00:00.000Z", "en")).toMatch(/^Valid until /);
  });
  it("mock content is coherent and marks exactly one recommended package", () => {
    const content = mockProposalContent({ prospectName: "Padaria Sol", segment: "padaria", location: "Curitiba", whyFit: "sem Instagram", marketingMaturity: "", agencyName: "Marqa", lang: "pt-BR", services: "" });
    expect(content.headline).toContain("Padaria Sol");
    expect(content.packages.filter((p) => p.recommended)).toHaveLength(1);
    expect(content.timeline).toHaveLength(3);
    const en = mockProposalContent({ prospectName: "Sun Bakery", segment: "bakery", location: "", whyFit: "", marketingMaturity: "", agencyName: "Marqa", lang: "en", services: "IG $500" });
    expect(en.validityNote).toContain("IG $500");
  });
});
