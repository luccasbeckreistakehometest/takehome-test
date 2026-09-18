// Rampa de marca (whitelabel) — docs/DESIGN.md §5.4.
//
// A agência escolhe UM hex. Esse hex pode ser #FFD400, #FFFFFF ou #000000, e o
// sistema não pode "torcer para dar certo": ele deriva seis tokens com piso de
// contraste verificado. A derivação mexe SÓ no L do OKLCH — a matiz é da
// agência, não nossa — e corta o croma para o máximo em gamut naquele L por
// busca binária. Quando a cor crua já passa no piso, ela é usada como está: a
// marca aparece de verdade sempre que pode.
//
// Módulo puro (sem DOM, sem React): roda no servidor a cada request e nos
// testes unitários que verificam os pisos.

export type Hex = string;

export type BrandRamp = {
  /** o hex cru, normalizado — campo grande, fundo de capa, marca d'água */
  brand: Hex;
  /** fundo do botão primário / barra de capa: preto OU branco alcança 4,5:1 */
  brandSolid: Hex;
  /** o que vencer sobre brandSolid */
  brandInk: Hex;
  /** link, valor em destaque, marcador ativo — 4,5:1 contra a surface do tema */
  brandText: Hex;
  /** borda de seleção, anel de foco, sublinhado de aba — 3:1 */
  brandEdge: Hex;
  /** campo chapado de destaque — nunca gradiente */
  brandWash: Hex;
};

/** Tinta n-950 e n-0 da §5.1: os dois únicos candidatos a tinta de botão. */
export const INK_DARK = "#100F0E";
export const INK_LIGHT = "#FFFFFF";

/** Surfaces da §5.2 — é contra elas que brandText/brandEdge são medidos. */
export const SURFACE_LIGHT = "#FFFFFF"; // n-0
export const SURFACE_DARK = "#171514"; // n-900

export const FLOOR_TEXT = 4.5; // AA
export const FLOOR_EDGE = 3.0; // WCAG 1.4.11

/** Abaixo disto a cor é acromática: não há matiz para preservar. */
const ACHROMATIC = 0.02;

type Rgb = { r: number; g: number; b: number }; // 0..1
type Oklch = { l: number; c: number; h: number };

