import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { buildZip, crc32, readZip } from "@/lib/zip";
import {
  captionText,
  contentProblems,
  contrast,
  fitText,
  mockCarousel,
  pickPalette,
  sanitizeContent,
  slideHash,
  stripEmoji,
  TITLE_MAX,
} from "@/lib/carousel-rules";

describe("zip writer", () => {
  it("computes the standard CRC32", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array())).toBe(0);
  });

  it("writes store entries that read back with matching CRCs", () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
    const zip = buildZip([
      { name: "slide-01.png", data: png },
      { name: "legenda.txt", data: new TextEncoder().encode("Olá, café ☕") },
    ]);
    expect(zip.readUInt32LE(0)).toBe(0x04034b50);
    expect(zip.readUInt32LE(zip.length - 22)).toBe(0x06054b50);
    expect(zip.readUInt16LE(zip.length - 22 + 10)).toBe(2);
    const entries = readZip(zip);
    expect(entries.map((e) => e.name)).toEqual(["slide-01.png", "legenda.txt"]);
    expect(entries.every((e) => e.crcOk)).toBe(true);
    expect(entries[1].data.toString("utf8")).toBe("Olá, café ☕");
  });
});

describe("carousel rules", () => {
  it("fits text on word boundaries and marks the cut", () => {
    expect(fitText("curto", 60)).toBe("curto");
    const long = "Uma frase bem comprida que passa do limite de caracteres do título do slide";
    const fitted = fitText(long, TITLE_MAX);
    expect(fitted.length).toBeLessThanOrEqual(TITLE_MAX);
    expect(fitted.endsWith("…")).toBe(true);
    expect(fitted).not.toMatch(/\s…$/);
  });

  it("sanitizes AI output: slide cap, hashtags and limits", () => {
    const content = sanitizeContent({
      hook: "Gancho",
      slides: Array.from({ length: 12 }, (_, i) => ({ title: `Slide ${i}`, body: "x".repeat(400), visualHint: "" })),
      hashtags: ["#cafe", "  marketing digital ", ""],
    });
    expect(content.slides).toHaveLength(8);
    expect(content.slides[0].body.length).toBeLessThanOrEqual(180);
    expect(content.hashtags).toEqual(["cafe", "marketingdigital"]);
    expect(contentProblems(sanitizeContent({ slides: [{ title: "a", body: "", visualHint: "" }] }))[0]).toContain("pelo menos 5");
    expect(stripEmoji("Café ☕ da manhã 🚀")).toBe("Café da manhã");
  });

  it("uses the identity colour first, then the briefing, then the agency", () => {
    expect(pickPalette({ identityHexes: ["#1A7F5A", "#F4E9D8"], fallback: "#f76b15" }).primary).toBe("#1a7f5a");
    expect(pickPalette({ brandColors: "verde #0b5d3b e creme", fallback: "#f76b15" }).primary).toBe("#0b5d3b");
    expect(pickPalette({ fallback: "#f76b15" }).primary).toBe("#f76b15");
    const dark = pickPalette({ fallback: "#101828" });
    expect(dark.ink).toBe("#ffffff");
    expect(contrast(dark.primary, dark.ink)).toBeGreaterThan(4.5);
    expect(pickPalette({ fallback: "#ffe66d" }).ink).toBe("#111111");
  });

  it("changes a slide hash only when that slide changes", () => {
    const palette = pickPalette({ fallback: "#f76b15" });
    const content = mockCarousel("café", "pt-BR", 6);
    const hashes = content.slides.map((slide, index) => slideHash({ template: "bold", palette, logoId: null, brandName: "Café", slide, index, total: 6 }));
    const edited = content.slides.map((s, i) => (i === 2 ? { ...s, title: "Outro título" } : s));
    const after = edited.map((slide, index) => slideHash({ template: "bold", palette, logoId: null, brandName: "Café", slide, index, total: 6 }));
    expect(after.filter((h, i) => h !== hashes[i])).toHaveLength(1);
    expect(after[2]).not.toBe(hashes[2]);
    const other = content.slides.map((slide, index) => slideHash({ template: "minimal", palette, logoId: null, brandName: "Café", slide, index, total: 6 }));
    expect(other.every((h, i) => h !== hashes[i])).toBe(true);
  });

  it("writes the example script in the client's language and the caption file", () => {
    expect(mockCarousel("bolo", "pt-BR", 5).slides).toHaveLength(5);
    expect(mockCarousel("cake", "en", 9).slides).toHaveLength(8);
    expect(mockCarousel("cake", "en").hook).toContain("what nobody tells you");
    expect(captionText(mockCarousel("bolo", "pt-BR"))).toContain("#dicas");
  });
});

describe("production image", () => {
  it("ships the slide font and keeps it under the renderer's budget", () => {
    const dockerfile = fs.readFileSync(path.join(__dirname, "../../Dockerfile"), "utf8");
    expect(dockerfile).toContain("COPY --from=builder /app/assets ./assets");
    const font = fs.statSync(path.join(__dirname, "../../assets/fonts/SpaceGrotesk-Bold.ttf"));
    expect(font.size).toBeLessThan(500_000);
  });
});
