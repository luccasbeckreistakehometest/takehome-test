import { describe, expect, it } from "vitest";
import path from "path";
import os from "os";
import fs from "fs";

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "marqa-sub-"));
delete (globalThis as { __agencyhubDb?: unknown }).__agencyhubDb;
delete process.env.BILLING_ENFORCED;
process.env.MP_TRANSPORT = "file";
process.env.APP_URL = "http://localhost:3999";
await import("../../lib/db");
const billing = await import("../../lib/billing-db");
const rules = await import("../../lib/subscription-rules");
const mp = await import("../../lib/mercadopago");

const DAY = 86_400_000;
let seq = 0;
const agency = () => ({ accountType: "agency" as const, accountId: `ag-sub-${++seq}` });

describe("subscription rules (pure)", () => {
  it("round-trips the external reference and rejects junk", () => {
    const ref = { accountType: "agency" as const, accountId: "ag1", planId: "agency_growth", period: "monthly" as const };
    expect(rules.parseSubRef(rules.subRef(ref))).toEqual(ref);
    expect(rules.parseSubRef("plan|agency|ag1|agency_growth|monthly")).toBeNull();
    expect(rules.parseSubRef("sub|robot|ag1|x|monthly")).toBeNull();
    expect(rules.parseSubRef("sub|agency|ag1|x|weekly")).toBeNull();
  });

  it("extends from the current end while it is valid or in grace, else from now", () => {
    const now = new Date("2026-09-17T12:00:00.000Z");
    expect(rules.nextPeriodEnd(null, now, 1)).toBe("2026-10-17T12:00:00.000Z");
    expect(rules.nextPeriodEnd("2026-09-20T00:00:00.000Z", now, 1)).toBe("2026-10-20T00:00:00.000Z");
    expect(rules.nextPeriodEnd("2026-09-15T00:00:00.000Z", now, 1)).toBe("2026-10-15T00:00:00.000Z"); // em carência
    expect(rules.nextPeriodEnd("2026-09-01T00:00:00.000Z", now, 1)).toBe("2026-10-17T12:00:00.000Z");
    expect(rules.addMonthsUtc("2026-01-31T00:00:00.000Z", 1)).toBe("2026-02-28T00:00:00.000Z");
  });

  it("gives recurring plans 3 days of grace, canceled and prepaid ones none", () => {
    const renewsAt = "2026-09-10T00:00:00.000Z";
    const at = (days: number) => new Date(Date.parse(renewsAt) + days * DAY);
    expect(rules.subscriptionExpired({ renewsAt, recurring: true, cancelAtPeriodEnd: false }, at(2.9))).toBe(false);
    expect(rules.subscriptionExpired({ renewsAt, recurring: true, cancelAtPeriodEnd: false }, at(3))).toBe(true);
    expect(rules.subscriptionExpired({ renewsAt, recurring: true, cancelAtPeriodEnd: true }, at(0))).toBe(true);
    expect(rules.subscriptionExpired({ renewsAt, recurring: false, cancelAtPeriodEnd: false }, at(-0.1))).toBe(false);
  });

  it("reads MP statuses and warns at the right time", () => {
    expect(rules.preapprovalEffect("authorized")).toBe("active");
    expect(rules.preapprovalEffect("paused")).toBe("cancel");
    expect(rules.preapprovalEffect("pending")).toBe("none");
    expect(rules.authorizedPaymentApproved({ status: "processed", payment: { status: "approved" } })).toBe(true);
    expect(rules.authorizedPaymentApproved({ status: "recycling", payment: { status: "rejected" } })).toBe(false);
    expect(rules.authorizedPaymentApproved({ status: "processed" })).toBe(true);
    const renewsAt = "2026-09-10T00:00:00.000Z";
    expect(rules.subscriptionNotice({ renewsAt, recurring: true, cancelAtPeriodEnd: true }, new Date("2026-09-08T00:00:00Z"))).toEqual({ kind: "ending_soon", days: 2 });
    expect(rules.subscriptionNotice({ renewsAt, recurring: true, cancelAtPeriodEnd: true }, new Date("2026-09-01T00:00:00Z"))).toBeNull();
    expect(rules.subscriptionNotice({ renewsAt, recurring: true, cancelAtPeriodEnd: false }, new Date("2026-09-11T00:00:00Z"))).toEqual({ kind: "payment_late", days: 2 });
    expect(rules.subscriptionNotice({ renewsAt, recurring: false, cancelAtPeriodEnd: false }, new Date("2026-09-11T00:00:00Z"))).toBeNull();
  });
});

