import { beforeEach, describe, expect, it } from "vitest";
import path from "path";
import os from "os";
import fs from "fs";

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "marqa-costs-"));
delete (globalThis as { __agencyhubDb?: unknown }).__agencyhubDb;
process.env.AI_DAILY_SPEND_LIMIT_USD = "20";
process.env.AI_MOCK = "1";
const { db } = await import("../../lib/db");
const spend = await import("../../lib/ai-spend");
const { computeMargins, effectiveAccountCap, usdBrlRate } = await import("../../lib/ai-margin");
const { generateStructured, GenerationError, recordMockCall } = await import("../../lib/claude");

const schema = { type: "object", additionalProperties: false, required: ["ok"], properties: { ok: { type: "boolean" } } };

describe("margin per account (pure)", () => {
  it("subtracts AI cost converted to BRL from confirmed revenue, worst first", () => {
    const rows = computeMargins(
      [
        { accountType: "agency", accountId: "a1", revenueBrl: 997 },
        { accountType: "client", accountId: "c1", revenueBrl: 0 },
      ],
      [
        { accountType: "agency", accountId: "a1", costUsd: 10, calls: 40 },
        { accountType: "client", accountId: "c1", costUsd: 2, calls: 9 },
        { accountType: null, accountId: null, costUsd: 5, calls: 1 },
      ],
      5
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ accountId: "c1", costBrl: 10, marginBrl: -10, marginPct: null, calls: 9 });
    expect(rows[1]).toMatchObject({ accountId: "a1", revenueBrl: 997, costBrl: 50, marginBrl: 947, marginPct: 95 });
  });

  it("reads the exchange rate from the env with a safe default", () => {
    expect(usdBrlRate("5.1")).toBe(5.1);
    expect(usdBrlRate("abc")).toBe(5.5);
    expect(usdBrlRate(undefined)).toBe(5.5);
  });

  it("an admin override replaces the tier cap, null keeps it", () => {
    expect(effectiveAccountCap(1, null)).toBe(1);
    expect(effectiveAccountCap(1, 0.5)).toBe(0.5);
    expect(effectiveAccountCap(Number.POSITIVE_INFINITY, 3)).toBe(3);
    expect(effectiveAccountCap(1, -2)).toBe(1);
  });
});

describe("AI ledger and caps with AI_MOCK", () => {
  beforeEach(() => {
    db.prepare("DELETE FROM ai_usage").run();
    db.prepare("DELETE FROM app_settings WHERE key LIKE 'ai_cap_override:%'").run();
  });

  const ctx = { action: "carousel", accountType: "client" as const, accountId: "brand-1", tier: "paid" as const };

  it("a mocked generation writes one ledger row with the action and account", async () => {
    await spend.runWithAiContext(ctx, () => generateStructured({ system: "s", prompt: "p", schema, tier: "standard" }));
    const rows = db.prepare("SELECT * FROM ai_usage").all() as { action: string; accountId: string; costUsd: number; model: string }[];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ action: "carousel", accountId: "brand-1" });
    expect(rows[0].costUsd).toBeGreaterThan(0);
  });

  it("a tiny admin cap blocks the second call before anything is recorded", async () => {
    spend.setAccountCapOverride("client", "brand-1", 0.0001);
    expect(spend.accountCapOverride("client", "brand-1")).toBe(0.0001);
    await spend.runWithAiContext(ctx, async () => recordMockCall({ tier: "standard" }));
    let blocked: unknown = null;
    try {
      await spend.runWithAiContext(ctx, () => generateStructured({ system: "s", prompt: "p", schema, tier: "standard" }));
    } catch (error) {
      blocked = error;
    }
    expect(blocked).toBeInstanceOf(GenerationError);
    expect((blocked as InstanceType<typeof GenerationError>).status).toBe(429);
    expect((db.prepare("SELECT COUNT(*) AS c FROM ai_usage").get() as { c: number }).c).toBe(1);
    spend.setAccountCapOverride("client", "brand-1", null);
    expect(spend.accountCapOverride("client", "brand-1")).toBeNull();
    await spend.runWithAiContext(ctx, async () => recordMockCall({ tier: "standard" }));
    expect((db.prepare("SELECT COUNT(*) AS c FROM ai_usage").get() as { c: number }).c).toBe(2);
  });

  it("groups cost by action and model", async () => {
    await spend.runWithAiContext(ctx, async () => recordMockCall({ model: "claude-haiku-4-5" }));
    await spend.runWithAiContext({ ...ctx, action: "ai_radar" }, async () => recordMockCall({ tier: "standard", webSearches: 3 }));
    const rows = spend.usageByActionModel(30);
    expect(rows.map((r) => r.action).sort()).toEqual(["ai_radar", "carousel"]);
    expect(rows.find((r) => r.action === "ai_radar")!.webSearches).toBe(3);
    expect(rows.find((r) => r.action === "carousel")!.model).toBe("claude-haiku-4-5");
  });
});
