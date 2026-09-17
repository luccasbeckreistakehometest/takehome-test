import { beforeEach, describe, expect, it } from "vitest";
import path from "path";
import os from "os";
import fs from "fs";

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "marqa-analytics-"));
delete (globalThis as { __agencyhubDb?: unknown }).__agencyhubDb;
const { db } = await import("../../lib/db");
const rules = await import("../../lib/analytics-rules");
const store = await import("../../lib/analytics-db");
const { visitorHash } = await import("../../lib/visitor");

describe("analytics rules", () => {
  it("accepts only known client events on public pages", () => {
    const ok = rules.parseBeacon(JSON.stringify({ name: "view", path: "/para-agencias?x=1", utm: { source: "IG", campaign: "Teste Setembro" } }));
    expect(ok.ok && ok.value).toMatchObject({ name: "view", path: "/para-agencias", audience: "agencia", utm: { source: "ig", campaign: "teste setembro" } });
    expect(rules.parseBeacon(JSON.stringify({ name: "payment_approved", path: "/" }))).toMatchObject({ ok: false, status: 400 });
    expect(rules.parseBeacon(JSON.stringify({ name: "hack", path: "/" }))).toMatchObject({ ok: false, status: 400 });
    expect(rules.parseBeacon(JSON.stringify({ name: "view", path: "/admin" }))).toMatchObject({ ok: false, status: 400 });
    expect(rules.parseBeacon("{not json")).toMatchObject({ ok: false, status: 400 });
    expect(rules.parseBeacon(JSON.stringify({ name: "view", path: "/", meta: { x: "a".repeat(3000) } }))).toMatchObject({ ok: false, status: 413 });
  });

  it("stores token pages without the token and maps audiences", () => {
    const v = rules.parseBeacon(JSON.stringify({ name: "view", path: "/aprovar/abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG" }));
    expect(v.ok && v.value.path).toBe("/aprovar/:token");
    expect(rules.audienceFromPath("/criar-conta", "client")).toBe("marca");
    expect(rules.audienceFromPath("/")).toBe("geral");
    expect(rules.audienceFromRole("professional")).toBe("profissional");
  });

  it("computes step conversion", () => {
    const rows = rules.funnel({ view: 200, cta_click: 50, signup_started: 20, signup_completed: 10, first_value: 5, checkout_started: 0, payment_approved: 0 });
    expect(rows[0]).toEqual({ step: "view", count: 200, rate: null });
    expect(rows[1].rate).toBe(25);
    expect(rows[6]).toEqual({ step: "payment_approved", count: 0, rate: null });
  });

  it("builds campaign links", () => {
    expect(rules.buildCampaignUrl("https://marqa.online", "/para-marcas", { source: "Instagram", medium: "bio", campaign: "set 26" })).toBe(
      "https://marqa.online/para-marcas?utm_source=instagram&utm_medium=bio&utm_campaign=set+26"
    );
  });
});

describe("analytics store", () => {
  beforeEach(() => {
    db.prepare("DELETE FROM page_events").run();
    db.prepare("DELETE FROM page_events_daily").run();
  });

  it("hashes visitors per day without a persistent id", () => {
    const a = visitorHash("1.2.3.4", "UA", new Date("2026-09-17T10:00:00Z"));
    expect(visitorHash("1.2.3.4", "UA", new Date("2026-09-17T23:00:00Z"))).toBe(a);
    expect(visitorHash("1.2.3.4", "UA", new Date("2026-09-18T10:00:00Z"))).not.toBe(a);
    expect(a).toMatch(/^[0-9a-f]{16}$/);
  });

  it("prunes raw events after 90 days but keeps the daily rollup", () => {
    const now = new Date("2026-09-17T12:00:00Z");
    const old = new Date("2026-05-01T12:00:00Z");
    const utm = rules.sanitizeUtm({ source: "ig" });
    store.recordEvent({ name: "view", audience: "agencia", utm, visitorHash: "v1", at: old });
    store.recordEvent({ name: "view", audience: "agencia", utm, visitorHash: "v1", at: old });
    store.recordEvent({ name: "view", audience: "agencia", utm, visitorHash: "v2", at: old });
    store.recordEvent({ name: "view", audience: "agencia", utm, visitorHash: "v3", at: now });
    expect(store.pruneEvents(now)).toBe(3);
    expect((db.prepare("SELECT COUNT(*) AS c FROM page_events").get() as { c: number }).c).toBe(1);
    const rollup = db.prepare("SELECT count, uniques FROM page_events_daily WHERE day = '2026-05-01'").get() as { count: number; uniques: number };
    expect(rollup).toEqual({ count: 3, uniques: 2 });
  });
});
