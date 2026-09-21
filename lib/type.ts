// Tipografia — docs/DESIGN.md §3.
//
// O eixo óptico do Fraunces (`opsz`) precisa acompanhar o TAMANHO RENDERIZADO:
// é ele que faz uma manchete de 72px e um olho de 11px serem desenhos
// diferentes, e é o único argumento honesto para chamar isto de tipografia
// editorial na web. Uma manchete escrita à mão com `text-[56px]` deixa o opsz
// no padrão (14) e a letra some.
//
// Por isso existem exatamente duas formas de usar display no produto:
//   1. as classes .d1 .d2 .d3 .d4 de globals.css (a escala documentada), ou
//   2. displayStyle(px) aqui, para um tamanho fora da escala.
// Nada de escrever font-size de display na mão.

import type { CSSProperties } from "react";

export type DisplayOptions = {
  /** 400–600 apenas: a manchete pesa pelo tamanho, não pelo peso. */
  weight?: 400 | 500 | 600;
  /** 0 no app e nos documentos; até 20 na página pública e na capa. */
  soft?: number;
  /** Só a partir de 40px; abaixo disso vira ruído. */
  wonk?: boolean;
  lineHeight?: number;
  tracking?: string;
};

/** opsz do Fraunces vive em 9–144 (conferido no catálogo do next/font). */
export const clampOpsz = (px: number) => Math.min(144, Math.max(9, Math.round(px)));

/**
 * Tracking da escala: a manchete fecha, o texto abre. Interpolação linear entre
 * os passos documentados da §3.2 (72px → −0,022em, 24px → −0,008em, 14px → 0).
 */
function trackingFor(px: number): string {
  if (px >= 72) return "-0.022em";
  if (px >= 48) return "-0.018em";
  if (px >= 32) return "-0.012em";
  if (px >= 24) return "-0.008em";
  if (px >= 18) return "-0.004em";
  return "0em";
}

/** Altura de linha da escala de display: aperta conforme o corpo cresce. */
function leadingFor(px: number): number {
  if (px >= 64) return px;
  if (px >= 40) return Math.round(px * 1.05);
  return Math.round(px * 1.15);
}

/**
 * Estilo completo de um passo de display, com o eixo óptico já correto.
 *
 *   <h1 style={displayStyle(56, { soft: 20 })}>…</h1>
 */
export function displayStyle(px: number, opts: DisplayOptions = {}): CSSProperties {
  const { weight = 500, soft = 0, wonk = px >= 40, lineHeight, tracking } = opts;
  return {
    fontFamily:
      "var(--font-fraunces), 'Iowan Old Style', 'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif",
    fontSize: `${px}px`,
    lineHeight: `${lineHeight ?? leadingFor(px)}px`,
    letterSpacing: tracking ?? trackingFor(px),
    fontWeight: weight,
    fontVariationSettings: `"opsz" ${clampOpsz(px)}, "SOFT" ${soft}, "WONK" ${wonk ? 1 : 0}`,
    textWrap: "balance",
  };
}

/**
 * Archivo com figura tabular — todo número que se alinha passa por aqui.
 * O Fraunces ignora `tabular-nums` (medido: mais de 80px de deriva em dez
 * dígitos a 40px), então número comparável nunca entra em display.
 */
export const tabular: CSSProperties = {
  fontVariantNumeric: "tabular-nums lining-nums",
  fontFamily:
    "var(--font-archivo), 'Helvetica Neue', Helvetica, Arial, 'Liberation Sans', sans-serif",
  fontVariationSettings: '"wdth" 100',
};

/** Eixo de largura do Archivo: 92 para rótulo denso e cabeçalho de coluna. */
export const condensed: CSSProperties = { fontVariationSettings: '"wdth" 92' };

/** Ausência de dado é travessão, nunca 0 (§9.2). */
export const EM_DASH = "—";

/** Menos tipográfico (U+2212), não hífen — para delta negativo. */
export const MINUS = "−";
