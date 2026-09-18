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

// Diferenciais das rodadas 1 e 2. Cada um precisa estar NOMEADO no funil de
// quem pode usá-lo, nos dois idiomas, e ficar de FORA do funil de quem não
// pode: atendente, horas e proposta são abas/páginas só de agência
// (lib/workspace-tabs.ts, app/finance, app/growth), então prometê-las para uma
// marca seria vender o que ela não vai encontrar. `ships` é o código que
// entrega a promessa — se a rota sumir, o texto cai junto.
const FEATURES: { name: string; pt: RegExp; en: RegExp; on: string[]; off: string[]; ships: string[] }[] = [
  {
    name: "painel de público",
    pt: /painel de público/i,
    en: /audience panel/i,
    on: ["geral", "agencia", "marca"],
    off: [],
    ships: ["api/clients/[id]/panel/route.ts", "calendar/page.tsx"],
  },
  {
    name: "pulso e NPS",
    pt: /\bNPS\b/,
    en: /\bNPS\b/,
    on: ["geral", "agencia", "marca"],
    off: ["profissional"],
    ships: ["api/pulse/overview/route.ts", "api/clients/[id]/pulse/route.ts"],
  },
  {
    name: "proposta pública",
    pt: /proposta/i,
    en: /proposal/i,
    on: ["geral", "agencia"],
    off: ["marca", "profissional"],
    ships: ["proposta/[token]/page.tsx", "growth/page.tsx"],
  },
  {
    name: "link na bio",
    pt: /link na bio/i,
    en: /link in bio/i,
    on: ["geral", "agencia", "marca"],
    off: [],
    ships: ["links/page.tsx", "b/[slug]/page.tsx", "l/[code]/route.ts"],
  },
  {
    name: "atendente de WhatsApp",
    pt: /atendente/i,
    en: /attendant/i,
    on: ["geral", "agencia"],
    off: ["marca", "profissional"],
    ships: ["api/clients/[id]/attendant/route.ts"],
  },
  {
    name: "calendário",
    pt: /calendário/i,
    en: /calendar/i,
    on: ["geral", "agencia", "marca"],
    off: [],
    ships: ["calendar/page.tsx"],
  },
  {
    name: "horas e margem",
    pt: /horas e margem/i,
    en: /hours and margin/i,
    on: ["agencia"],
    off: ["marca", "profissional"],
    ships: ["finance/page.tsx", "api/finance/margin/route.ts"],
  },
  {
    name: "guardião da voz da marca",
    pt: /voz da marca/i,
    en: /brand voice/i,
    on: ["geral", "agencia", "marca"],
    off: [],
    ships: ["api/clients/[id]/brand-voice/check/route.ts", "api/clients/[id]/brand-voice/rewrite/route.ts"],
  },
  {
    name: "o que funciona",
    pt: /o que funciona/i,
    en: /what works/i,
    on: ["geral", "agencia", "marca"],
    off: [],
    ships: ["api/clients/[id]/learnings/route.ts"],
  },
];

const configNamed = (name: string) => CONFIGS.find(([n]) => n === name)![1];
const textOf = (name: string, lang: "pt" | "en") => strings(configNamed(name).content[lang]).join("\n");

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

  it("names every shipped differentiator on the funnels that can use it, in pt and en", () => {
    for (const f of FEATURES) {
      for (const file of f.ships) {
        expect(existsSync(path.join(process.cwd(), "app", file)), `${f.name}: falta ${file}`).toBe(true);
      }
      for (const page of f.on) {
        expect(f.pt.test(textOf(page, "pt")), `${f.name} não aparece em ${page}/pt`).toBe(true);
        expect(f.en.test(textOf(page, "en")), `${f.name} missing on ${page}/en`).toBe(true);
      }
      for (const page of f.off) {
        expect(f.pt.test(textOf(page, "pt")), `${f.name} não pode ser prometido em ${page}/pt`).toBe(false);
        expect(f.en.test(textOf(page, "en")), `${f.name} must not be promised on ${page}/en`).toBe(false);
      }
    }
  });

  it("keeps every benefits grid a full multiple of three", () => {
    for (const [name, config] of CONFIGS) {
      for (const lang of ["pt", "en"] as const) {
        const benefits = config.content[lang].benefits;
        expect(benefits.length % 3, `${name}/${lang}: ${benefits.length} cards`).toBe(0);
        // mesmos cards nos dois idiomas, na mesma ordem
        expect(config.content.en.benefits.map((b) => b.icon)).toEqual(config.content.pt.benefits.map((b) => b.icon));
      }
    }
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
      // o radar é uma simulação (ver lib/ai-visibility-rules disclaimer):
      // a landing não pode prometer o que a IA de fato responde
      /agora você sabe|now you know/i,
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
