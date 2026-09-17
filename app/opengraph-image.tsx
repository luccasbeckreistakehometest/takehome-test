import { ImageResponse } from "next/og";

// Imagem padrão de compartilhamento (WhatsApp, LinkedIn, X).
export const alt = "Marqa — marketing com IA para agências, marcas e profissionais";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "linear-gradient(135deg, #0d0d0f 0%, #1c130d 60%, #3a1a06 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: 24,
              background: "linear-gradient(135deg, #f76b15, #ffb03a)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 56,
              fontWeight: 800,
              color: "#ffffff",
            }}
          >
            M
          </div>
          <div style={{ display: "flex", fontSize: 52, fontWeight: 800, letterSpacing: -1 }}>Marqa</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", fontSize: 64, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2, maxWidth: 980 }}>
            Marketing com IA, do briefing à aprovação.
          </div>
          <div style={{ display: "flex", fontSize: 30, color: "#f3c9a6" }}>
            Para agências, marcas e profissionais criativos
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 26, color: "#ffb03a" }}>marqa.online</div>
      </div>
    ),
    size
  );
}
