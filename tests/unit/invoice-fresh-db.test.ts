import { describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

// Banco novo: a fatura lê clients.monthlyFee, que nasce no módulo de horas &
// margem. Importar SÓ o módulo de faturas precisa funcionar assim mesmo.
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "marqa-invoice-"));
delete (globalThis as { __agencyhubDb?: unknown }).__agencyhubDb;
const { db, createClient } = await import("../../lib/db");
const agencies = await import("../../lib/agencies");
const invoices = await import("../../lib/invoices-db");

const agencyId = agencies.createAgency({ name: "Agência Fatura", ownerUserId: null }).id;
const client = createClient(
  {
    name: "Marca Fatura",
    industry: "",
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
    source: "agency",
    country: "Brasil",
    selfServe: false,
  },
  agencyId
);

describe("invoices on a fresh database", () => {
  it("has the monthlyFee column and creates the first draft", () => {
    const columns = (db.prepare("PRAGMA table_info(clients)").all() as { name: string }[]).map((c) => c.name);
    expect(columns).toContain("monthlyFee");
    db.prepare("UPDATE clients SET monthlyFee = 1500 WHERE id = ?").run(client.id);
    const month = new Date().toISOString().slice(0, 7);
    const invoice = invoices.createDraftInvoice(client.id, month);
    expect("error" in invoice).toBe(false);
    expect(invoices.runMonthlyInvoiceDrafts).toBeTypeOf("function");
  });
});
