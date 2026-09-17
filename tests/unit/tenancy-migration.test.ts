import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import fs from "fs";
import os from "os";
import path from "path";
import { migrateTenancy, TENANCY_MIGRATION_ID } from "../../lib/tenancy-migration";
import { TENANT_TABLES } from "../../lib/tenancy-rules";

const now = "2026-09-01T12:00:00.000Z";

// Banco com o formato de produção ANTES do multi-tenant (um workspace só).
function legacyDb(file = ":memory:"): Database.Database {
  const db = new Database(file);
  db.exec(`
    CREATE TABLE settings (id INTEGER PRIMARY KEY CHECK (id = 1), agencyName TEXT NOT NULL, tagline TEXT NOT NULL,
      accentColor TEXT NOT NULL, landingPagesEnabled INTEGER NOT NULL DEFAULT 0, aiMode TEXT NOT NULL DEFAULT 'balanced',
      anthropicApiKey TEXT NOT NULL DEFAULT '', logoMime TEXT NOT NULL DEFAULT '', houseStyle TEXT NOT NULL DEFAULT '');
    INSERT INTO settings (id, agencyName, tagline, accentColor, logoMime, houseStyle)
      VALUES (1, 'Agência Farol', 'marketing que ilumina', '#123456', 'image/png', 'sem jargão');
    CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updatedAt TEXT NOT NULL);
    INSERT INTO app_settings VALUES ('agency_page', '{"slug":"farol","published":true,"headline":"Oi"}', '${now}');
    INSERT INTO app_settings VALUES ('approval_rules', '{"autoPostDraft":true}', '${now}');
    CREATE TABLE users (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, passwordHash TEXT NOT NULL, role TEXT NOT NULL,
      refId TEXT, name TEXT NOT NULL, brandSource TEXT NOT NULL DEFAULT 'agency', onboardedAt TEXT, email TEXT, createdAt TEXT NOT NULL);
    INSERT INTO users VALUES ('u-admin', 'admin', 'x', 'admin', NULL, 'Admin', 'agency', NULL, NULL, '2026-08-01');
    INSERT INTO users VALUES ('u-agencia', 'agencia', 'x', 'agency', NULL, 'Agência', 'agency', NULL, NULL, '2026-08-02');
    INSERT INTO users VALUES ('u-cachaca', 'cachaca', 'x', 'agency', NULL, 'Cachaça Mkt', 'platform', NULL, 'c@example.com', '2026-09-10');
    INSERT INTO users VALUES ('u-socia', 'socia', 'x', 'agency', NULL, 'Sócia', 'platform', NULL, 's@example.com', '2026-09-11');
    INSERT INTO users VALUES ('u-quieta', 'quieta', 'x', 'agency', NULL, 'Agência Quieta', 'platform', NULL, 'q@example.com', '2026-09-12');
    INSERT INTO users VALUES ('u-kaisan', 'kaisan', 'x', 'client', 'c-1', 'Kaisan', 'agency', NULL, NULL, '2026-08-03');
    INSERT INTO users VALUES ('u-self', 'marca', 'x', 'client', 'c-2', 'Marca Solo', 'platform', NULL, 'm@example.com', '2026-08-04');
    INSERT INTO users VALUES ('u-foto', 'foto', 'x', 'professional', 'p-1', 'Fotógrafo da casa', 'agency', NULL, NULL, '2026-08-05');
    INSERT INTO users VALUES ('u-free', 'free', 'x', 'professional', 'p-2', 'Freela', 'platform', NULL, 'f@example.com', '2026-08-06');
    CREATE TABLE invites (id TEXT PRIMARY KEY, token TEXT NOT NULL UNIQUE, role TEXT NOT NULL, note TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending', expiresAt TEXT, usedByRefId TEXT, createdAt TEXT NOT NULL, acceptedAt TEXT);
    INSERT INTO invites VALUES ('i-1', 'tok', 'agency', 'sócia', 'accepted', NULL, 'u-socia', '${now}', '${now}');
    CREATE TABLE clients (id TEXT PRIMARY KEY, name TEXT NOT NULL, selfServe INTEGER NOT NULL DEFAULT 0, createdAt TEXT NOT NULL);
    INSERT INTO clients VALUES ('c-1', 'Kaisan', 0, '${now}');
    INSERT INTO clients VALUES ('c-2', 'Marca Solo', 1, '${now}');
    CREATE TABLE generations (id TEXT PRIMARY KEY, clientId TEXT NOT NULL, type TEXT NOT NULL, title TEXT NOT NULL,
      params TEXT NOT NULL DEFAULT '{}', content TEXT NOT NULL, createdAt TEXT NOT NULL);
    INSERT INTO generations VALUES ('g-1', 'c-1', 'strategy_analysis', 'Estratégia', '{}', '{}', '${now}');
    CREATE TABLE professionals (id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL, createdAt TEXT NOT NULL);
    INSERT INTO professionals VALUES ('p-1', 'Fotógrafo da casa', 'fotografo', '${now}');
    INSERT INTO professionals VALUES ('p-2', 'Freela', 'designer', '${now}');
    INSERT INTO professionals VALUES ('p-3', 'Sem login', 'designer', '${now}');
    CREATE TABLE professional_assets (id TEXT PRIMARY KEY, professionalId TEXT NOT NULL, title TEXT NOT NULL, mime TEXT NOT NULL, createdAt TEXT NOT NULL);
    INSERT INTO professional_assets VALUES ('pa-1', 'p-1', 'a', 'image/png', '${now}');
    INSERT INTO professional_assets VALUES ('pa-2', 'p-2', 'b', 'image/png', '${now}');
    CREATE TABLE projects (id TEXT PRIMARY KEY, clientId TEXT NOT NULL, professionalId TEXT, title TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', createdAt TEXT NOT NULL);
    INSERT INTO projects VALUES ('pr-1', 'c-1', 'p-2', 'Fotos', 'open', '${now}');
    CREATE TABLE applications (id TEXT PRIMARY KEY, projectId TEXT NOT NULL, professionalId TEXT NOT NULL, message TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending', createdAt TEXT NOT NULL);
    INSERT INTO applications VALUES ('ap-1', 'pr-1', 'p-2', '', 'pending', '${now}');
    CREATE TABLE idea_batches (id TEXT PRIMARY KEY, audience TEXT NOT NULL, targetId TEXT, content TEXT NOT NULL, createdAt TEXT NOT NULL);
    INSERT INTO idea_batches VALUES ('ib-1', 'agency', NULL, '{}', '${now}');
    INSERT INTO idea_batches VALUES ('ib-2', 'professional', 'p-2', '{}', '${now}');
    CREATE TABLE prospects (id TEXT PRIMARY KEY, name TEXT NOT NULL, createdAt TEXT NOT NULL);
    INSERT INTO prospects VALUES ('ps-1', 'Padaria', '${now}');
    CREATE TABLE leads (id TEXT PRIMARY KEY, slug TEXT NOT NULL, name TEXT NOT NULL, createdAt TEXT NOT NULL);
    INSERT INTO leads VALUES ('l-1', 'farol', 'Ana', '${now}');
    CREATE TABLE channel_connections (channel TEXT NOT NULL, mode TEXT NOT NULL, apiToken TEXT NOT NULL DEFAULT '',
      apiAccountId TEXT NOT NULL DEFAULT '', sessionReady INTEGER NOT NULL DEFAULT 0, updatedAt TEXT NOT NULL, PRIMARY KEY (channel));
    INSERT INTO channel_connections VALUES ('whatsapp', 'api', 'tok-wa', '1234', 0, '${now}');
    CREATE TABLE onboarding (userId TEXT PRIMARY KEY, tourCompleted INTEGER NOT NULL DEFAULT 0, tourStep INTEGER NOT NULL DEFAULT 0,
      firstSeenAt TEXT NOT NULL, completedAt TEXT, events TEXT NOT NULL DEFAULT '[]');
    INSERT INTO onboarding VALUES ('u-cachaca', 1, 16, '${now}', '${now}', '[]');
    CREATE TABLE wallets (accountType TEXT NOT NULL, accountId TEXT NOT NULL, coins REAL NOT NULL DEFAULT 0, planCoins REAL NOT NULL DEFAULT 0,
      PRIMARY KEY (accountType, accountId));
    INSERT INTO wallets VALUES ('agency', 'agency', 10, 60);
    INSERT INTO wallets VALUES ('client', 'c-2', 0, 40);
    INSERT INTO wallets VALUES ('professional', 'p-2', 0, 20);
    CREATE TABLE subscriptions (accountType TEXT NOT NULL, accountId TEXT NOT NULL, planId TEXT NOT NULL, period TEXT NOT NULL DEFAULT 'monthly',
      status TEXT NOT NULL DEFAULT 'active', startedAt TEXT NOT NULL, renewsAt TEXT NOT NULL, PRIMARY KEY (accountType, accountId));
    INSERT INTO subscriptions VALUES ('agency', 'agency', 'agency_growth', 'monthly', 'active', '${now}', '2027-01-01');
    CREATE TABLE billing_transactions (id TEXT PRIMARY KEY, accountType TEXT NOT NULL, accountId TEXT NOT NULL, kind TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '', amount REAL NOT NULL DEFAULT 0, coins REAL NOT NULL DEFAULT 0, createdAt TEXT NOT NULL);
    INSERT INTO billing_transactions VALUES ('t-1', 'agency', 'agency', 'usage', 'IA', 0, -5, '${now}');
    INSERT INTO billing_transactions VALUES ('t-2', 'client', 'c-2', 'usage', 'IA', 0, -2, '${now}');
    CREATE TABLE ai_usage (id TEXT PRIMARY KEY, createdAt TEXT NOT NULL, day TEXT NOT NULL, action TEXT NOT NULL DEFAULT '',
      accountType TEXT, accountId TEXT, userId TEXT, costUsd REAL NOT NULL DEFAULT 0);
    INSERT INTO ai_usage VALUES ('au-1', '${now}', '2026-09-01', 'strategy_analysis', 'agency', 'agency', 'u-cachaca', 0.4);
    INSERT INTO ai_usage VALUES ('au-2', '${now}', '2026-09-01', 'ideas', NULL, NULL, 'u-admin', 0.1);
  `);
  return db;
}

