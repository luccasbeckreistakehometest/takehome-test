import { describe, expect, it } from "vitest";
import path from "path";
import os from "os";
import fs from "fs";

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "marqa-lgpd-"));
delete (globalThis as { __agencyhubDb?: unknown }).__agencyhubDb;
const { db, createClient, createGeneration, getClient } = await import("../../lib/db");
const auth = await import("../../lib/auth");
const billing = await import("../../lib/billing-db");
const market = await import("../../lib/marketplace-db");
const { exportAccountData, deleteAccount } = await import("../../lib/account-data");
const { createInboxMessage, listInbox } = await import("../../lib/contact-db");
const agencies = await import("../../lib/agencies");
const { HOUSE_AGENCY_ID } = await import("../../lib/tenancy-rules");

const brand = (name: string, source: "self" | "agency", agencyId: string = HOUSE_AGENCY_ID) =>
  createClient({
    name,
    industry: "café",
    description: "",
    audience: "",
    tone: "",
    goals: "",
    budget: "",
    channels: [],
    differentials: "",
    competitors: "",
    brandColors: "",
    website: "",
    instagram: "",
    notes: "",
    capabilities: "",
    language: "pt-BR",
    source,
    country: "Brasil",
    selfServe: source === "self",
  }, agencyId);

describe("LGPD self-service", () => {
  it("exports the account without secrets and deletes a self-signup brand with its data", async () => {
    const client = brand("Café Próprio", "self");
    const user = await auth.createUser({
      password: "senha-forte-1",
      role: "client",
      refId: client.id,
      agencyId: HOUSE_AGENCY_ID,
      name: client.name,
      brandSource: "platform",
      email: "cafe@example.com",
      consentVersion: "2026-09-17",
    });
    createGeneration({ clientId: client.id, type: "strategy_analysis", title: "Estratégia", params: {}, content: "{}" });
    market.createProject({ clientId: client.id, title: "Fotos", brief: "", skillsNeeded: [], location: "", budget: "", deadline: "", mode: "internal" });
    billing.addCoins("client", client.id, 100, "compra", "coin_purchase", 29);
    createInboxMessage({ kind: "contact", name: "Ana", email: "cafe@example.com", message: "Quero meus dados", userId: user.id });

    const data = exportAccountData(user.id) as Record<string, unknown>;
    expect(JSON.stringify(data)).not.toContain("passwordHash\":\"");
    expect((data.account as { email: string }).email).toBe("cafe@example.com");
    expect(Object.keys(data.brandData as object)).toEqual(expect.arrayContaining(["generations", "projects"]));

    const outcome = deleteAccount(user.id);
    expect(outcome).toEqual({ ok: true, removedWorkspace: true });
    expect(getClient(client.id)).toBeNull();
    expect(auth.getUserById(user.id)).toBeNull();
    const gens = db.prepare("SELECT COUNT(*) AS c FROM generations WHERE clientId = ?").get(client.id) as { c: number };
    expect(gens.c).toBe(0);
    // lançamento financeiro fica, sem vínculo
    const tx = db.prepare("SELECT accountId FROM billing_transactions WHERE amount = 29").get() as { accountId: string };
    expect(tx.accountId).toMatch(/^removido-/);
    expect(listInbox().find((m) => m.message === "Quero meus dados")?.email).toBe("[removido]");
  });

  it("keeps an agency-managed brand's work when its login is deleted", async () => {
    const client = brand("Marca da Agência", "agency");
    const user = await auth.createUser({ password: "senha-forte-1", role: "client", refId: client.id, agencyId: HOUSE_AGENCY_ID, name: client.name });
    expect(deleteAccount(user.id)).toEqual({ ok: true, removedWorkspace: false });
    expect(getClient(client.id)).not.toBeNull();
  });

  it("an invited brand (legacy source 'self') deleting its login keeps the agency's records", async () => {
    // cadastros por convite antigos gravavam source "self"; o login diz brandSource "agency"
    const client = brand("Marca Convidada", "self");
    market.createProject({ clientId: client.id, title: "Campanha", brief: "", skillsNeeded: [], location: "", budget: "", deadline: "" });
    const user = await auth.createUser({
      password: "senha-forte-1",
      role: "client",
      refId: client.id,
      agencyId: HOUSE_AGENCY_ID,
      name: client.name,
      brandSource: "agency",
      email: "convidada@example.com",
    });
    expect(deleteAccount(user.id)).toEqual({ ok: true, removedWorkspace: false });
    expect(getClient(client.id)).not.toBeNull();
    expect((db.prepare("SELECT COUNT(*) AS c FROM projects WHERE clientId = ?").get(client.id) as { c: number }).c).toBe(1);
  });

  it("a freelancer moved to the marketplace keeps its plan and coins when the agency is deleted", async () => {
    const agency = agencies.createAgency({ name: "Estúdio Fecha", ownerUserId: null });
    const owner = await auth.createUser({ password: "senha-forte-1", role: "agency", refId: null, agencyId: agency.id, name: "Fecha" });
    agencies.setAgencyOwner(agency.id, owner.id);
    const pro = market.createProfessional(
      { name: "Foto Livre", role: "fotografo", email: "", phone: "", location: "SP", skills: [], specialties: "", marketFocus: "", bio: "", portfolio: [], priceRange: "", availability: "", employmentType: "freelancer" },
      agency.id
    );
    await auth.createUser({ password: "senha-forte-1", role: "professional", refId: pro.id, agencyId: agency.id, name: "Foto Livre" });
    billing.adminSetPlan({ accountType: "professional", accountId: pro.id, planId: "pro_plus", months: 1 });
    billing.addCoins("professional", pro.id, 50, "compra", "coin_purchase", 19);

    expect(deleteAccount(owner.id)).toEqual({ ok: true, removedWorkspace: true });
    expect(market.getProfessional(pro.id)?.agencyId ?? null).toBeNull();
    expect(billing.getSubscription("professional", pro.id).planId).toBe("pro_plus");
    expect(billing.getWallet("professional", pro.id).purchasedCoins).toBe(50);
  });

  it("an agency owner who leaves alone takes the whole workspace (never the house)", async () => {
    const agency = agencies.createAgency({ name: "Estúdio Solo", ownerUserId: null });
    const owner = await auth.createUser({ password: "senha-forte-1", role: "agency", refId: null, agencyId: agency.id, name: "Solo" });
    agencies.setAgencyOwner(agency.id, owner.id);
    const client = brand("Cliente do Solo", "agency", agency.id);
    const login = await auth.createUser({ password: "senha-forte-1", role: "client", refId: client.id, agencyId: agency.id, name: client.name });
    market.createProject({ clientId: client.id, title: "Logo", brief: "", skillsNeeded: [], location: "", budget: "", deadline: "" });
    const houseClient = brand("Cliente da Casa", "agency");

    expect(deleteAccount(owner.id)).toEqual({ ok: true, removedWorkspace: true });
    expect(agencies.getAgency(agency.id)).toBeNull();
    expect(getClient(client.id)).toBeNull();
    expect(auth.getUserById(login.id)).toBeNull();
    expect((db.prepare("SELECT COUNT(*) AS c FROM projects WHERE agencyId = ?").get(agency.id) as { c: number }).c).toBe(0);
    expect(getClient(houseClient.id)).not.toBeNull();
  });

  it("a team member leaving keeps the agency and hands over ownership", async () => {
    const agency = agencies.createAgency({ name: "Estúdio Dupla", ownerUserId: null });
    const owner = await auth.createUser({ password: "senha-forte-1", role: "agency", refId: null, agencyId: agency.id, name: "Dona" });
    const mate = await auth.createUser({ password: "senha-forte-1", role: "agency", refId: null, agencyId: agency.id, name: "Sócio" });
    agencies.setAgencyOwner(agency.id, owner.id);
    const client = brand("Cliente da Dupla", "agency", agency.id);
    expect(deleteAccount(owner.id)).toEqual({ ok: true, removedWorkspace: false });
    expect(agencies.getAgency(agency.id)?.ownerUserId).toBe(mate.id);
    expect(getClient(client.id)).not.toBeNull();
  });

  it("refuses to delete the last admin", async () => {
    const admin = await auth.createUser({ password: "senha-forte-1", role: "admin", refId: null, agencyId: null, name: "Admin" });
    expect(deleteAccount(admin.id)).toMatchObject({ ok: false, status: 409 });
  });
});
