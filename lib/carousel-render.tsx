import fs from "fs";
import path from "path";
import { ImageResponse } from "next/og";
import { readGenericUpload } from "./uploads";
import { slideHash, SLIDE_SIZE, stripEmoji, type CarouselTemplate, type Palette, type Slide } from "./carousel-rules";
import type { Carousel, CarouselBrand } from "./carousels-db";

// Renderiza um slide 1080×1350 (PNG) com a identidade do cliente e guarda em
// disco por hash: editar um slide só re-renderiza aquele slide.
// Satori: toda div com mais de um filho precisa de display:flex.

const cacheDir = () => path.join(process.env.DATA_DIR ?? path.join(process.cwd(), "data"), "uploads", "carousels");

let fontCache: ArrayBuffer | null | undefined;
function displayFont(): ArrayBuffer | null {
  if (fontCache !== undefined) return fontCache;
  try {
    const buf = fs.readFileSync(path.join(process.cwd(), "assets", "fonts", "SpaceGrotesk-Bold.ttf"));
    fontCache = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  } catch {
    // sem a fonte (imagem antiga): usa a padrão do renderizador
    fontCache = null;
  }
  return fontCache;
}

function logoDataUrl(brand: CarouselBrand): string | null {
  if (!brand.logo) return null;
  const data = readGenericUpload(brand.logo.id, brand.logo.ext);
  return data ? `data:${brand.logo.mime};base64,${data.toString("base64")}` : null;
}

function SlideView(props: { template: CarouselTemplate; palette: Palette; slide: Slide; index: number; total: number; brandName: string; logo: string | null }) {
  const { template, palette, slide, index, total, brandName, logo } = props;
  const first = index === 0;
  const bg = template === "minimal" ? "#fbfaf7" : template === "bold" ? palette.primary : palette.surface;
  const ink = template === "minimal" ? "#141414" : template === "bold" ? palette.ink : palette.surface === "#111111" ? "#ffffff" : "#141414";
  const accent = template === "bold" ? palette.ink : palette.primary;
  const titleSize = first ? (template === "bold" ? 104 : 92) : template === "bold" ? 84 : 72;
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: bg, color: ink, padding: 88, fontFamily: "Display" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" width={72} height={72} style={{ borderRadius: 16, objectFit: "contain" }} />
          ) : (
            <div style={{ width: 72, height: 72, borderRadius: 16, background: accent, color: template === "bold" ? palette.primary : palette.ink, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40 }}>
              {brandName.charAt(0).toUpperCase()}
            </div>
          )}
          <div style={{ display: "flex", fontSize: 30, opacity: 0.8 }}>{stripEmoji(brandName)}</div>
        </div>
        <div style={{ display: "flex", fontSize: 28, opacity: 0.7 }}>{`${index + 1}/${total}`}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, justifyContent: first ? "center" : "flex-end", gap: 36 }}>
        {template === "editorial" && <div style={{ display: "flex", width: 120, height: 12, background: accent, borderRadius: 6 }} />}
        <div style={{ display: "flex", fontSize: titleSize, lineHeight: 1.05, letterSpacing: -2 }}>{stripEmoji(slide.title)}</div>
        {slide.body && <div style={{ display: "flex", fontSize: first ? 42 : 44, lineHeight: 1.3, opacity: 0.88 }}>{stripEmoji(slide.body)}</div>}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 48 }}>
        <div style={{ display: "flex", height: 10, flexGrow: 1, background: template === "minimal" ? "#e5e2dc" : "rgba(127,127,127,0.25)", borderRadius: 5 }}>
          <div style={{ display: "flex", width: `${((index + 1) / total) * 100}%`, height: 10, background: accent, borderRadius: 5 }} />
        </div>
        {index + 1 < total ? (
          <div style={{ display: "flex", width: 28, height: 28, marginLeft: 36, borderTop: `6px solid ${accent}`, borderRight: `6px solid ${accent}`, transform: "rotate(45deg)" }} />
        ) : (
          <div style={{ display: "flex", width: 28, height: 28, marginLeft: 36, borderRadius: 14, background: accent }} />
        )}
      </div>
    </div>
  );
}

export type RenderedSlide = { hash: string; png: Buffer; cached: boolean };

export async function renderSlide(carousel: Carousel, brand: CarouselBrand, index: number): Promise<RenderedSlide | null> {
  const slide = carousel.content.slides[index];
  if (!slide) return null;
  const total = carousel.content.slides.length;
  const hash = slideHash({ template: carousel.template, palette: brand.palette, logoId: brand.logo?.id ?? null, brandName: brand.name, slide, index, total });
  const file = path.join(cacheDir(), carousel.id, `${index}-${hash}.png`);
  if (fs.existsSync(file)) return { hash, png: fs.readFileSync(file), cached: true };
  const font = displayFont();
  const response = new ImageResponse(
    <SlideView template={carousel.template} palette={brand.palette} slide={slide} index={index} total={total} brandName={brand.name} logo={logoDataUrl(brand)} />,
    { ...SLIDE_SIZE, ...(font ? { fonts: [{ name: "Display", data: font, weight: 700 as const, style: "normal" as const }] } : {}) }
  );
  const png = Buffer.from(await response.arrayBuffer());
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // versões antigas deste slide saem do disco
  for (const old of fs.readdirSync(path.dirname(file))) {
    if (old.startsWith(`${index}-`) && old !== path.basename(file)) fs.rmSync(path.join(path.dirname(file), old), { force: true });
  }
  fs.writeFileSync(file, png);
  return { hash, png, cached: false };
}

export function slideHashes(carousel: Carousel, brand: CarouselBrand): string[] {
  const total = carousel.content.slides.length;
  return carousel.content.slides.map((slide, index) =>
    slideHash({ template: carousel.template, palette: brand.palette, logoId: brand.logo?.id ?? null, brandName: brand.name, slide, index, total })
  );
}

export function removeCarouselFiles(carouselId: string): void {
  fs.rmSync(path.join(cacheDir(), carouselId), { recursive: true, force: true });
}