export function parseHex(hex: string): Rgb | null {
  let s = hex.trim().replace(/^#/, "");
  if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
  if (!/^[0-9a-fA-F]{6}$/.test(s)) return null;
  const n = parseInt(s, 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

function toHex({ r, g, b }: Rgb): Hex {
  const ch = (v: number) =>
    Math.round(Math.min(1, Math.max(0, v)) * 255)
      .toString(16)
      .padStart(2, "0")
      .toUpperCase();
  return `#${ch(r)}${ch(g)}${ch(b)}`;
}

const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
const toGamma = (v: number) => (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);

export function relativeLuminance(rgb: Rgb): number {
  const r = toLinear(rgb.r);
  const g = toLinear(rgb.g);
  const b = toLinear(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.1 — razão de contraste entre dois hexes. */
export function contrast(a: string, b: string): number {
  const ra = parseHex(a);
  const rb = parseHex(b);
  if (!ra || !rb) return 1;
  const la = relativeLuminance(ra);
  const lb = relativeLuminance(rb);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

// ---------- OKLab / OKLCH (Björn Ottosson) ----------

function rgbToOklch(rgb: Rgb): Oklch {
  const r = toLinear(rgb.r);
  const g = toLinear(rgb.g);
  const b = toLinear(rgb.b);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const c = Math.sqrt(A * A + B * B);
  let h = (Math.atan2(B, A) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l: L, c, h };
}

function oklchToRgbRaw({ l, c, h }: Oklch): Rgb {
  const hr = (h * Math.PI) / 180;
  const A = c * Math.cos(hr);
  const B = c * Math.sin(hr);
  const l_ = (l + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m_ = (l - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s_ = (l - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return {
    r: toGamma(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_),
    g: toGamma(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_),
    b: toGamma(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_),
  };
}

const inGamut = ({ r, g, b }: Rgb) =>
  r >= -0.0005 && r <= 1.0005 && g >= -0.0005 && g <= 1.0005 && b >= -0.0005 && b <= 1.0005;

/**
 * Corta o croma para o máximo em gamut naquele L por busca binária (18 passos
 * ≈ 1e-6 de precisão em C, bem abaixo de um degrau de 8 bits).
 */
function clipToGamut(target: Oklch): Rgb {
  if (inGamut(oklchToRgbRaw(target))) return oklchToRgbRaw(target);
  let lo = 0;
  let hi = target.c;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut(oklchToRgbRaw({ ...target, c: mid }))) lo = mid;
    else hi = mid;
  }
  return oklchToRgbRaw({ ...target, c: lo });
}

/** Mesma matiz, L pedido, croma cortado ao máximo em gamut. */
export function atLightness(base: Oklch, l: number): Hex {
  return toHex(clipToGamut({ l: Math.min(1, Math.max(0, l)), c: base.c, h: base.h }));
}

// ---------- Derivação ----------

/**
 * Procura, subindo e descendo o L a partir da cor crua, o primeiro tom que
 * satisfaz `ok`. Anda em passos de 0,005 (≈200 tentativas por direção) e
 * devolve o de menor deslocamento — a marca muda o mínimo necessário.
 */
function nearestPassing(base: Oklch, ok: (hex: Hex) => boolean, prefer?: "up" | "down"): Hex {
  const raw = atLightness(base, base.l);
  if (ok(raw)) return raw;
  const step = 0.005;
  const dirs: Array<1 | -1> = prefer === "up" ? [1] : prefer === "down" ? [-1] : [1, -1];
  for (let d = step; d <= 1; d += step) {
    for (const dir of dirs) {
      const l = base.l + dir * d;
      if (l < 0 || l > 1) continue;
      const hex = atLightness(base, l);
      if (ok(hex)) return hex;
    }
  }
  // Acromático puro em fundo do mesmo tom: não existe saída com matiz.
  return prefer === "down" ? INK_DARK : INK_LIGHT;
}

/** A tinta que vence sobre um fundo: preto n-950 ou branco n-0. */
export function inkFor(solid: Hex): Hex {
  return contrast(solid, INK_DARK) >= contrast(solid, INK_LIGHT) ? INK_DARK : INK_LIGHT;
}

/**
 * Deriva a rampa de uma marca para UM tema.
 *
 * `theme` decide a surface contra a qual brandText/brandEdge são medidos e o L
 * do brandWash. brandSolid/brandInk não dependem do tema: o botão primário é a
 * mesma peça nos dois (é a tinta em cima dele que muda, e ela é escolhida por
 * contraste, não por tema).
 */
export function brandRamp(hex: string, theme: "light" | "dark"): BrandRamp {
  const rgb = parseHex(hex) ?? parseHex("#F76B15")!;
  const brand = toHex(rgb);
  const base = rgbToOklch(rgb);
  const surface = theme === "light" ? SURFACE_LIGHT : SURFACE_DARK;
  const achromatic = base.c < ACHROMATIC;

  // Sólido: preto OU branco alcança 4,5:1 em cima dele.
  const solid = nearestPassing(base, (h) => contrast(h, inkFor(h)) >= FLOOR_TEXT);
  const ink = inkFor(solid);

  // Texto e borda: afastam-se da surface do tema corrente.
  const away = theme === "light" ? "down" : "up";
  const fallbackInk = theme === "light" ? INK_DARK : INK_LIGHT;
  const text = achromatic
    ? contrast(brand, surface) >= FLOOR_TEXT
      ? brand
      : fallbackInk
    : nearestPassing(base, (h) => contrast(h, surface) >= FLOOR_TEXT, away);
  const edge = achromatic
    ? contrast(brand, surface) >= FLOOR_EDGE
      ? brand
      : fallbackInk
    : nearestPassing(base, (h) => contrast(h, surface) >= FLOOR_EDGE, away);

  // Campo chapado: matiz a L alto (claro) ou baixo (escuro), croma limitado.
  // Não é gradiente e não carrega texto essencial sozinho.
  const washL = theme === "light" ? 0.965 : 0.24;
  const washC = Math.min(base.c, theme === "light" ? 0.03 : 0.045);
  const wash = toHex(clipToGamut({ l: washL, c: washC, h: base.h }));

  return { brand, brandSolid: solid, brandInk: ink, brandText: text, brandEdge: edge, brandWash: wash };
}

/**
 * As variáveis CSS emitidas no <html> — exatamente onde hoje sai o `--accent`
 * cru. Os tokens de tema (`-light`/`-dark`) existem porque o tema é escolhido
 * no cliente, antes da pintura: o CSS seleciona um par, o servidor manda os
 * dois. Devolve `Record<string, string>` para ir direto no `style` do React.
 */
export function brandStyle(hex: string): Record<string, string> {
  const light = brandRamp(hex, "light");
  const dark = brandRamp(hex, "dark");
  return {
    "--brand": light.brand,
    "--brand-solid": light.brandSolid,
    "--brand-ink": light.brandInk,
    "--brand-text-light": light.brandText,
    "--brand-text-dark": dark.brandText,
    "--brand-edge-light": light.brandEdge,
    "--brand-edge-dark": dark.brandEdge,
    "--brand-wash-light": light.brandWash,
    "--brand-wash-dark": dark.brandWash,
  };
}
