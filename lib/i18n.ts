"use client";

import { useEffect, useState } from "react";

// Camada de locale da interface. O idioma vive em localStorage ("uiLang"),
// alternado pelo LangToggle (que dá reload). Aqui centralizamos moeda, número
// e data para que TUDO respeite o idioma — inclusive trocar R$ por US$ quando
// a interface está em inglês.

export type UiLang = "pt" | "en";

// Câmbio BRL→USD usado quando a interface está em inglês. Os preços do produto
// são definidos em BRL (lib/plans.ts); em inglês mostramos o equivalente em
// dólar. Configurável por env para acompanhar o câmbio sem novo build.
export const USD_PER_BRL = Number(process.env.NEXT_PUBLIC_USD_PER_BRL) || 0.18;

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

// Dinheiro: valor SEMPRE em BRL na entrada. Em inglês converte para USD.
export function fmtMoney(brl: number, lang: UiLang = readUiLang()): string {
  if (lang === "en") {
    return (brl * USD_PER_BRL).toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    });
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
