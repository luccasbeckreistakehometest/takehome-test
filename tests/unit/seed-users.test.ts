import { describe, expect, it } from "vitest";
import path from "path";
import os from "os";
import fs from "fs";

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "agencyhub-seed-"));
const { db } = await import("../../lib/db");
await import("../../lib/auth");

describe("seed users", () => {
  it("creates exactly one platform admin and one agency login on a fresh database", () => {
    const count = (role: string) => (db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = ?").get(role) as { n: number }).n;
    expect(count("admin")).toBe(1);
    expect(count("agency")).toBe(1);
    const names = (db.prepare("SELECT username FROM users WHERE role IN ('admin','agency') ORDER BY username").all() as { username: string }[]).map((r) => r.username);
    expect(names).toEqual(["admin", "agencia"]);
  });
});
