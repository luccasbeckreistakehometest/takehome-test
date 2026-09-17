import { ImageResponse } from "next/og";
import { getAgencyPage } from "@/lib/agency-page-db";
import { isPageLive } from "@/lib/agency-page-rules";
import { getSettings } from "@/lib/settings";
import { readUpload } from "@/lib/uploads";

export const dynamic = "force-dynamic";
export const alt = "Página da agência";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Cartão OG da página pública: nome, headline, serviços e a cor da agência.
// Satori: toda div com mais de um filho precisa de display:flex.
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const config = getAgencyPage();
  const settings = getSettings();
  const live = isPageLive(config, slug);
  const logo = settings.logoMime ? readUpload("agency-logo", settings.logoMime) : null;
  const logoSrc = logo ? `data:${settings.logoMime};base64,${logo.toString("base64")}` : null;
  const accent = settings.accentColor || "#f76b15";
  const headline = live ? config.headline || settings.tagline : "Página não encontrada";
  const services = live ? config.services.slice(0, 4) : [];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          background: "#0a0a0f",
          color: "#f5f5f8",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          {logoSrc ? (
            <img src={logoSrc} alt="" width={96} height={96} style={{ borderRadius: 24, objectFit: "contain" }} />
          ) : (
            <div
              style={{
                width: 96,
                height: 96,
                borderRadius: 24,
                background: accent,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 52,
                fontWeight: 700,
                color: "#fff",
              }}
            >
              {settings.agencyName.charAt(0).toUpperCase()}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 40, fontWeight: 700 }}>{settings.agencyName}</div>
            <div style={{ fontSize: 22, color: "#9a9aac" }}>{settings.tagline}</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div style={{ fontSize: 56, fontWeight: 700, lineHeight: 1.1, maxWidth: 1000 }}>{headline}</div>
          {services.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              {services.map((service) => (
                <div
                  key={service}
                  style={{
                    display: "flex",
                    padding: "10px 18px",
                    borderRadius: 999,
                    border: `2px solid ${accent}`,
                    fontSize: 22,
                    color: "#f5f5f8",
                  }}
                >
                  {service}
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: "flex", height: 10, width: "100%", borderRadius: 999, background: accent }} />
      </div>
    ),
    { ...size }
  );
}
