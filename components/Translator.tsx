"use client";

import { useEffect } from "react";
import { UI_DICT, UI_REGEX_RULES } from "@/lib/ui-dict";

// Tradutor de interface (PT→EN): traduz apenas o chrome da plataforma por
// correspondência exata com o dicionário — conteúdo gerado por IA não bate
// com as entradas e passa intocado (ele já é localizado por cliente).
function translateText(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const hit = UI_DICT[trimmed];
  if (hit) {
    const out = text.replace(trimmed, hit);
    // CRÍTICO: retornar null quando nada muda — reescrever o mesmo valor
    // dispara nova mutação e criaria loop infinito com o MutationObserver
    return out === text ? null : out;
  }
  for (const [pattern, replacement] of UI_REGEX_RULES) {
    if (pattern.test(trimmed)) {
      const replaced = trimmed.replace(pattern, replacement);
      if (replaced === trimmed) continue;
      return text.replace(trimmed, replaced);
    }
  }
  return null;
}

const ATTRS = ["placeholder", "title", "aria-label", "alt"];

function translateTree(root: Node) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text);
  for (const node of textNodes) {
    const translated = translateText(node.textContent ?? "");
    if (translated !== null && translated !== node.textContent) {
      node.textContent = translated;
    }
  }
  const elements =
    root instanceof Element
      ? [root, ...Array.from(root.querySelectorAll("*"))]
      : Array.from((root as Document | DocumentFragment).querySelectorAll?.("*") ?? []);
  for (const element of elements) {
    for (const attr of ATTRS) {
      const value = element.getAttribute?.(attr);
      if (!value) continue;
      const translated = UI_DICT[value.trim()];
      if (translated) element.setAttribute(attr, translated);
    }
  }
}

export default function Translator() {
  useEffect(() => {
    if (localStorage.getItem("uiLang") !== "en") return;
    document.documentElement.lang = "en";
    translateTree(document.body);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData" && mutation.target.textContent) {
          const translated = translateText(mutation.target.textContent);
          if (translated !== null && translated !== mutation.target.textContent) {
            mutation.target.textContent = translated;
          }
        }
        for (const node of mutation.addedNodes) translateTree(node);
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    return () => observer.disconnect();
  }, []);
  return null;
}

export function LangToggle() {
  return (
    <button
      onClick={() => {
        const current = localStorage.getItem("uiLang") === "en" ? "en" : "pt";
        localStorage.setItem("uiLang", current === "en" ? "pt" : "en");
        window.location.reload();
      }}
      className="rounded-md border border-edge bg-surface-2 px-2 py-1 text-xs font-semibold text-muted transition-colors hover:border-accent hover:text-accent"
      title="Idioma da interface / UI language"
    >
      PT/EN
    </button>
  );
}
