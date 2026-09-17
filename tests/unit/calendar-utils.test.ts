import { describe, expect, it } from "vitest";
import { addDays, addMonths, dateKey, findContentGaps, groupByDay, monthGrid, weekOf } from "@/lib/calendar-utils";

describe("dateKey", () => {
  it("reads datetime-local strings by prefix and converts ISO to the local day", () => {
    expect(dateKey("2026-09-18T10:00")).toBe("2026-09-18");
    expect(dateKey("2026-09-18")).toBe("2026-09-18");
    const local = new Date(2026, 8, 18, 23, 30);
    expect(dateKey(local.toISOString())).toBe("2026-09-18");
  });
});

describe("grid", () => {
  it("builds Sunday-first weeks that cover the whole month", () => {
    const rows = monthGrid("2026-09-15");
    expect(rows[0][0].key).toBe("2026-08-30"); // 1º de setembro de 2026 é terça
    expect(rows[0][0].inMonth).toBe(false);
    expect(rows[0][2]).toEqual({ key: "2026-09-01", inMonth: true });
    const last = rows[rows.length - 1];
    expect(last.some((d) => d.key === "2026-09-30")).toBe(true);
    expect(rows.length).toBe(5);
    expect(rows.every((r) => r.length === 7)).toBe(true);
  });
  it("uses six rows when the month needs them", () => {
    expect(monthGrid("2026-08-10").length).toBe(6); // agosto/2026 começa no sábado
  });
  it("week of a date runs Sunday to Saturday", () => {
    expect(weekOf("2026-09-17")).toEqual(["2026-09-13", "2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18", "2026-09-19"]);
  });
  it("adds days and months across boundaries", () => {
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-01");
    expect(addMonths("2026-12-05", 1)).toBe("2027-01-01");
  });
});

describe("gaps", () => {
  const days = ["2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18", "2026-09-19", "2026-09-20"];
  const posts = [
    { id: "1", scheduledFor: "2026-09-14T10:00", status: "published" as const },
    { id: "2", scheduledFor: "2026-09-16T10:00", status: "scheduled" as const },
    { id: "3", scheduledFor: "2026-09-19T10:00", status: "canceled" as const },
  ];
  it("lists future empty days and ignores canceled posts", () => {
    const gaps = findContentGaps(posts, days, "2026-09-15");
    expect(gaps.emptyDays).toEqual(["2026-09-15", "2026-09-17", "2026-09-18", "2026-09-19", "2026-09-20"]);
  });
  it("flags streaks of 3+ empty days", () => {
    const gaps = findContentGaps(posts, days, "2026-09-15");
    expect(gaps.streaks).toEqual([{ start: "2026-09-17", end: "2026-09-20", length: 4 }]);
  });
  it("does not count days already gone", () => {
    expect(findContentGaps(posts, days, "2026-09-21").emptyDays).toEqual([]);
  });
  it("groups posts by day sorted by time", () => {
    const grouped = groupByDay([
      { id: "b", scheduledFor: "2026-09-16T15:00", status: "scheduled" as const },
      { id: "a", scheduledFor: "2026-09-16T09:00", status: "draft" as const },
    ]);
    expect(grouped.get("2026-09-16")?.map((p) => p.id)).toEqual(["a", "b"]);
  });
});
