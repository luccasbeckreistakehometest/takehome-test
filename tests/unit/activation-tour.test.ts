import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  BRIEFING_READY_PCT,
  activationProgress,
  activationSteps,
  briefingCompleteness,
} from "@/lib/activation-rules";
import {
  AGENCY_CORE_STEPS,
  STEPS_BY_ROLE,
  canShowMore,
  cardPlacement,
  isLastStep,
  stepPath,
  tourKind,
  visibleTotal,
} from "@/lib/tour-steps";
import { STRIP_ITEMS } from "@/lib/differentiators";

const done = (steps: { key: string; done: boolean }[], key: string) => steps.find((s) => s.key === key)?.done;

describe("activation rules", () => {
  it("briefing counts as ready from 60% (5 of 7 fields)", () => {
    const four = { name: "Café", industry: "cafeteria", description: "Café de bairro", audience: "vizinhos" };
    expect(briefingCompleteness(four)).toBe(57);
    expect(done(activationSteps("brand", { briefingPct: briefingCompleteness(four) }), "briefing")).toBe(false);
    const five = { ...four, goals: "vender mais" };
    expect(briefingCompleteness(five)).toBeGreaterThanOrEqual(BRIEFING_READY_PCT);
    expect(done(activationSteps("brand", { briefingPct: briefingCompleteness(five) }), "briefing")).toBe(true);
    // campo com menos de 3 letras ou lista vazia não conta
    expect(briefingCompleteness({ name: "ab", channels: [] })).toBe(0);
  });

  it("brand steps tick from generations, posts, carousels and reports", () => {
    const empty = activationSteps("brand", {}, { clientId: "c1" });
    expect(empty.map((s) => s.key)).toEqual(["briefing", "kit", "calendar", "carousel", "report"]);
    expect(empty.every((s) => !s.done)).toBe(true);
    expect(empty[0].href).toBe("/clients/c1?tab=briefing");
    const full = activationSteps("brand", { briefingPct: 60, generations: 1, scheduledPosts: 1, carousels: 1, reports: 1 });
    expect(activationProgress(full)).toEqual({ done: 5, total: 5, pct: 100, complete: true });
  });

  it("managed client: approval, request, opened invoice, message or pulse", () => {
    expect(activationSteps("managed", {}).map((s) => s.key)).toEqual(["approve", "request", "invoice", "talk"]);
    expect(done(activationSteps("managed", { approvals: 1 }), "approve")).toBe(true);
    expect(done(activationSteps("managed", { requests: 1 }), "request")).toBe(true);
    expect(done(activationSteps("managed", { invoicesSeen: 1 }), "invoice")).toBe(true);
    expect(done(activationSteps("managed", { pulseAnswers: 1 }), "talk")).toBe(true);
    expect(done(activationSteps("managed", { messagesSent: 1 }), "talk")).toBe(true);
    expect(activationSteps("managed", {}, { clientId: "c9" })[0].href).toBe("/portal/client/c9#producoes");
  });

  it("professional: portfolio needs 3 pieces", () => {
    expect(done(activationSteps("professional", { portfolioAssets: 2 }), "portfolio")).toBe(false);
    expect(done(activationSteps("professional", { portfolioAssets: 3 }), "portfolio")).toBe(true);
    expect(done(activationSteps("professional", { profileComplete: true }), "profile")).toBe(true);
    expect(done(activationSteps("professional", { applications: 1 }), "apply")).toBe(true);
    expect(done(activationSteps("professional", { deliveries: 1 }), "deliver")).toBe(true);
    const half = activationSteps("professional", { profileComplete: true, portfolioAssets: 3 });
    expect(activationProgress(half)).toEqual({ done: 2, total: 4, pct: 50, complete: false });
  });

  it("agency: client, branding, package, page and invites", () => {
    const steps = activationSteps("agency", { clients: 1, brandingSet: true, packages: 0, pagePublished: false, invites: 2 });
    expect(steps.map((s) => [s.key, s.done])).toEqual([
      ["client", true],
      ["branding", true],
      ["package", false],
      ["page", false],
      ["invite", true],
    ]);
    expect(activationProgress([]).complete).toBe(true);
  });
});

