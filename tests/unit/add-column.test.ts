import { describe, expect, it } from "vitest";
import path from "path";
import os from "os";
import fs from "fs";

// Importing lib/db opens the module's own database; point it at a throwaway directory.
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "agencyhub-unit-"));
const { addColumn } = await import("../../lib/db");

type Fake = Parameters<typeof addColumn>[0];
function fake(columns: string[], execError?: Error) {
  const execs: string[] = [];
  const database = {
    prepare: () => ({ all: () => columns.map((name) => ({ name })) }),
    exec: (sql: string) => {
      execs.push(sql);
      if (execError) throw execError;
    },
  } as unknown as Fake;
  return { database, execs };
}

describe("addColumn (migration race)", () => {
  it("adds a missing column", () => {
    const { database, execs } = fake(["id"]);
    addColumn(database, "clients", "monthlyFee", "REAL NOT NULL DEFAULT 0");
    expect(execs).toEqual(["ALTER TABLE clients ADD COLUMN monthlyFee REAL NOT NULL DEFAULT 0"]);
  });

  it("does nothing when the column exists or the table does not exist yet", () => {
    const present = fake(["id", "monthlyFee"]);
    addColumn(present.database, "clients", "monthlyFee", "REAL");
    const absentTable = fake([]);
    addColumn(absentTable.database, "clients", "monthlyFee", "REAL");
    expect([...present.execs, ...absentTable.execs]).toEqual([]);
  });

  it("tolerates another build worker adding the same column between the check and the ALTER", () => {
    // What `next build` hit: this worker saw the column missing, another worker added it first.
    const { database } = fake(["id"], new Error("duplicate column name: monthlyFee"));
    expect(() => addColumn(database, "clients", "monthlyFee", "REAL")).not.toThrow();
  });

  it("still surfaces any other failure", () => {
    const { database } = fake(["id"], new Error("database is locked"));
    expect(() => addColumn(database, "clients", "monthlyFee", "REAL")).toThrow(/locked/);
  });
});

describe("enableWal", () => {
  it("retries while another worker holds the lock, then switches once", async () => {
    const { enableWal } = await import("../../lib/sqlite-migrate");
    let mode = "delete";
    let busyLeft = 2;
    const calls: string[] = [];
    const fake = {
      pragma: (source: string) => {
        calls.push(source);
        if (source === "journal_mode") return mode;
        if (busyLeft > 0) {
          busyLeft -= 1;
          throw Object.assign(new Error("database is locked"), { code: "SQLITE_BUSY" });
        }
        mode = "wal";
        return "wal";
      },
    };
    enableWal(fake as never, 2_000);
    expect(mode).toBe("wal");
    expect(calls.filter((c) => c === "journal_mode = WAL")).toHaveLength(3);
    // já em WAL: não tenta trocar de novo
    calls.length = 0;
    enableWal(fake as never);
    expect(calls).toEqual(["journal_mode"]);
    // outro erro sobe na hora
    const broken = { pragma: () => { throw Object.assign(new Error("disk I/O error"), { code: "SQLITE_IOERR" }); } };
    expect(() => enableWal(broken as never)).toThrow("disk I/O error");
  });
});
