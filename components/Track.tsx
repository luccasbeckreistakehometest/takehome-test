"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { audienceFromPath, normalizePath, trackablePath } from "@/lib/analytics-rules";

// Medição própria, sem cookie: uma visita por página pública, cliques em
// elementos com data-track e eventos pedidos pela tela (window.marqaTrack).
// A UTM do primeiro toque fica na aba (sessionStorage) e vai junto no cadastro.

type Utm = { source: string; medium: string; campaign: string; content: string };
const FIRST_TOUCH = "marqa_ft";

export function firstTouchUtm(): Utm | null {
  try {
    const raw = sessionStorage.getItem(FIRST_TOUCH);
    return raw ? (JSON.parse(raw) as Utm) : null;
  } catch {
    return null;
  }
}

function currentUtm(): Utm {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = {
    source: params.get("utm_source") ?? "",
    medium: params.get("utm_medium") ?? "",
    campaign: params.get("utm_campaign") ?? "",
    content: params.get("utm_content") ?? "",
  };
  const stored = firstTouchUtm();
  if (stored) return stored;
  if (fromUrl.source || fromUrl.campaign) {
    try {
      sessionStorage.setItem(FIRST_TOUCH, JSON.stringify(fromUrl));
    } catch {
      /* aba sem armazenamento: vai só nesta página */
    }
  }
  return fromUrl;
}

function lang(): "pt" | "en" {
  try {
    return localStorage.getItem("uiLang") === "en" ? "en" : "pt";
  } catch {
    return "pt";
  }
}

export function track(name: string, meta: Record<string, string | number | boolean> = {}) {
  if (typeof window === "undefined") return;
  const path = normalizePath(window.location.pathname);
  if (!trackablePath(path)) return;
  const params = new URLSearchParams(window.location.search);
  const body = JSON.stringify({
    name,
    path,
    audience: audienceFromPath(path, params.get("type")),
    utm: currentUtm(),
    lang: lang(),
    referrer: document.referrer ? (() => { try { return new URL(document.referrer).hostname; } catch { return ""; } })() : "",
    meta,
  });
  try {
    if (navigator.sendBeacon && navigator.sendBeacon("/api/t", new Blob([body], { type: "text/plain" }))) return;
  } catch {
    /* cai no fetch */
  }
  fetch("/api/t", { method: "POST", body, keepalive: true, headers: { "Content-Type": "text/plain" } }).catch(() => {});
}

export default function Track() {
  const pathname = usePathname();
  useEffect(() => {
    track("view");
  }, [pathname]);
  useEffect(() => {
    (window as unknown as { marqaTrack?: typeof track }).marqaTrack = track;
    const onClick = (event: MouseEvent) => {
      const el = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-track]");
      if (!el) return;
      track(el.dataset.track ?? "cta_click", el.dataset.trackLabel ? { label: el.dataset.trackLabel } : {});
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  return null;
}
