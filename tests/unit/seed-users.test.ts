import { describe, expect, it } from "vitest";
import path from "path";
import os from "os";
import fs from "fs";

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "agencyhub-seed-"));
const { db, createClient } = await import("../../lib/db");
const auth = await import("../../lib/auth");

const count = (role: string) =>
  (db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = ?").get(role) as { n: number }).n;

describe("seed users", () => {
  it("creates nothing when SEED_PASSWORD is missing or short", async () => {
    await auth.seedUsers(undefined);
    await auth.seedUsers("short");
    expect(count("admin")).toBe(0);
    expect(count("agency")).toBe(0);
  });

  it("creates exactly one platform admin and one agency login, even when run concurrently", async () => {
    await Promise.all([auth.seedUsers("seed-password-1"), auth.seedUsers("seed-password-1")]);
    expect(count("admin")).toBe(1);
    expect(count("agency")).toBe(1);
    const names = (
      db.prepare("SELECT username FROM users WHERE role IN ('admin','agency') ORDER BY username").all() as {
        username: string;
      }[]
    ).map((r) => r.username);
    expect(names).toEqual(["admin", "agencia"]);
  });

  it("never creates logins for existing clients or professionals", async () => {
    createClient({
      name: "Marca Sem Login",
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
    });
    await auth.seedUsers("seed-password-1");
    expect(count("client")).toBe(0);
    expect(count("professional")).toBe(0);
  });

  it("logs in by username or e-mail and rejects disabled accounts", async () => {
    const created = await auth.createUser({
      password: "senha-forte-1",
      role: "client",
      refId: null,
      name: "Ana Souza",
      email: "Ana@Example.com",
    });
    expect((await auth.verifyLogin(created.username, "senha-forte-1")).ok).toBe(true);
    expect((await auth.verifyLogin("ana@example.com", "senha-forte-1")).ok).toBe(true);
    expect((await auth.verifyLogin("ana@example.com", "errada-123")).ok).toBe(false);
    auth.setUserDisabled(created.id, true);
    const disabled = await auth.verifyLogin("ana@example.com", "senha-forte-1");
    expect(disabled).toEqual({ ok: false, reason: "disabled" });
    await expect(
      auth.createUser({ password: "senha-forte-2", role: "client", refId: null, name: "Outra", email: "ana@example.com" })
    ).rejects.toBeInstanceOf(auth.EmailTakenError);
  });

  it("password change and admin reset bump the session version", async () => {
    const { id } = await auth.createUser({ password: "senha-forte-1", role: "professional", refId: null, name: "Beto" });
    const before = auth.getSessionState(id)!.sessionVersion;
    const changed = await auth.changePassword(id, "senha-forte-1", "senha-nova-22");
    expect(changed.ok).toBe(true);
    expect(auth.getSessionState(id)!.sessionVersion).toBe(before + 1);
    const temp = await auth.adminResetPassword(id);
    expect(temp).toMatch(/^[A-Za-z2-9]{4}-[A-Za-z2-9]{4}-[A-Za-z2-9]{4}$/);
    expect(auth.getSessionState(id)!.sessionVersion).toBe(before + 2);
    expect(auth.getUserById(id)!.mustChangePassword).toBe(true);
    expect((await auth.verifyLogin(auth.getUserById(id)!.username, temp!)).ok).toBe(true);
  });
});
