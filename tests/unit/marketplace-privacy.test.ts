import { describe, expect, it } from "vitest";
import {
  assignedProjectForProfessional,
  professionalForViewer,
  toOpportunity,
} from "../../lib/marketplace-privacy";
import type { Professional, Project } from "../../lib/marketplace-types";

const project: Project = {
  id: "p1",
  agencyId: "b",
  clientId: "client-of-b",
  professionalId: "pro-9",
  title: "Fotos do cardápio",
  brief: "Sessão de fotos",
  skillsNeeded: ["fotografia"],
  location: "SP",
  budget: "R$ 800",
  deadline: "2026-10-01",
  status: "open",
  escrow: "none" as Project["escrow"],
  matchResult: '{"ranking":["pro-1","pro-2"]}',
  sketch: '{"svg":"<svg/>"}',
  mode: "marketplace",
  createdAt: "2026-09-17T00:00:00.000Z",
};

const pro = (agencyId: string | null): Professional & { hourlyCost: number } => ({
  id: "pro-1",
  agencyId,
  name: "Ana Foto",
  role: "fotografo",
  email: "ana@example.test",
  phone: "11999990000",
  location: "SP",
  skills: [],
  specialties: "",
  marketFocus: "",
  bio: "",
  portfolio: [],
  priceRange: "",
  availability: "",
  employmentType: "freelancer",
  createdAt: "2026-09-17T00:00:00.000Z",
  hourlyCost: 120,
});

describe("marketplace privacy", () => {
  it("opportunities carry only what a freelancer needs to apply", () => {
    const o = toOpportunity(project, "Agência B") as unknown as Record<string, unknown>;
    expect(Object.keys(o).sort()).toEqual(
      ["agencyName", "brief", "budget", "createdAt", "deadline", "id", "location", "mode", "skillsNeeded", "status", "title"].sort()
    );
    for (const hidden of ["matchResult", "sketch", "clientId", "professionalId", "agencyId", "escrow"]) {
      expect(o).not.toHaveProperty(hidden);
    }
    expect(assignedProjectForProfessional(project).matchResult).toBe("");
  });

  it("a foreign agency sees no contact or cost until the freelancer applies; the owner sees everything", () => {
    const marketplace = pro(null);
    const foreign = professionalForViewer(marketplace, { role: "agency", agencyId: "b" }, false) as Record<string, unknown>;
    expect(foreign.email).toBe("");
    expect(foreign.phone).toBe("");
    expect(foreign).not.toHaveProperty("hourlyCost");

    const applied = professionalForViewer(marketplace, { role: "agency", agencyId: "b" }, true) as Record<string, unknown>;
    expect(applied.email).toBe("ana@example.test");
    expect(applied).not.toHaveProperty("hourlyCost");

    const owned = pro("a");
    expect(professionalForViewer(owned, { role: "agency", agencyId: "a" }, false)).toEqual(owned);
    expect(professionalForViewer(owned, { role: "admin" }, false)).toEqual(owned);
    expect(professionalForViewer(owned, { role: "professional", refId: "pro-1" }, false)).toEqual(owned);
    // marca vendo o escalado: contato sim, custo nunca
    const brand = professionalForViewer(owned, { role: "client", agencyId: "a" }, true) as Record<string, unknown>;
    expect(brand.email).toBe("ana@example.test");
    expect(brand).not.toHaveProperty("hourlyCost");
    // original intacto
    expect(marketplace.email).toBe("ana@example.test");
    expect(marketplace.hourlyCost).toBe(120);
  });
});
