import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { FILE_RESPONSE_HEADERS } from "../../lib/uploads";

describe("next.config", () => {
  // A imagem de produção (Dockerfile) copia só o next.config.ts: um import
  // local derruba o container no boot ("Cannot find module").
  it("imports only packages, never local files", () => {
    const source = fs.readFileSync(path.join(__dirname, "../../next.config.ts"), "utf8");
    const specifiers = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
    expect(specifiers.length).toBeGreaterThan(0);
    expect(specifiers.filter((s) => s.startsWith(".") || s.startsWith("@/"))).toEqual([]);
  });

  it("serves uploaded files with the same sandbox CSP the routes declare", () => {
    const source = fs.readFileSync(path.join(__dirname, "../../next.config.ts"), "utf8");
    const fileCsp = source.match(/const FILE_CSP = "([^"]+)"/)?.[1];
    expect(fileCsp).toBe(FILE_RESPONSE_HEADERS["Content-Security-Policy"]);
  });
});
