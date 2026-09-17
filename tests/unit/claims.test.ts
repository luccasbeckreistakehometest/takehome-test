import { describe, expect, it } from "vitest";
import path from "path";
import os from "os";
import fs from "fs";

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "marqa-claims-"));
delete (globalThis as { __agencyhubDb?: unknown }).__agencyhubDb;
const { db } = await import("../../lib/db");
const invites = await import("../../lib/invites-db");
const proposals = await import("../../lib/proposals-db");
const { HOUSE_AGENCY_ID } = await import("../../lib/tenancy-rules");

describe("single-use claims", () => {
  it("an invite is claimed by one signup at a time and never after it is used", () => {
    const invite = invites.createInvite({ agencyId: HOUSE_AGENCY_ID, role: "agency", expiresInDays: 7 });
    expect(invites.claimInvite(invite.token)).toBe(true);
    expect(invites.claimInvite(invite.token)).toBe(false);
    invites.releaseInvite(invite.token);
    expect(invites.claimInvite(invite.token)).toBe(true);
    invites.consumeInvite(invite.token, "user-1");
    invites.releaseInvite(invite.token);
    expect(invites.claimInvite(invite.token)).toBe(false);

    const expired = invites.createInvite({ agencyId: HOUSE_AGENCY_ID, role: "client", expiresInDays: 1 });
    db.prepare("UPDATE invites SET expiresAt = ? WHERE token = ?").run("2020-01-01T00:00:00.000Z", expired.token);
    expect(invites.claimInvite(expired.token)).toBe(false);

    // reserva abandonada expira
    const stuck = invites.createInvite({ agencyId: HOUSE_AGENCY_ID, role: "client" });
    db.prepare("UPDATE invites SET claimedAt = ? WHERE token = ?").run(new Date(Date.now() - 5 * 60_000).toISOString(), stuck.token);
    expect(invites.claimInvite(stuck.token)).toBe(true);
  });

  it("concurrent proposal acceptances create exactly one brand and one login", async () => {
    const proposal = proposals.createProposal({
      agencyId: HOUSE_AGENCY_ID,
      prospectId: null,
      prospectName: "Race Prospect",
      segment: "café",
      lang: "pt-BR",
      currency: "BRL",
      content: {
        headline: "",
        pitch: "",
        painPoints: [],
        scope: [],
        packages: [{ name: "Essencial", price: 1000, period: "mês", items: [], recommended: true }],
        timeline: [],
        nextSteps: [],
        validityNote: "",
      },
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    });
    const input = { token: proposal.token, packageName: "Essencial", name: "Ana", contact: "ana@example.test" };
    const results = await Promise.all([proposals.acceptProposal(input), proposals.acceptProposal(input), proposals.acceptProposal(input)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok).every((r) => !r.ok && r.reason === "accepted")).toBe(true);
    const brands = db.prepare("SELECT COUNT(*) AS c FROM clients WHERE name = 'Race Prospect'").get() as { c: number };
    expect(brands.c).toBe(1);
    const logins = db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'client' AND name = 'Race Prospect'").get() as { c: number };
    expect(logins.c).toBe(1);
    // a API pública não expõe a reserva
    expect(proposals.getProposalByToken(proposal.token)).not.toHaveProperty("claimedAt");
  });
});
