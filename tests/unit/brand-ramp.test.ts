import { describe, expect, it } from "vitest";
import {
  brandRamp,
  brandStyle,
  contrast,
  FLOOR_EDGE,
  FLOOR_TEXT,
  INK_DARK,
  INK_LIGHT,
  parseHex,
  SURFACE_DARK,
  SURFACE_LIGHT,
} from "@/lib/brand-ramp";

// docs/DESIGN.md §5.4 — o teste que a especificação exige: para um conjunto que
// inclui os casos patológicos, a tinta do botão vence o sólido por 4,5:1, o
// texto vence a surface do tema por 4,5:1 e a borda por 3:1, NOS DOIS TEMAS.
const BRANDS = [
  "#F76B15", // Marqa
  "#0F62FE",
  "#00A86B",
  "#FFD400", // amarelo: nenhuma tinta branca sobrevive
  "#E91E63", // rosa: prova que a derivação é necessária (cru dá 4,40:1)
  "#7C3AED",
  "#00E5FF",
  "#FFFFFF", // limite: não existe texto branco legível em papel branco
  "#000000",
];

describe("rampa de marca — pisos de contraste", () => {
  for (const hex of BRANDS) {
    for (const theme of ["light", "dark"] as const) {
      it(`${hex} no tema ${theme} passa nos três pisos`, () => {
        const r = brandRamp(hex, theme);
        const surface = theme === "light" ? SURFACE_LIGHT : SURFACE_DARK;
        expect(contrast(r.brandSolid, r.brandInk)).toBeGreaterThanOrEqual(FLOOR_TEXT);
        expect(contrast(r.brandText, surface)).toBeGreaterThanOrEqual(FLOOR_TEXT);
        expect(contrast(r.brandEdge, surface)).toBeGreaterThanOrEqual(FLOOR_EDGE);
        expect(r.brandInk === INK_DARK || r.brandInk === INK_LIGHT).toBe(true);
      });
    }
  }
});

describe("rampa de marca — a marca aparece quando pode", () => {
  it("usa a cor crua no sólido quando ela já passa", () => {
    // 6,45:1 com tinta preta: não há por que mexer no laranja da Marqa.
    expect(brandRamp("#F76B15", "light").brandSolid).toBe("#F76B15");
    expect(brandRamp("#FFD400", "light").brandSolid).toBe("#FFD400");
  });

  it("desloca o sólido só quando a cor crua reprova (#E91E63)", () => {
    const raw = contrast("#E91E63", INK_DARK);
    expect(raw).toBeLessThan(FLOOR_TEXT); // 4,40:1 — o motivo de existir a derivação
    const r = brandRamp("#E91E63", "light");
    expect(r.brandSolid).not.toBe("#E91E63");
    expect(contrast(r.brandSolid, r.brandInk)).toBeGreaterThanOrEqual(FLOOR_TEXT);
  });

  it("preserva a matiz ao mover o L (laranja continua laranja)", () => {
    const r = brandRamp("#F76B15", "light");
    const t = parseHex(r.brandText)!;
    expect(t.r).toBeGreaterThan(t.g);
    expect(t.g).toBeGreaterThan(t.b);
  });

  it("marca branca vira campo, não texto", () => {
    const r = brandRamp("#FFFFFF", "light");
    expect(r.brandSolid).toBe("#FFFFFF");
    expect(r.brandInk).toBe(INK_DARK);
    expect(r.brandText).toBe(INK_DARK); // não existe branco legível em papel branco
  });

  it("marca preta continua preta no claro e clareia no escuro", () => {
    expect(brandRamp("#000000", "light").brandText).toBe("#000000");
    expect(brandRamp("#000000", "dark").brandText).toBe(INK_LIGHT);
  });

  it("hex inválido cai na marca da plataforma em vez de quebrar", () => {
    expect(brandRamp("não é cor", "light").brandSolid).toBe("#F76B15");
    expect(brandRamp("", "dark").brandSolid).toBe("#F76B15");
  });

  it("aceita hex de 3 dígitos e sem #", () => {
    expect(brandRamp("#f00", "light").brand).toBe("#FF0000");
    expect(brandRamp("00A86B", "light").brand).toBe("#00A86B");
  });

  it("é determinística", () => {
    expect(brandRamp("#7C3AED", "dark")).toEqual(brandRamp("#7C3AED", "dark"));
  });
});

describe("brandStyle — o que sai no <html>", () => {
  it("emite os dois temas, porque o tema é escolhido antes da pintura", () => {
    const s = brandStyle("#F76B15");
    expect(Object.keys(s).sort()).toEqual(
      [
        "--brand",
        "--brand-edge-dark",
        "--brand-edge-light",
        "--brand-ink",
        "--brand-solid",
        "--brand-text-dark",
        "--brand-text-light",
        "--brand-wash-dark",
        "--brand-wash-light",
      ].sort(),
    );
    for (const v of Object.values(s)) expect(v).toMatch(/^#[0-9A-F]{6}$/);
  });

  it("o wash é campo chapado claro no tema claro e escuro no escuro", () => {
    const s = brandStyle("#0F62FE");
    expect(contrast(s["--brand-wash-light"], SURFACE_LIGHT)).toBeLessThan(1.3);
    expect(contrast(s["--brand-wash-dark"], SURFACE_DARK)).toBeLessThan(1.6);
  });
});
