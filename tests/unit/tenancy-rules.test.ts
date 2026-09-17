import { describe, expect, it } from "vitest";
import {
  adminScope,
  agencyLogoUploadId,
  agencyScope,
  ALL_AGENCIES,
  billingAgencyId,
  HOUSE_AGENCY_ID,
  inScope,
  isAllAgencies,
  kvKeyFor,
  NO_AGENCY,
  professionalEditableBy,
  professionalVisibleTo,
  scopeForSession,
  scopeWhere,
  slugBase,
  uniqueSlug,
} from "../../lib/tenancy-rules";

describe("tenant scope", () => {
  it("admin sees every agency; everyone else only their own", () => {
    expect(scopeForSession({ role: "admin", agencyId: null })).toBe(ALL_AGENCIES);
    expect(scopeForSession({ role: "admin", agencyId: "a1" })).toBe(ALL_AGENCIES);
    expect(scopeForSession({ role: "agency", agencyId: "a1" }).agencyId).toBe("a1");
    expect(scopeForSession({ role: "client", agencyId: "a2" }).agencyId).toBe("a2");
    expect(scopeForSession({ role: "professional", agencyId: null }).agencyId).toBe(NO_AGENCY);
    // sessão sem agência nunca vira "todas"
    expect(scopeForSession({ role: "agency" }).agencyId).toBe(NO_AGENCY);
    expect(agencyScope("").agencyId).toBe(NO_AGENCY);
  });

  it("admin filter narrows to one agency or keeps all", () => {
    expect(isAllAgencies(adminScope(null))).toBe(true);
    expect(isAllAgencies(adminScope("  "))).toBe(true);
    expect(adminScope("a9").agencyId).toBe("a9");
  });

  it("builds the SQL fragment with a bound parameter", () => {
    expect(scopeWhere(ALL_AGENCIES)).toEqual({ sql: "1=1", params: [] });
    expect(scopeWhere(agencyScope("a1"))).toEqual({ sql: "agencyId = ?", params: ["a1"] });
    expect(scopeWhere(agencyScope("a1"), "c.agencyId")).toEqual({ sql: "c.agencyId = ?", params: ["a1"] });
  });

  it("checks a row against the scope", () => {
    expect(inScope(ALL_AGENCIES, "a1")).toBe(true);
    expect(inScope(ALL_AGENCIES, null)).toBe(true);
    expect(inScope(agencyScope("a1"), "a1")).toBe(true);
    expect(inScope(agencyScope("a1"), "a2")).toBe(false);
    expect(inScope(agencyScope("a1"), null)).toBe(false);
    expect(inScope(agencyScope("a1"), undefined)).toBe(false);
    expect(inScope(scopeForSession({ role: "agency" }), NO_AGENCY)).toBe(true); // só o id sentinela, que nenhuma linha tem
  });
});

describe("per-agency keys", () => {
  it("house keeps the legacy keys and file ids; other agencies get suffixed ones", () => {
    expect(kvKeyFor("approval_rules", HOUSE_AGENCY_ID)).toBe("approval_rules");
    expect(kvKeyFor("approval_rules", "a1")).toBe("approval_rules:a1");
    expect(agencyLogoUploadId(HOUSE_AGENCY_ID)).toBe("agency-logo");
    expect(agencyLogoUploadId("a1")).toBe("agency-logo-a1");
  });

  it("maps billing accounts to their agency", () => {
    const lookup = { client: (id: string) => (id === "c1" ? "a1" : null), professional: (id: string) => (id === "p1" ? "a2" : null) };
    expect(billingAgencyId("agency", "a7", lookup)).toBe("a7");
    expect(billingAgencyId("client", "c1", lookup)).toBe("a1");
    expect(billingAgencyId("professional", "p1", lookup)).toBe("a2");
    expect(billingAgencyId("professional", "p9", lookup)).toBeNull();
    expect(billingAgencyId(null, "x", lookup)).toBeNull();
  });
});

describe("professional visibility", () => {
  const own = { agencyId: "a1" };
  const marketplace = { agencyId: null };
  const other = { agencyId: "a2" };
  it("an agency sees its own, the open marketplace and whoever worked with it", () => {
    const scope = agencyScope("a1");
    expect(professionalVisibleTo(scope, own, false)).toBe(true);
    expect(professionalVisibleTo(scope, marketplace, false)).toBe(true);
    expect(professionalVisibleTo(scope, other, false)).toBe(false);
    expect(professionalVisibleTo(scope, other, true)).toBe(true);
    expect(professionalVisibleTo(ALL_AGENCIES, other, false)).toBe(true);
  });

  it("only the owning agency edits a professional", () => {
    const scope = agencyScope("a1");
    expect(professionalEditableBy(scope, own)).toBe(true);
    expect(professionalEditableBy(scope, marketplace)).toBe(false);
    expect(professionalEditableBy(scope, other)).toBe(false);
    expect(professionalEditableBy(ALL_AGENCIES, marketplace)).toBe(true);
  });
});

describe("agency slugs", () => {
  it("normalises names", () => {
    expect(slugBase("Estúdio Sol & Cia")).toBe("estudio-sol-cia");
    expect(slugBase("   ")).toBe("");
  });

  it("picks the first free, non-reserved slug", () => {
    const taken = new Set(["estudio-sol", "estudio-sol-2"]);
    expect(uniqueSlug("Estúdio Sol", (s) => taken.has(s))).toBe("estudio-sol-3");
    expect(uniqueSlug("Admin", () => false)).toBe("admin-2");
    expect(uniqueSlug("Agência", () => false)).toBe("agencia-2");
    expect(uniqueSlug("!!", () => false)).toBe("agencia-2");
    expect(uniqueSlug("Bem Legal", () => false)).toBe("bem-legal");
    const long = uniqueSlug("x".repeat(80), (s) => s === "x".repeat(40));
    expect(long.length).toBeLessThanOrEqual(40);
    expect(long.endsWith("-2")).toBe(true);
  });
});
