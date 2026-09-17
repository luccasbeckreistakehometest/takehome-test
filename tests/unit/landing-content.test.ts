import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";
import { AGENCY, CLIENT, GENERAL, PRO, PREPAID_FALLBACK, landingFor, type LandingConfig } from "@/lib/landing-content";

const CONFIGS: [string, LandingConfig][] = [
  ["geral", GENERAL],
  ["agencia", AGENCY],
  ["marca", CLIENT],
  ["profissional", PRO],
];

// todas as strings de um objeto (recursivo)
function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

const routeExists = (href: string) => {
  const route = href.split(/[?#]/)[0];
  return existsSync(path.join(process.cwd(), "app", route === "/" ? "" : route, "page.tsx"));
};

describe("landing content", () => {
  it("every audience has a showcase whose cards link to real pages, in pt and en", () => {
    for (const [name, config] of CONFIGS) {
      for (const lang of ["pt", "en"] as const) {
        const showcase = config.content[lang].showcase;
        expect(showcase, `${name}/${lang}`).toBeDefined();
        expect(showcase!.items.length).toBeGreaterThanOrEqual(3);
        for (const item of showcase!.items) expect(routeExists(item.href), `${name}/${lang} ${item.href}`).toBe(true);
        for (const a of config.content[lang].audiences ?? []) expect(routeExists(a.href), a.href).toBe(true);
      }
      // mesmas vitrines nos dois idiomas
      expect(config.content.en.showcase!.items.map((i) => i.demo)).toEqual(config.content.pt.showcase!.items.map((i) => i.demo));
    }
  });

  it("the agency funnel tells the month and compares with today's way", () => {
    expect(AGENCY.content.pt.timeline!.steps).toHaveLength(6);
    expect(AGENCY.content.en.timeline!.steps).toHaveLength(6);
    expect(AGENCY.content.pt.compare!.rows).toHaveLength(5);
    expect(AGENCY.content.pt.faq.map((f) => f.q)).toContain("O cliente precisa criar conta pra aprovar?");
    expect(CLIENT.content.pt.faq.map((f) => f.q)).toContain("Isso substitui uma agência?");
  });

  it("makes no claims the product can't back", () => {
    const forbidden = [
      /escrow|cust[oó]dia/i,
      /garantid|guarantee/i,
      /revolucion|revolutionary/i,
      /dom[ií]nio pr[oó]prio(?! ainda não)/i,
      /custom domains?\b(?! are not)/i,
      /sem taxa de intermedia|no (intermediation|middleman) fee/i,
      /\b(canva|hootsuite|mlabs|etus|rd station|trello|asana|chatgpt)\b/i,
      /\b100 ?%/,
    ];
    for (const [name, config] of CONFIGS) {
      for (const text of strings(config.content)) {
        for (const re of forbidden) expect(re.test(text), `${name}: "${text}" matches ${re}`).toBe(false);
      }
    }
  });

  it("falls back to prepaid wording when card subscriptions are off", () => {
    const all = CONFIGS.flatMap(([, c]) => strings(c.content));
    for (const key of Object.keys(PREPAID_FALLBACK)) expect(all, key).toContain(key);
    for (const [name, config] of CONFIGS) {
      const off = landingFor(config, false);
      for (const lang of ["pt", "en"] as const) {
        const texts = [off.content[lang].trust, ...off.content[lang].faq.map((f) => f.a)];
        for (const t of texts) expect(/assinatura|assine|subscri/i.test(t), `${name}/${lang}: ${t}`).toBe(false);
      }
      expect(landingFor(config, true)).toBe(config);
    }
    expect(GENERAL.content.en.faq.some((f) => f.a.includes("billed in BRL"))).toBe(true);
  });
});
