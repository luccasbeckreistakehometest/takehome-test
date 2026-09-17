import { describe, expect, it } from "vitest";
import path from "path";
import os from "os";
import fs from "fs";

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "marqa-moderation-"));
delete (globalThis as { __agencyhubDb?: unknown }).__agencyhubDb;
await import("../../lib/db");
const agencies = await import("../../lib/agencies");
const billing = await import("../../lib/billing-db");
const { HOUSE_AGENCY_ID } = await import("../../lib/tenancy-rules");

describe("public page moderation", () => {
  it("new agencies stay out of the sitemap until the admin allows it or they pay", () => {
    const fresh = agencies.createAgency({ name: "Estúdio Novo Probe", ownerUserId: null });
    expect(agencies.saveAgencyPageConfig(fresh.id, { published: true }).ok).toBe(true);
    expect(agencies.saveAgencyPageConfig(HOUSE_AGENCY_ID, { published: true }).ok).toBe(true);
    expect(agencies.agencyPageIndexable(HOUSE_AGENCY_ID)).toBe(true);
    expect(agencies.agencyPageIndexable(fresh.id)).toBe(false);
    expect(agencies.listPublishedAgencySlugs()).not.toContain(fresh.slug);

    agencies.setAgencyPageIndexable(fresh.id, true);
    expect(agencies.listPublishedAgencySlugs()).toContain(fresh.slug);
    agencies.setAgencyPageIndexable(fresh.id, false);
    expect(agencies.agencyPageIndexable(fresh.id)).toBe(false);

    const paying = agencies.createAgency({ name: "Estúdio Pagante Probe", ownerUserId: null });
    agencies.saveAgencyPageConfig(paying.id, { published: true });
    billing.adminSetPlan({ accountType: "agency", accountId: paying.id, planId: "agency_starter", months: 1 });
    expect(agencies.listPublishedAgencySlugs()).toContain(paying.slug);

    // despublicar tira de vez
    agencies.saveAgencyPageConfig(paying.id, { published: false });
    expect(agencies.listPublishedAgencySlugs()).not.toContain(paying.slug);
  });
});
