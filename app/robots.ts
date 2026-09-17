import type { MetadataRoute } from "next";
import { appBaseUrl } from "@/lib/legal";

export const dynamic = "force-dynamic";

// Só as páginas públicas; áreas logadas, APIs e links com token ficam fora.
export default function robots(): MetadataRoute.Robots {
  const base = appBaseUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin",
          "/agenda",
          "/assistant",
          "/calendar",
          "/clients",
          "/conta",
          "/convite/",
          "/finance",
          "/ideas",
          "/insights",
          "/login",
          "/messages",
          "/plans",
          "/portal",
          "/print/",
          "/production",
          "/professionals",
          "/proposta/",
          "/prospecting",
          "/settings",
          "/treinamento",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
