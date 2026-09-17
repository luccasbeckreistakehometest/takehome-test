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

const brand = (name: string, source: "self" | "agency") =>
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
  });

describe("LGPD self-service", () => {
  it("exports the account without secrets and deletes a self-signup brand with its data", async () => {
    const client = brand("Café Próprio", "self");
    const user = await auth.createUser({
      password: "senha-forte-1",
      role: "client",
      refId: client.id,
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
    const user = await auth.createUser({ password: "senha-forte-1", role: "client", refId: client.id, name: client.name });
    expect(deleteAccount(user.id)).toEqual({ ok: true, removedWorkspace: false });
    expect(getClient(client.id)).not.toBeNull();
  });

  it("refuses to delete the last admin", async () => {
    const admin = await auth.createUser({ password: "senha-forte-1", role: "admin", refId: null, name: "Admin" });
    expect(deleteAccount(admin.id)).toMatchObject({ ok: false, status: 409 });
  });
});
