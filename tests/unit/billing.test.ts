import { beforeEach, describe, expect, it } from "vitest";
import path from "path";
import os from "os";
import fs from "fs";

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "marqa-billing-"));
delete (globalThis as { __agencyhubDb?: unknown }).__agencyhubDb;
delete process.env.BILLING_ENFORCED;
const { db } = await import("../../lib/db");
const billing = await import("../../lib/billing-db");

let seq = 0;
const acct = () => ({ accountType: "client" as const, accountId: `c-${++seq}` });

describe("billing lifecycle", () => {
  beforeEach(() => {
    billing.setEnforced(false);
  });

  it("grants the free-tier quota once at signup and never a paid plan", () => {
    const a = acct();
    const wallet = billing.startAccount(a.accountType, a.accountId);
    expect(wallet.coins).toBe(40);
    expect(billing.getSubscription(a.accountType, a.accountId).planId).toBe("client_free");
    // chamar de novo não duplica a cota
    expect(billing.startAccount(a.accountType, a.accountId).coins).toBe(40);
    // agência começa no grátis, não no Starter
    expect(billing.getSubscription("agency", `ag-${seq}`).planId).toBe("agency_free");
  });

  it("only switches to free plans; paid plans need payment", () => {
    const a = acct();
    const paid = billing.switchToFreePlan({ ...a, planId: "client_pro" });
    expect(paid).toMatchObject({ ok: false, status: 402 });
    const other = billing.switchToFreePlan({ ...a, planId: "agency_free" });
    expect(other).toMatchObject({ ok: false, status: 400 });
    expect(billing.switchToFreePlan({ ...a, planId: "client_free" }).ok).toBe(true);
  });

  it("reserves coins and refunds them on failure; enforcement blocks an empty wallet", () => {
    const a = acct();
    billing.startAccount(a.accountType, a.accountId); // 40
    const charge = billing.chargeUsage({ ...a, action: "strategy_analysis" }); // 10
    expect(charge).toMatchObject({ ok: true, charged: 10 });
    expect(billing.getWallet(a.accountType, a.accountId).coins).toBe(30);
    billing.refundUsage(a, "strategy_analysis", charge);
    expect(billing.getWallet(a.accountType, a.accountId).coins).toBe(40);

    billing.setEnforced(true);
    for (let i = 0; i < 4; i++) expect(billing.chargeUsage({ ...a, action: "strategy_analysis" }).ok).toBe(true);
    const blocked = billing.chargeUsage({ ...a, action: "strategy_analysis" });
    expect(blocked.ok).toBe(false);
    expect(billing.getWallet(a.accountType, a.accountId).coins).toBe(0);
  });

  it("uses plan coins before purchased coins", () => {
    const a = acct();
    billing.startAccount(a.accountType, a.accountId);
    billing.addCoins(a.accountType, a.accountId, 100, "compra", "coin_purchase", 29);
    billing.chargeUsage({ ...a, action: "strategy_analysis", units: 5 }); // 50: 40 do plano + 10 comprados
    const w = billing.getWallet(a.accountType, a.accountId);
    expect(w.planCoins).toBe(0);
    expect(w.purchasedCoins).toBe(90);
  });

  it("credits an approved Mercado Pago payment exactly once, rejects underpayment and reverses refunds", () => {
    const a = acct();
    const ref = `coins|${a.accountType}|${a.accountId}|pack_100`;
    expect(billing.applyMpPayment({ id: "901", status: "approved", externalReference: ref, amount: 29 })).toBe("credited");
    expect(billing.applyMpPayment({ id: "901", status: "approved", externalReference: ref, amount: 29 })).toBe("already_credited");
    expect(billing.getWallet(a.accountType, a.accountId).purchasedCoins).toBe(100);
    expect(billing.applyMpPayment({ id: "902", status: "approved", externalReference: ref, amount: 1 })).toBe("invalid");
    expect(billing.applyMpPayment({ id: "903", status: "pending", externalReference: ref, amount: 29 })).toBe("ignored");
    expect(billing.applyMpPayment({ id: "901", status: "refunded", externalReference: ref, amount: 29 })).toBe("refunded");
    expect(billing.getWallet(a.accountType, a.accountId).purchasedCoins).toBe(0);
    expect(billing.getPaymentRow("901")?.status).toBe("refunded");
    expect(billing.parsePaymentRef("plan|client|x|client_free|monthly")).toBeNull();
    expect(billing.parsePaymentRef("coins|admin|x|pack_100")).toBeNull();
  });

  it("activates a paid plan from payment, refills monthly and expires back to free", () => {
    const a = acct();
    const ref = `plan|${a.accountType}|${a.accountId}|client_starter|quarterly`;
    const price = 262; // 97 * 3 * 0.9
    expect(billing.applyMpPayment({ id: "1001", status: "approved", externalReference: ref, amount: price })).toBe("credited");
    const sub = billing.getSubscription(a.accountType, a.accountId);
    expect(sub.planId).toBe("client_starter");
    expect(billing.getWallet(a.accountType, a.accountId).planCoins).toBe(400);

    billing.chargeUsage({ ...a, action: "strategy_analysis", units: 30 }); // gasta 300
    const inAMonth = new Date(new Date(sub.lastRefillAt!).getTime() + 32 * 86_400_000);
    billing.refreshAccount(a.accountType, a.accountId, inAMonth);
    expect(billing.getWallet(a.accountType, a.accountId).planCoins).toBe(400); // recarga, não acumula

    const afterExpiry = new Date(new Date(sub.renewsAt).getTime() + 86_400_000);
    billing.refreshAccount(a.accountType, a.accountId, afterExpiry);
    const row = db.prepare("SELECT planId FROM subscriptions WHERE accountType = ? AND accountId = ?").get(a.accountType, a.accountId) as { planId: string };
    expect(row.planId).toBe("client_free");
  });

  it("lets the admin grant a plan and plans are extended when paid again", () => {
    const a = acct();
    const granted = billing.adminSetPlan({ ...a, planId: "client_pro", months: 2 });
    expect(granted.planId).toBe("client_pro");
    const again = billing.applyMpPayment({
      id: "1101",
      status: "approved",
      externalReference: `plan|${a.accountType}|${a.accountId}|client_pro|monthly`,
      amount: 297,
    });
    expect(again).toBe("credited");
    const extended = billing.getSubscription(a.accountType, a.accountId);
    expect(new Date(extended.renewsAt).getTime()).toBeGreaterThan(new Date(granted.renewsAt).getTime());
  });

  it("unlimited plans skip coins; admin revenue counts only confirmed money", () => {
    billing.adminSetPlan({ accountType: "agency", accountId: "agency-x", planId: "agency_scale", months: 1 });
    const charge = billing.chargeUsage({ accountType: "agency", accountId: "agency-x", action: "strategy_analysis" });
    expect(charge).toMatchObject({ ok: true, charged: 0 });
    const revenue = billing.platformRevenue();
    expect(revenue.byKind.grant ?? 0).toBe(0);
  });

  it("addMonthsIso keeps month ends sane", () => {
    expect(billing.addMonthsIso("2026-01-31T10:00:00.000Z", 1).slice(0, 10)).toBe("2026-02-28");
    expect(billing.addMonthsIso("2026-11-15T10:00:00.000Z", 3).slice(0, 10)).toBe("2027-02-15");
  });
});

describe("read-only views", () => {
  it("project the free plan and refills without writing", () => {
    const accountId = "view-only-1";
    const count = () => (db.prepare("SELECT COUNT(*) AS c FROM subscriptions WHERE accountId = ?").get(accountId) as { c: number }).c;
    const summary = billing.billingSummary("client", accountId);
    expect(summary.plan?.id).toBe("client_free");
    expect(summary.wallet.coins).toBe(40);
    expect(count()).toBe(0);
    billing.startAccount("client", accountId);
    expect(count()).toBe(1);
    const later = billing.viewAccount("client", accountId, new Date(Date.now() + 40 * 86_400_000));
    expect(later.wallet.planCoins).toBe(40);
  });

  it("the scheduler refresh covers accounts without a subscription row", () => {
    const n = billing.refreshAllAccounts();
    expect(n).toBeGreaterThan(0);
    const agency = db.prepare("SELECT planId FROM subscriptions WHERE accountType = 'agency' AND accountId = 'agency'").get() as { planId: string };
    expect(agency.planId).toBe("agency_free");
  });
});
