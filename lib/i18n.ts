"use client";

import { useEffect, useState } from "react";

// Camada de locale da interface. O idioma vive em localStorage ("uiLang"),
// alternado pelo LangToggle (que dá reload). Aqui centralizamos moeda, número
// e data para que TUDO respeite o idioma — inclusive trocar R$ por US$ quando
// a interface está em inglês.

export type UiLang = "pt" | "en";


// Leitura direta (fora de render). No servidor sempre "pt" (sem localStorage).
export function readUiLang(): UiLang {
  if (typeof window === "undefined") return "pt";
  try {
    return localStorage.getItem("uiLang") === "en" ? "en" : "pt";
  } catch {
    return "pt";
  }
}

// Hook para componentes: começa em "pt" (igual ao SSR, sem mismatch de
// hidratação) e ajusta para o idioma real depois de montar.
export function useUiLang(): UiLang {
  const [lang, setLang] = useState<UiLang>("pt");
  useEffect(() => setLang(readUiLang()), []);
  return lang;
}

const locale = (lang: UiLang) => (lang === "en" ? "en-US" : "pt-BR");

// Dinheiro: valores do produto são em reais e são cobrados em reais (Mercado
// Pago). Em inglês mostramos R$ com agrupamento em inglês — nunca um
// equivalente em dólar, que não seria o valor cobrado.
export function fmtMoney(brl: number, lang: UiLang = readUiLang()): string {
  if (lang === "en") {
    return `R$${brl.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  }
  return brl.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

// Formata um valor que JÁ está numa moeda específica (ex.: vendas importadas de
// integração), sem conversão — só o locale do agrupamento de milhar.
export function fmtCurrency(
  value: number,
  currency: string,
  lang: UiLang = readUiLang()
): string {
  return value.toLocaleString(locale(lang), {
    style: "currency",
    currency: currency || "BRL",
    maximumFractionDigits: 0,
  });
}

export function fmtNum(n: number, lang: UiLang = readUiLang()): string {
  return n.toLocaleString(locale(lang));
}

export function fmtDateTime(
  iso: string | number | Date,
  lang: UiLang = readUiLang(),
  opts?: Intl.DateTimeFormatOptions
): string {
  return new Date(iso).toLocaleString(locale(lang), opts);
}
