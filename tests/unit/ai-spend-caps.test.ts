import { beforeEach, describe, expect, it } from "vitest";
import path from "path";
import os from "os";
import fs from "fs";

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "marqa-spend-"));
delete (globalThis as { __agencyhubDb?: unknown }).__agencyhubDb;
process.env.AI_DAILY_SPEND_LIMIT_USD = "20";
delete process.env.AI_FREE_DAILY_SPEND_LIMIT_USD;
delete process.env.AI_FREE_ACCOUNT_DAILY_SPEND_LIMIT_USD;
delete process.env.AI_PAID_ACCOUNT_DAILY_SPEND_LIMIT_USD;
const { db } = await import("../../lib/db");
const spend = await import("../../lib/ai-spend");
const billing = await import("../../lib/billing-db");
const { assertAiAvailable, GenerationError } = await import("../../lib/claude");

type Ctx = Parameters<typeof spend.runWithAiContext>[0];
const spendAs = (ctx: Ctx, usd: number) => spend.runWithAiContext(ctx, async () => spend.recordExternalSpend("tts_elevenlabs", 100, usd));

let seq = 0;
const freeBrand = (): Ctx => ({ action: "tts", accountType: "client", accountId: `free-${++seq}` });

describe("daily AI spend caps", () => {
  beforeEach(() => {
    db.prepare("DELETE FROM ai_usage").run();
  });

  it("stops one free account at its own cap without touching anyone else", async () => {
    const a = freeBrand();
    const b = freeBrand();
    expect(spend.aiBudgetBlock(a)).toBeNull();
    await spendAs(a, 1.01);
    expect(spend.aiBudgetBlock(a)).toBe("account");
    expect(spend.aiBudgetBlock(b)).toBeNull();
    expect(() => assertAiAvailable(a)).toThrow(GenerationError);
    try {
      assertAiAvailable(a);
    } catch (error) {
      expect((error as InstanceType<typeof GenerationError>).status).toBe(429);
    }
    // usage row carries the tier
    const row = db.prepare("SELECT tier FROM ai_usage LIMIT 1").get() as { tier: string };
    expect(row.tier).toBe("free");
  });

  it("free accounts share a pool (25% of the global cap) that never pauses paid or house accounts", async () => {
    for (let i = 0; i < 6; i++) await spendAs(freeBrand(), 0.9); // US$5,40 > US$5
    const newcomer = freeBrand();
    expect(spend.aiBudgetBlock(newcomer)).toBe("free_pool");

    const paid: Ctx = { action: "report", accountType: "client", accountId: `paid-${++seq}` };
    billing.adminSetPlan({ accountType: "client", accountId: paid.accountId!, planId: "client_starter", months: 1 });
    expect(spend.aiBudgetBlock(paid)).toBeNull();
    const house: Ctx = { action: "report", accountType: "agency", accountId: "agency" };
    expect(spend.aiBudgetBlock(house)).toBeNull();
    // admin/sistema: só o global
    expect(spend.aiBudgetBlock({ action: "x" })).toBeNull();
  });

  it("a paid account stops at half of the global cap; the global cap stops everyone", async () => {
    const paid: Ctx = { action: "report", accountType: "agency", accountId: `ag-paid-${++seq}` };
    billing.adminSetPlan({ accountType: "agency", accountId: paid.accountId!, planId: "agency_growth", months: 1 });
    await spendAs(paid, 9.99);
    expect(spend.aiBudgetBlock(paid)).toBeNull();
    await spendAs(paid, 0.02);
    expect(spend.aiBudgetBlock(paid)).toBe("account");

    const house: Ctx = { action: "report", accountType: "agency", accountId: "agency" };
    await spendAs(house, 10);
    expect(spend.aiBudgetBlock(house)).toBe("global");
    expect(spend.aiBudgetBlock({ action: "x" })).toBe("global");
    expect(spend.aiBudgetExceeded()).toBe(true);
  });
});
