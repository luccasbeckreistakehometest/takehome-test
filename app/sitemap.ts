import type { MetadataRoute } from "next";
import { appBaseUrl } from "@/lib/legal";
import { getAgencyPage } from "@/lib/agency-page-db";

export const dynamic = "force-dynamic";

const PUBLIC_PAGES: { path: string; priority: number; alternate?: string }[] = [
  { path: "/", priority: 1 },
  { path: "/para-agencias", priority: 0.9 },
  { path: "/para-marcas", priority: 0.9 },
  { path: "/para-profissionais", priority: 0.9 },
  { path: "/criar-conta", priority: 0.6 },
  { path: "/pedir-acesso", priority: 0.5 },
  { path: "/contato", priority: 0.4, alternate: "/contact" },
  { path: "/termos", priority: 0.2, alternate: "/terms" },
  { path: "/privacidade", priority: 0.2, alternate: "/privacy" },
  { path: "/reembolso", priority: 0.2, alternate: "/refunds" },
  { path: "/cookies", priority: 0.1, alternate: "/cookie-policy" },
];

// Landing, funis, páginas legais e a página pública da agência (se publicada).
export default function sitemap(): MetadataRoute.Sitemap {
  const base = appBaseUrl();
  const now = new Date();
  const entries: MetadataRoute.Sitemap = PUBLIC_PAGES.map((page) => ({
    url: `${base}${page.path}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: page.priority,
    ...(page.alternate
      ? { alternates: { languages: { "pt-BR": `${base}${page.path}`, en: `${base}${page.alternate}` } } }
      : {}),
  }));
  for (const page of PUBLIC_PAGES.filter((p) => p.alternate)) {
    entries.push({ url: `${base}${page.alternate}`, lastModified: now, changeFrequency: "monthly", priority: 0.1 });
  }
  try {
    const agency = getAgencyPage();
    if (agency.published && agency.slug) {
      entries.push({ url: `${base}/a/${agency.slug}`, lastModified: now, changeFrequency: "weekly", priority: 0.7 });
    }
  } catch (error) {
    console.error("[sitemap] página da agência indisponível:", error);
  }
  return entries;
}