const agencyOf = (db: Database.Database, table: string, where: string) =>
  (db.prepare(`SELECT agencyId FROM ${table} WHERE ${where}`).get() as { agencyId: string | null }).agencyId;

describe("tenancy migration — fresh database", () => {
  it("creates the house agency and marks the migration once", () => {
    const db = new Database(":memory:");
    const first = migrateTenancy(db);
    expect(first.applied).toBe(true);
    expect(first.houseOwner).toBeNull();
    const house = db.prepare("SELECT * FROM agencies").all() as { id: string; name: string; slug: string }[];
    expect(house).toEqual([expect.objectContaining({ id: "agency", name: "Marqa", slug: "marqa" })]);
    expect(migrateTenancy(db).applied).toBe(false);
    expect((db.prepare("SELECT COUNT(*) AS c FROM agencies").get() as { c: number }).c).toBe(1);
    expect(db.prepare("SELECT id FROM schema_migrations").all()).toEqual([{ id: TENANCY_MIGRATION_ID }]);
  });
});

describe("tenancy migration — production-shaped database", () => {
  it("builds the house agency from the global settings and page", () => {
    const db = legacyDb();
    const report = migrateTenancy(db);
    expect(report.houseOwner).toBe("agencia");
    const house = db.prepare("SELECT * FROM agencies WHERE id = 'agency'").get() as Record<string, string>;
    expect(house).toMatchObject({
      name: "Agência Farol",
      slug: "farol",
      tagline: "marketing que ilumina",
      accentColor: "#123456",
      logoMime: "image/png",
      houseStyle: "sem jargão",
      ownerUserId: "u-agencia",
      billingAccountId: "agency",
    });
    expect(JSON.parse(house.pageConfig)).toMatchObject({ published: true, headline: "Oi" });
  });

  it("assigns every existing row to the house agency", () => {
    const db = legacyDb();
    const report = migrateTenancy(db);
    for (const [table, where] of [
      ["clients", "id = 'c-1'"],
      ["clients", "id = 'c-2'"],
      ["generations", "id = 'g-1'"],
      ["projects", "id = 'pr-1'"],
      ["applications", "id = 'ap-1'"],
      ["prospects", "id = 'ps-1'"],
      ["leads", "id = 'l-1'"],
      ["idea_batches", "id = 'ib-1'"],
      ["invites", "id = 'i-1'"],
      ["channel_connections", "channel = 'whatsapp'"],
    ] as const) {
      expect(agencyOf(db, table, where)).toBe("agency");
    }
    expect(report.tables.clients).toBe(2);
    // nenhuma linha "da casa" ficou sem agência
    for (const [table, rule] of Object.entries(TENANT_TABLES)) {
      if (rule !== "house") continue;
      const exists = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name = ?").get(table);
      if (!exists) continue;
      expect((db.prepare(`SELECT COUNT(*) AS c FROM ${table} WHERE agencyId IS NULL`).get() as { c: number }).c).toBe(0);
    }
  });

  it("gives self-registered agencies their own empty agency, keeps invited team members in the house", () => {
    const db = legacyDb();
    const report = migrateTenancy(db);
    expect(agencyOf(db, "users", "id = 'u-agencia'")).toBe("agency");
    expect(agencyOf(db, "users", "id = 'u-socia'")).toBe("agency"); // entrou por convite
    const cachaca = agencyOf(db, "users", "id = 'u-cachaca'")!;
    const quieta = agencyOf(db, "users", "id = 'u-quieta'")!;
    expect(cachaca).not.toBe("agency");
    expect(quieta).not.toBe(cachaca);
    const own = db.prepare("SELECT * FROM agencies WHERE id = ?").get(cachaca) as Record<string, string>;
    expect(own).toMatchObject({ name: "Cachaça Mkt", slug: "cachaca-mkt", ownerUserId: "u-cachaca", billingAccountId: cachaca });
    expect((db.prepare("SELECT COUNT(*) AS c FROM clients WHERE agencyId = ?").get(cachaca) as { c: number }).c).toBe(0);
    // o que ela fez no workspace da casa fica na casa e sai no relatório
    const entry = report.separated.find((s) => s.username === "cachaca")!;
    expect(entry.evidence).toMatchObject({ ai_usage: 1, "ai_usage.strategy_analysis": 1 });
    expect(report.separated.find((s) => s.username === "quieta")!.evidence).toEqual({});
    expect(agencyOf(db, "ai_usage", "id = 'au-1'")).toBe("agency");
    const detail = JSON.parse((db.prepare("SELECT detail FROM schema_migrations").get() as { detail: string }).detail);
    expect(detail.separated).toHaveLength(2);
  });

  it("maps brands, professionals, onboarding and billing to the right agency", () => {
    const db = legacyDb();
    migrateTenancy(db);
    expect(agencyOf(db, "users", "id = 'u-kaisan'")).toBe("agency");
    expect(agencyOf(db, "users", "id = 'u-self'")).toBe("agency");
    expect(agencyOf(db, "users", "id = 'u-admin'")).toBeNull();
    // auto-cadastrado = marketplace aberto; cadastrado pela agência = da casa
    expect(agencyOf(db, "professionals", "id = 'p-1'")).toBe("agency");
    expect(agencyOf(db, "professionals", "id = 'p-2'")).toBeNull();
    expect(agencyOf(db, "professionals", "id = 'p-3'")).toBe("agency");
    expect(agencyOf(db, "users", "id = 'u-foto'")).toBe("agency");
    expect(agencyOf(db, "users", "id = 'u-free'")).toBeNull();
    expect(agencyOf(db, "professional_assets", "id = 'pa-1'")).toBe("agency");
    expect(agencyOf(db, "professional_assets", "id = 'pa-2'")).toBeNull();
    expect(agencyOf(db, "idea_batches", "id = 'ib-2'")).toBeNull();
    expect(agencyOf(db, "onboarding", "userId = 'u-cachaca'")).toBe(agencyOf(db, "users", "id = 'u-cachaca'"));
    expect(agencyOf(db, "wallets", "accountType = 'agency'")).toBe("agency");
    expect(agencyOf(db, "wallets", "accountType = 'client'")).toBe("agency");
    expect(agencyOf(db, "wallets", "accountType = 'professional'")).toBeNull();
    expect(agencyOf(db, "subscriptions", "accountId = 'agency'")).toBe("agency");
    expect(agencyOf(db, "billing_transactions", "id = 't-2'")).toBe("agency");
    expect(agencyOf(db, "ai_usage", "id = 'au-2'")).toBeNull();
    // saldo e plano da casa continuam onde estavam
    expect(db.prepare("SELECT coins, planCoins FROM wallets WHERE accountType = 'agency'").get()).toEqual({ coins: 10, planCoins: 60 });
  });

  it("re-keys channel connections by agency and keeps the credentials", () => {
    const db = legacyDb();
    migrateTenancy(db);
    const pk = (db.prepare("PRAGMA table_info(channel_connections)").all() as { name: string; pk: number }[])
      .filter((c) => c.pk > 0)
      .map((c) => c.name);
    expect(pk.sort()).toEqual(["agencyId", "channel"]);
    expect(db.prepare("SELECT agencyId, channel, apiToken, apiAccountId FROM channel_connections").all()).toEqual([
      { agencyId: "agency", channel: "whatsapp", apiToken: "tok-wa", apiAccountId: "1234" },
    ]);
    // a outra agência pode ter o próprio WhatsApp
    db.prepare("INSERT INTO channel_connections (agencyId, channel, mode, updatedAt) VALUES ('outra', 'whatsapp', 'api', ?)").run(now);
    expect((db.prepare("SELECT COUNT(*) AS c FROM channel_connections").get() as { c: number }).c).toBe(2);
  });

  it("is idempotent and safe across connections (build workers)", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "marqa-tenancy-"));
    const file = path.join(dir, "agencyhub.db");
    legacyDb(file).close();
    const a = new Database(file, { timeout: 5000 });
    const b = new Database(file, { timeout: 5000 });
    const first = migrateTenancy(a);
    const second = migrateTenancy(b);
    expect([first.applied, second.applied]).toEqual([true, false]);
    expect((b.prepare("SELECT COUNT(*) AS c FROM agencies").get() as { c: number }).c).toBe(3);
    // nova rodada não mexe em nada
    const before = b.prepare("SELECT id, agencyId FROM users ORDER BY id").all();
    migrateTenancy(a);
    expect(b.prepare("SELECT id, agencyId FROM users ORDER BY id").all()).toEqual(before);
    a.close();
    b.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