describe("role tours", () => {
  it("has the planned step counts per role", () => {
    expect(STEPS_BY_ROLE.brand).toHaveLength(5);
    expect(STEPS_BY_ROLE.managed).toHaveLength(4);
    expect(STEPS_BY_ROLE.professional).toHaveLength(5);
    expect(STEPS_BY_ROLE.agency.length).toBeGreaterThan(AGENCY_CORE_STEPS);
  });

  it("never points a managed client, brand or professional at agency screens", () => {
    for (const kind of ["managed", "brand", "professional"] as const) {
      for (const step of STEPS_BY_ROLE[kind]) {
        expect(step.anchors.some((a) => /^(nav-|diff-|briefing-mode|settings-)/.test(a))).toBe(false);
        expect(step.path).toContain("{ref}");
      }
    }
    expect(STEPS_BY_ROLE.managed.every((s) => s.path === "/portal/client/{ref}")).toBe(true);
  });

  it("agency first run stops at 6 with an optional 'see all'", () => {
    expect(visibleTotal("agency", 0)).toBe(AGENCY_CORE_STEPS);
    expect(isLastStep("agency", AGENCY_CORE_STEPS - 1)).toBe(true);
    expect(canShowMore("agency", AGENCY_CORE_STEPS - 1)).toBe(true);
    expect(canShowMore("agency", 0)).toBe(false);
    expect(visibleTotal("agency", AGENCY_CORE_STEPS)).toBe(STEPS_BY_ROLE.agency.length);
    expect(isLastStep("agency", AGENCY_CORE_STEPS)).toBe(false);
    expect(isLastStep("agency", STEPS_BY_ROLE.agency.length - 1)).toBe(true);
    expect(canShowMore("professional", 4)).toBe(false);
    expect(isLastStep("managed", 3)).toBe(true);
  });

  it("maps the session to a tour and fills the path", () => {
    expect(tourKind({ role: "agency" })).toBe("agency");
    expect(tourKind({ role: "client", refId: "c1", selfServe: true })).toBe("brand");
    expect(tourKind({ role: "client", refId: "c1", selfServe: false })).toBe("managed");
    expect(tourKind({ role: "professional", refId: "p1" })).toBe("professional");
    expect(tourKind({ role: "admin" })).toBeNull();
    expect(tourKind(null)).toBeNull();
    expect(stepPath(STEPS_BY_ROLE.managed[0], "abc")).toBe("/portal/client/abc");
  });

  it("uses a bottom sheet on phones, without an anchor, or when nothing fits", () => {
    const rect = { top: 100, left: 20, width: 200, height: 40 };
    expect(cardPlacement(rect, { width: 390, height: 844 })).toEqual({ mode: "sheet" });
    expect(cardPlacement(null, { width: 1280, height: 800 })).toEqual({ mode: "sheet" });
    expect(cardPlacement(rect, { width: 1280, height: 800 })).toEqual({ mode: "below", top: 152, left: 20 });
    const low = { top: 600, left: 1200, width: 60, height: 40 };
    expect(cardPlacement(low, { width: 1280, height: 800 })).toEqual({ mode: "above", bottom: 212, left: 908 });
    const tall = { top: 60, left: 20, width: 600, height: 700 };
    expect(cardPlacement(tall, { width: 1280, height: 800 })).toEqual({ mode: "sheet" });
  });
});

describe("differentiators strip", () => {
  it("every card anchors a tour step and links to a real page", () => {
    const anchors = new Set(STEPS_BY_ROLE.agency.flatMap((s) => s.anchors));
    for (const item of STRIP_ITEMS) {
      expect(anchors.has(item.anchor), item.anchor).toBe(true);
      const route = item.href.split(/[?#]/)[0];
      const file = path.join(process.cwd(), "app", route === "/" ? "" : route, "page.tsx");
      expect(existsSync(file), `${item.href} → ${file}`).toBe(true);
    }
    // tudo o que o tour da agência aponta em diff-* existe no strip
    const stripAnchors = new Set(STRIP_ITEMS.map((i) => i.anchor));
    for (const step of STEPS_BY_ROLE.agency) {
      for (const a of step.anchors.filter((x) => x.startsWith("diff-"))) expect(stripAnchors.has(a), a).toBe(true);
    }
  });
});
