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

describe("recurring billing: one subscription per account, refunds and refills", () => {
  const sync = import("../../lib/subscription-sync");
  const fakeStore = () => path.join(process.env.DATA_DIR!, "mp-fake.json");
  const outbox = () => {
    try {
      return JSON.parse(fs.readFileSync(path.join(process.env.DATA_DIR!, "mp-outbox.json"), "utf8")) as { method: string; path: string; body: { status?: string } | null }[];
    } catch {
      return [];
    }
  };
  const open = (acct: { accountType: "agency"; accountId: string }, id: string, planId: string, amount: number, period: "monthly" | "quarterly" = "monthly") =>
    billing.recordPreapproval({ id, ...acct, planId, period, amount, mpPlanRowId: "x", status: "pending", payerEmail: "x@example.com", initPoint: "" });
  const charge = (id: string, pre: string, amount: number, extra: Partial<Parameters<typeof billing.applySubscriptionPayment>[0]> = {}, at = new Date()) =>
    billing.applySubscriptionPayment({ authorizedPaymentId: id, preapprovalId: pre, approved: true, amount, mpStatus: "approved", ...extra }, at);

  it("an upgrade retires the old authorization, which can no longer charge or switch the plan back", async () => {
    const a = agency();
    open(a, `pre-s-${a.accountId}`, "agency_starter", 497);
    expect(charge(`ap-s1-${a.accountId}`, `pre-s-${a.accountId}`, 497)).toBe("credited");
    // o fake do MP precisa conhecer a autorização para o cancelamento
    const store = JSON.parse(fs.existsSync(fakeStore()) ? fs.readFileSync(fakeStore(), "utf8") : '{"preapprovals":{},"authorized_payments":{},"seq":0}');
    store.preapprovals[`pre-s-${a.accountId}`] = { id: `pre-s-${a.accountId}`, status: "authorized" };
    fs.writeFileSync(fakeStore(), JSON.stringify(store));

    open(a, `pre-g-${a.accountId}`, "agency_growth", 997);
    expect(charge(`ap-g1-${a.accountId}`, `pre-g-${a.accountId}`, 997)).toBe("credited");
    expect(billing.getSubscription(a.accountType, a.accountId)).toMatchObject({ planId: "agency_growth", mpPreapprovalId: `pre-g-${a.accountId}` });
    expect(billing.getPreapproval(`pre-s-${a.accountId}`)?.supersededAt).toBeTruthy();
    expect(billing.preapprovalsToCancel().map((p) => p.id)).toContain(`pre-s-${a.accountId}`);

    await (await sync).cancelRetiredPreapprovals();
    expect(outbox().some((r) => r.method === "PUT" && r.path === `/preapproval/pre-s-${a.accountId}` && r.body?.status === "cancelled")).toBe(true);
    expect(billing.getPreapproval(`pre-s-${a.accountId}`)?.status).toBe("cancelled");
    expect(billing.getPreapproval(`pre-g-${a.accountId}`)?.supersededAt ?? null).toBeNull();

    // cobrança atrasada da autorização antiga não liga nada
    expect(charge(`ap-s2-${a.accountId}`, `pre-s-${a.accountId}`, 497)).toBe("invalid");
    expect(billing.getSubscription(a.accountType, a.accountId).planId).toBe("agency_growth");
    expect(billing.getPaymentRow(`sub_ap-s2-${a.accountId}`)?.detail).toContain("estornar");
  });

  it("cancelling retires every open authorization of the account", () => {
    const a = agency();
    open(a, `pre-old-${a.accountId}`, "agency_starter", 497);
    open(a, `pre-cur-${a.accountId}`, "agency_growth", 997);
    expect(charge(`ap-cur-${a.accountId}`, `pre-cur-${a.accountId}`, 997)).toBe("credited");
    // a antiga (ainda pendente) já foi aposentada pela cobrança da nova
    expect(billing.getPreapproval(`pre-old-${a.accountId}`)?.supersededAt).toBeTruthy();
    billing.markCancelAtPeriodEnd(a.accountType, a.accountId);
    expect(billing.getPreapproval(`pre-cur-${a.accountId}`)?.status).toBe("cancelled");
    expect(charge(`ap-cur2-${a.accountId}`, `pre-cur-${a.accountId}`, 997)).toBe("invalid");
    expect(charge(`ap-old-${a.accountId}`, `pre-old-${a.accountId}`, 497)).toBe("invalid");
    const sub = billing.getSubscription(a.accountType, a.accountId);
    expect(sub).toMatchObject({ planId: "agency_growth", cancelAtPeriodEnd: true });
  });

  it("forgotten pending authorizations expire after 7 days", () => {
    const a = agency();
    open(a, `pre-stale-${a.accountId}`, "agency_starter", 497);
    expect(billing.supersedeStalePendingPreapprovals(7, new Date(Date.now() + 8 * DAY))).toBeGreaterThan(0);
    expect(billing.getPreapproval(`pre-stale-${a.accountId}`)?.supersededAt).toBeTruthy();
  });

  it("a refunded or charged-back charge takes the plan and its coins away (charge topic and payment topic)", () => {
    const a = agency();
    open(a, `pre-r-${a.accountId}`, "agency_growth", 997);
    expect(charge(`ap-r-${a.accountId}`, `pre-r-${a.accountId}`, 997, { paymentId: `9${seq}01` })).toBe("credited");
    expect(billing.getWallet(a.accountType, a.accountId).planCoins).toBe(6000);
    // o pagamento aprovado (tópico payment) só fica registrado, sem "inválido"
    const ref = `sub|agency|${a.accountId}|agency_growth|monthly`;
    expect(billing.applyMpPayment({ id: `9${seq}01`, status: "approved", externalReference: ref, amount: 997 })).toBe("ignored");
    expect(billing.getPaymentRow(`9${seq}01`)?.status).toBe("linked");
    // chargeback do pagamento → desfaz a cobrança ligada
    expect(billing.applyMpPayment({ id: `9${seq}01`, status: "charged_back", externalReference: ref, amount: 997 })).toBe("refunded");
    const sub = billing.getSubscription(a.accountType, a.accountId);
    expect(sub.planId).toBe("agency_free");
    expect(sub.recurring).toBe(false);
    expect(billing.getWallet(a.accountType, a.accountId).planCoins).toBeLessThan(6000);
    expect(billing.getPaymentRow(`sub_ap-r-${a.accountId}`)?.status).toBe("refunded");
    expect(billing.getPreapproval(`pre-r-${a.accountId}`)?.supersededAt).toBeTruthy();
    const refunds = billing.listTransactions({ accountType: a.accountType, accountId: a.accountId }).filter((t) => t.kind === "payment_refund");
    expect(refunds).toHaveLength(1);
    expect(refunds[0].amount).toBe(-997);
    // replays não desfazem de novo
    expect(billing.applyMpPayment({ id: `9${seq}01`, status: "charged_back", externalReference: ref, amount: 997 })).toBe("already_refunded");
    expect(billing.applySubscriptionPayment({ authorizedPaymentId: `ap-r-${a.accountId}`, preapprovalId: `pre-r-${a.accountId}`, approved: false, amount: 997, mpStatus: "charged_back" })).toBe("already_refunded");
    // a autorização estornada não liga o plano de novo
    expect(charge(`ap-r2-${a.accountId}`, `pre-r-${a.accountId}`, 997)).toBe("invalid");

    // estorno avisado pela própria cobrança (authorized_payment)
    const b = agency();
    open(b, `pre-rb-${b.accountId}`, "agency_starter", 497);
    expect(charge(`ap-rb-${b.accountId}`, `pre-rb-${b.accountId}`, 497)).toBe("credited");
    expect(billing.applySubscriptionPayment({ authorizedPaymentId: `ap-rb-${b.accountId}`, preapprovalId: `pre-rb-${b.accountId}`, approved: false, amount: 497, mpStatus: "refunded" })).toBe("refunded");
    expect(billing.getSubscription(b.accountType, b.accountId).planId).toBe("agency_free");

    // estorno pelo tópico payment achando a cobrança pelo invoice_id
    const c = agency();
    open(c, `pre-rc-${c.accountId}`, "agency_starter", 497);
    expect(charge(`ap-rc-${c.accountId}`, `pre-rc-${c.accountId}`, 497)).toBe("credited");
    expect(
      billing.applyMpPayment({ id: `8${seq}02`, status: "refunded", externalReference: "", amount: 497, preapprovalId: `pre-rc-${c.accountId}`, authorizedPaymentId: `ap-rc-${c.accountId}` })
    ).toBe("refunded");
    expect(billing.getSubscription(c.accountType, c.accountId).planId).toBe("agency_free");
  });

  it("reads the subscription link from a MP payment", () => {
    expect(rules.paymentSubscriptionLink({ point_of_interaction: { type: "SUBSCRIPTIONS", transaction_data: { subscription_id: "2c93808", invoice_id: 7001 } } })).toEqual({
      preapprovalId: "2c93808",
      authorizedPaymentId: "7001",
    });
    expect(rules.paymentSubscriptionLink({ metadata: { preapproval_id: "abc" } })).toEqual({ preapprovalId: "abc", authorizedPaymentId: null });
    expect(rules.paymentSubscriptionLink({})).toEqual({ preapprovalId: null, authorizedPaymentId: null });
    expect(rules.paymentSubscriptionLink({ metadata: { preapproval_id: "x y;drop" } }).preapprovalId).toBeNull();
  });

  it("does not refill the quota between the renewal date and the renewal charge, nor during grace", () => {
    const a = agency();
    open(a, `pre-q-${a.accountId}`, "agency_starter", 497);
    const t0 = new Date();
    expect(charge(`ap-q1-${a.accountId}`, `pre-q-${a.accountId}`, 497, {}, t0)).toBe("credited");
    billing.chargeUsage({ ...a, action: "strategy_analysis" });
    const afterUse = billing.getWallet(a.accountType, a.accountId).planCoins;
    expect(afterUse).toBeLessThan(2000);
    const end = Date.parse(billing.getSubscription(a.accountType, a.accountId).renewsAt);
    billing.refreshAccount(a.accountType, a.accountId, new Date(end + 60_000));
    expect(billing.viewAccount(a.accountType, a.accountId, new Date(end + 2 * DAY)).wallet.planCoins).toBe(afterUse);
    expect(billing.listTransactions({ accountType: a.accountType, accountId: a.accountId }).filter((t) => t.kind === "refill")).toHaveLength(0);
    expect(charge(`ap-q2-${a.accountId}`, `pre-q-${a.accountId}`, 497, {}, new Date(end + 2 * 3_600_000))).toBe("credited");
    const renewals = billing.listTransactions({ accountType: a.accountType, accountId: a.accountId }).filter((t) => t.kind === "subscription_renewal");
    expect(renewals).toHaveLength(2);
  });

  it("still refills every month inside a quarterly period", () => {
    const a = agency();
    const t0 = new Date();
    open(a, `pre-3m-${a.accountId}`, "agency_starter", 1500, "quarterly");
    expect(charge(`ap-3m-${a.accountId}`, `pre-3m-${a.accountId}`, 1500, {}, t0)).toBe("credited");
    billing.chargeUsage({ ...a, action: "strategy_analysis" });
    const at = new Date(Date.parse(billing.addMonthsIso(t0.toISOString(), 1)) + 60_000);
    billing.refreshAccount(a.accountType, a.accountId, at);
    expect(billing.viewAccount(a.accountType, a.accountId, at).wallet.planCoins).toBe(2000);
  });

  it("keeps prepaid months when the same plan moves to the card", () => {
    const a = agency();
    billing.adminSetPlan({ ...a, planId: "agency_starter", months: 6 });
    const prepaidEnd = billing.getSubscription(a.accountType, a.accountId).renewsAt;
    open(a, `pre-pp-${a.accountId}`, "agency_starter", 497);
    expect(charge(`ap-pp-${a.accountId}`, `pre-pp-${a.accountId}`, 497)).toBe("credited");
    const sub = billing.getSubscription(a.accountType, a.accountId);
    expect(sub.recurring).toBe(true);
    expect(sub.renewsAt).toBe(rules.addMonthsUtc(prepaidEnd, 1));
  });
});
