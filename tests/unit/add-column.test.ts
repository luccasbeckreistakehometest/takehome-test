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
