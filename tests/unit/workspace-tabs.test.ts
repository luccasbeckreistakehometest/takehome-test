import { describe, expect, it } from "vitest";
import { TAB_GROUPS, TAB_KEYS, groupOfTab, isTabKey, resolveTab, visibleGroups } from "@/lib/workspace-tabs";
import { AGENCY_MORE_NAV, AGENCY_PRIMARY_NAV, navItemActive } from "@/lib/nav";
import { GENERATION_LABELS } from "@/lib/types";

const agency = { viewerRole: "agency", landingEnabled: false };
const brand = { viewerRole: "client", landingEnabled: false };

describe("workspace tab resolver", () => {
  it("maps every tab in a group back to that group", () => {
    for (const group of TAB_GROUPS) {
      for (const tab of group.tabs) expect(groupOfTab(tab.key)).toBe(group.key);
    }
  });

  it("each tab lives in exactly one group and is a known key", () => {
    const seen = TAB_GROUPS.flatMap((g) => g.tabs.map((t) => t.key));
    expect(new Set(seen).size).toBe(seen.length);
    for (const key of seen) expect(TAB_KEYS).toContain(key);
  });

  it("keeps every generation type reachable by ?tab=", () => {
    for (const type of Object.keys(GENERATION_LABELS)) {
      const viewer = { viewerRole: "agency", landingEnabled: true };
      expect(resolveTab(type, viewer).tab).toBe(type);
    }
  });

  it("opens ?tab=campaign30 in the Plano group", () => {
    expect(resolveTab("campaign30", agency)).toEqual({ tab: "campaign30", group: "plan" });
  });

  it("old deep links keep their content", () => {
    expect(resolveTab("time", agency).group).toBe("ops");
    expect(resolveTab("attendant", agency).group).toBe("ops");
    expect(resolveTab("briefing", agency).group).toBe("overview");
    expect(resolveTab("client_report", agency).group).toBe("reports");
  });

  it("unknown or hidden tabs fall back to the dashboard", () => {
    expect(resolveTab("nope", agency).tab).toBe("dashboard");
    expect(resolveTab(null, agency).tab).toBe("dashboard");
    expect(resolveTab("landing_page", agency).tab).toBe("dashboard");
    expect(resolveTab("landing_page", { ...agency, landingEnabled: true }).tab).toBe("landing_page");
  });

  it("a brand never sees agency-only tabs", () => {
    const tabs = visibleGroups(brand).flatMap((g) => g.tabs.map((t) => t.key));
    expect(tabs).not.toContain("time");
    expect(tabs).not.toContain("attendant");
    expect(resolveTab("time", brand).tab).toBe("dashboard");
    expect(isTabKey("time")).toBe(true);
  });
});

describe("agency navigation", () => {
  it("has at most 7 primary items", () => {
    expect(AGENCY_PRIMARY_NAV.length).toBeLessThanOrEqual(7);
    expect(AGENCY_MORE_NAV.length).toBeGreaterThan(0);
  });

  it("uses a different icon for every primary item", () => {
    const icons = AGENCY_PRIMARY_NAV.map((i) => i.icon);
    expect(new Set(icons).size).toBe(icons.length);
  });

  it("lights Agenda on both calendar and meetings, Resultados on finance", () => {
    const agenda = AGENCY_PRIMARY_NAV.find((i) => i.label === "Agenda")!;
    expect(navItemActive(agenda, "/calendar")).toBe(true);
    expect(navItemActive(agenda, "/agenda")).toBe(true);
    const results = AGENCY_PRIMARY_NAV.find((i) => i.label === "Resultados")!;
    expect(navItemActive(results, "/finance")).toBe(true);
    const home = AGENCY_PRIMARY_NAV[0];
    expect(navItemActive(home, "/")).toBe(true);
    expect(navItemActive(home, "/clients")).toBe(false);
  });

  it("keeps every old top-level page reachable from the menu", () => {
    const reachable = new Set([...AGENCY_PRIMARY_NAV, ...AGENCY_MORE_NAV].flatMap((i) => i.match ?? [i.href]));
    for (const path of ["/", "/clients", "/production", "/calendar", "/insights", "/messages", "/prospecting", "/professionals", "/agenda", "/ideas", "/plans"]) {
      expect(reachable.has(path), path).toBe(true);
    }
  });
});
