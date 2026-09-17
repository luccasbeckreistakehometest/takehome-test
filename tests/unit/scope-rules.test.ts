import { describe, expect, it } from "vitest";
import {
  PACKAGE_PRESETS,
  consumption,
  formatUnit,
  guessItem,
  packageUsage,
  previousMonth,
  quotaCheck,
  sanitizePackage,
  type ClientPackage,
} from "@/lib/scope-rules";

const pkg: ClientPackage = sanitizePackage({ items: PACKAGE_PRESETS[1].items, rolloverUnused: false });
const post = (scheduledFor: string, format = "Feed", status = "scheduled") => ({ scheduledFor, format, status });

describe("scope rules", () => {
  it("maps calendar formats to package units", () => {
    expect(formatUnit("Reels")).toBe("reel");
    expect(formatUnit("Vídeo")).toBe("reel");
    expect(formatUnit("Carrossel")).toBe("carrossel");
    expect(formatUnit("Stories")).toBe("story");
    expect(formatUnit("")).toBe("post");
    expect(formatUnit("Feed")).toBe("post");
  });

  it("counts only the month, skipping canceled posts", () => {
    const counts = consumption("2026-09", {
      posts: [post("2026-09-01T10:00"), post("2026-09-30T23:00", "Reels"), post("2026-10-01T00:00"), post("2026-08-31T23:59"), post("2026-09-10T10:00", "Feed", "canceled")],
      projects: [{ createdAt: "2026-09-02T00:00:00.000Z" }, { createdAt: "2026-08-02T00:00:00.000Z" }],
      meetings: [{ scheduledAt: "2026-09-05T13:00" }],
      reports: [{ month: "2026-09" }, { month: "2026-08" }],
    });
    expect(counts).toMatchObject({ post: 1, reel: 1, demanda: 1, "reunião": 1, "relatório": 1, story: 0 });
  });

  it("computes the previous month across the year boundary", () => {
    expect(previousMonth("2026-01")).toBe("2025-12");
    expect(previousMonth("2026-09")).toBe("2026-08");
  });

  it("shows usage and overflow on the item", () => {
    const counts = consumption("2026-09", { posts: Array.from({ length: 13 }, (_, i) => post(`2026-09-${String(i + 1).padStart(2, "0")}T10:00`)), projects: [], meetings: [], reports: [] });
    const rows = packageUsage(pkg, counts);
    const posts = rows.find((r) => r.key === "post")!;
    expect(posts).toMatchObject({ used: 13, allowance: 12, remaining: 0 });
    expect(rows.find((r) => r.key === "reel")).toMatchObject({ used: 0, remaining: 4 });
  });

  it("rolls over what was left last month when enabled", () => {
    const withRollover = { ...pkg, rolloverUnused: true };
    const prev = consumption("2026-08", { posts: Array.from({ length: 10 }, () => post("2026-08-05T10:00")), projects: [], meetings: [], reports: [] });
    const now = consumption("2026-09", { posts: Array.from({ length: 12 }, () => post("2026-09-05T10:00")), projects: [], meetings: [], reports: [] });
    const row = packageUsage(withRollover, now, prev).find((r) => r.key === "post")!;
    expect(row).toMatchObject({ allowance: 14, used: 12, remaining: 2 });
    expect(packageUsage(pkg, now, prev).find((r) => r.key === "post")!.allowance).toBe(12);
  });

  it("turns what passes the quota into a priced extra", () => {
    expect(quotaCheck({ remaining: 0, extraPrice: 120 }, 1)).toEqual({ inPackage: false, extraQty: 1, extraTotal: 120, remaining: 0 });
    expect(quotaCheck({ remaining: 1, extraPrice: 120 }, 3)).toEqual({ inPackage: false, extraQty: 2, extraTotal: 240, remaining: 1 });
    expect(quotaCheck({ remaining: 5, extraPrice: 120 }, 2).inPackage).toBe(true);
    expect(quotaCheck({ remaining: 5, extraPrice: 120 }, 0).extraQty).toBe(0);
  });

  it("sanitizes package input", () => {
    const clean = sanitizePackage({
      items: [
        { key: "Pósts Extra!", label: " Posts ", unit: "post", qty: -3, extraPrice: 99.999 },
        { key: "posts_extra", label: "dup", unit: "post", qty: 2, extraPrice: 1 },
        { key: "x", label: "bad", unit: "podcast", qty: 1, extraPrice: 1 },
      ],
      rolloverUnused: "yes",
    });
    expect(clean.items).toEqual([{ key: "posts_extra", label: "Posts", unit: "post", qty: 0, extraPrice: 100 }]);
    expect(clean.rolloverUnused).toBe(false);
  });

  it("guesses the item from keywords (menu pre-selection)", () => {
    expect(guessItem("mais um post para o Dia dos Pais", pkg)).toMatchObject({ itemKey: "post", qty: 1 });
    expect(guessItem("preciso de 2 reels do evento", pkg)).toMatchObject({ itemKey: "reel", qty: 2 });
    expect(guessItem("uma reunião de alinhamento", pkg).itemKey).toBe("reuniao");
    expect(guessItem("fotos novas do cardápio", pkg)).toMatchObject({ itemKey: "demanda", confidence: 0.3 });
  });
});
