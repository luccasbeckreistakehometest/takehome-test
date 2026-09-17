import { describe, expect, it } from "vitest";
import {
  clickLearnings,
  CODE_RE,
  deviceOf,
  isBot,
  mergeUtm,
  newCode,
  normalizeBioSlug,
  referrerHost,
  sanitizeButtons,
  utmFor,
  validateDestUrl,
} from "@/lib/links-rules";

describe("tracked links", () => {
  it("makes 7-char codes from the safe alphabet", () => {
    const code = newCode((n) => Uint8Array.from({ length: n }, (_, i) => i * 37));
    expect(code).toMatch(CODE_RE);
    expect(code).not.toMatch(/[0O1lI]/);
  });

  it("accepts only http(s) destinations", () => {
    expect(validateDestUrl("https://loja.com/produto?cor=azul")).toEqual({ ok: true, url: "https://loja.com/produto?cor=azul" });
    expect(validateDestUrl("javascript:alert(1)").ok).toBe(false);
    expect(validateDestUrl("data:text/html,<b>x</b>").ok).toBe(false);
    expect(validateDestUrl("ftp://loja.com").ok).toBe(false);
    expect(validateDestUrl("https://user:pass@loja.com").ok).toBe(false);
    expect(validateDestUrl("loja.com").ok).toBe(false);
    expect(validateDestUrl("").ok).toBe(false);
  });

  it("adds UTM without touching existing parameters", () => {
    const utm = utmFor({ channel: "Instagram", campaign: null, postId: "p1", month: "2026-09" });
    expect(utm).toEqual({ utm_source: "instagram", utm_medium: "social", utm_campaign: "marqa-2026-09", utm_content: "p1" });
    const merged = new URL(mergeUtm("https://loja.com/produto?cor=azul&utm_source=newsletter", utm));
    expect(merged.searchParams.get("cor")).toBe("azul");
    expect(merged.searchParams.get("utm_source")).toBe("newsletter");
    expect(merged.searchParams.get("utm_medium")).toBe("social");
    expect(merged.searchParams.get("utm_content")).toBe("p1");
    expect(utmFor({ channel: "", campaign: "Dia dos Pais 2026" }).utm_campaign).toBe("dia-dos-pais-2026");
    expect(utmFor({}).utm_source).toBe("link-na-bio");
  });

  it("does not count robots, previews or command-line clients", () => {
    expect(isBot("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Mobile/15E148")).toBe(false);
    expect(isBot("Googlebot/2.1 (+http://www.google.com/bot.html)")).toBe(true);
    expect(isBot("facebookexternalhit/1.1")).toBe(true);
    expect(isBot("curl/8.4.0")).toBe(true);
    expect(isBot("Mozilla/5.0 HeadlessChrome/120")).toBe(true);
    expect(isBot("")).toBe(true);
    expect(isBot("Mozilla/5.0 HeadlessChrome/120", { testMode: true })).toBe(false);
    expect(isBot("curl/8.4.0", { testMode: true })).toBe(false);
    expect(isBot("Googlebot HeadlessChrome", { testMode: true })).toBe(true);
    expect(deviceOf("Mozilla/5.0 (Linux; Android 14) Mobile")).toBe("mobile");
    expect(deviceOf("Mozilla/5.0 (Macintosh)")).toBe("desktop");
    expect(referrerHost("https://www.instagram.com/p/abc")).toBe("instagram.com");
    expect(referrerHost("não é url")).toBe("");
  });

  it("normalizes bio slugs and keeps only known buttons", () => {
    expect(normalizeBioSlug("  Café São João!! ")).toBe("cafe-sao-joao");
    const known = new Set(["abc1234", "xyz9876"]);
    const buttons = sanitizeButtons(
      [
        { code: "abc1234", label: " Loja " },
        { code: "abc1234", label: "dup" },
        { code: "evil000", label: "x" },
        { code: "xyz9876" },
      ],
      known
    );
    expect(buttons).toEqual([
      { code: "abc1234", label: "Loja" },
      { code: "xyz9876", label: "" },
    ]);
  });

  it("reads clicks per format and hour from published posts with links", () => {
    const posts = [
      { id: "a", format: "Reels", scheduledFor: "2026-09-02T19:00", status: "published" },
      { id: "b", format: "Reels", scheduledFor: "2026-09-04T20:00", status: "published" },
      { id: "c", format: "Carrossel", scheduledFor: "2026-09-05T09:00", status: "published" },
      { id: "d", format: "Feed", scheduledFor: "2026-09-06T09:00", status: "scheduled" },
      { id: "e", format: "Feed", scheduledFor: "2026-09-07T09:00", status: "published" },
    ];
    const clicks = new Map([
      ["a", 30],
      ["b", 10],
      ["c", 50],
      ["d", 99],
    ]);
    const out = clickLearnings(posts, clicks);
    expect(out.postsWithLinks).toBe(3);
    expect(out.totalClicks).toBe(90);
    expect(out.byFormat[0]).toEqual({ key: "Carrossel", posts: 1, clicks: 50, avg: 50 });
    expect(out.byFormat[1]).toEqual({ key: "Reels", posts: 2, clicks: 40, avg: 20 });
    expect(out.byHour.map((r) => r.key).sort()).toEqual(["evening", "morning"]);
  });
});