describe("recurring billing lifecycle (fake MP transport)", () => {
  it("creates one price row and one BRL preapproval at R$997", async () => {
    const a = agency();
    const price = billing.ensurePlanPrice("agency_growth", "monthly");
    expect(billing.ensurePlanPrice("agency_growth", "monthly").id).toBe(price.id);
    expect(price.amount).toBe(997);
    const created = await mp.createRecurring({ ...a, planId: "agency_growth", period: "monthly", amount: price.amount, payerEmail: "dono@example.com" });
    expect(created.initPoint).toContain("/plans?sub=fake");
    const outbox = JSON.parse(fs.readFileSync(path.join(process.env.DATA_DIR!, "mp-outbox.json"), "utf8"));
    const sent = outbox.filter((r: { path: string }) => r.path === "/preapproval");
    expect(sent).toHaveLength(1);
    expect(sent[0].body.auto_recurring).toMatchObject({ frequency: 1, frequency_type: "months", transaction_amount: 997, currency_id: "BRL" });
    expect(sent[0].body.external_reference).toBe(`sub|agency|${a.accountId}|agency_growth|monthly`);
    expect(sent[0].body.preapproval_plan_id).toBeUndefined();
  });

  it("activates on the first approved charge, refills coins and ignores replays", () => {
    const a = agency();
    const price = billing.ensurePlanPrice("agency_growth", "monthly");
    billing.recordPreapproval({ id: `pre-${a.accountId}`, ...a, planId: "agency_growth", period: "monthly", amount: price.amount, mpPlanRowId: price.id, status: "pending", payerEmail: "x@example.com", initPoint: "" });
    const now = new Date();
    const pay = { authorizedPaymentId: `ap-${a.accountId}`, preapprovalId: `pre-${a.accountId}`, approved: true, amount: 997, mpStatus: "approved" };
    expect(billing.applySubscriptionPayment(pay, now)).toBe("credited");
    const sub = billing.getSubscription(a.accountType, a.accountId);
    expect(sub).toMatchObject({ planId: "agency_growth", recurring: true, cancelAtPeriodEnd: false, mpPreapprovalId: `pre-${a.accountId}` });
    const days = (Date.parse(sub.renewsAt) - now.getTime()) / DAY;
    expect(days).toBeGreaterThanOrEqual(28);
    expect(days).toBeLessThanOrEqual(31);
    expect(billing.getWallet(a.accountType, a.accountId).planCoins).toBe(6000);
    expect(billing.applySubscriptionPayment(pay, now)).toBe("already_credited");
    expect(billing.getWallet(a.accountType, a.accountId).planCoins).toBe(6000);
    // valor menor que o preço não credita
    expect(billing.applySubscriptionPayment({ ...pay, authorizedPaymentId: "cheap", amount: 10 }, now)).toBe("invalid");
    // referência desconhecida
    expect(billing.applySubscriptionPayment({ ...pay, authorizedPaymentId: "ghost", preapprovalId: "nope" }, now)).toBe("invalid");
  });

  it("downgrades after the period end plus 3 days, and a cancel keeps access only until the end", () => {
    const a = agency();
    const b = agency();
    for (const acct of [a, b]) {
      billing.recordPreapproval({ id: `pre-${acct.accountId}`, ...acct, planId: "agency_starter", period: "monthly", amount: 497, mpPlanRowId: "x", status: "pending", payerEmail: "x@example.com", initPoint: "" });
      billing.applySubscriptionPayment({ authorizedPaymentId: `ap-${acct.accountId}`, preapprovalId: `pre-${acct.accountId}`, approved: true, amount: 497, mpStatus: "approved" });
    }
    const end = Date.parse(billing.getSubscription(a.accountType, a.accountId).renewsAt);
    billing.refreshAccount(a.accountType, a.accountId, new Date(end + 2 * DAY));
    expect(billing.getSubscription(a.accountType, a.accountId).planId).toBe("agency_starter");
    billing.refreshAccount(a.accountType, a.accountId, new Date(end + 3 * DAY + 1000));
    const viewed = billing.viewAccount(a.accountType, a.accountId, new Date(end + 3 * DAY + 1000));
    expect(viewed.subscription.planId).toBe("agency_free");

    const canceled = billing.markCancelAtPeriodEnd(b.accountType, b.accountId);
    expect(canceled).toMatchObject({ planId: "agency_starter", cancelAtPeriodEnd: true });
    expect(billing.viewAccount(b.accountType, b.accountId, new Date(end - DAY)).subscription.planId).toBe("agency_starter");
    expect(billing.viewAccount(b.accountType, b.accountId, new Date(end + 1000)).subscription.planId).toBe("agency_free");
    // o MP avisa "cancelled": mesma coisa, sem duplicar
    expect(billing.applyPreapprovalStatus({ id: `pre-${b.accountId}`, status: "cancelled" })).toBe("updated");
    expect(billing.applyPreapprovalStatus({ id: "desconhecido", status: "cancelled" })).toBe("unknown");
  });

  it("is available with the file transport or a token, never without both", async () => {
    expect(mp.subscriptionsAvailable()).toBe(true);
    process.env.MP_TRANSPORT = "";
    const savedToken = process.env.MP_ACCESS_TOKEN;
    delete process.env.MP_ACCESS_TOKEN;
    expect(mp.subscriptionsAvailable()).toBe(false);
    await expect(mp.createRecurring({ accountType: "agency", accountId: "z", planId: "agency_growth", period: "monthly", amount: 997, payerEmail: "a@example.com" })).rejects.toThrow();
    process.env.MP_TRANSPORT = "file";
    if (savedToken) process.env.MP_ACCESS_TOKEN = savedToken;
  });
});
