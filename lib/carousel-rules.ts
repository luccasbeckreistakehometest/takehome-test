import { createHash } from "crypto";

// Carrossel pronto para postar (puro): conteúdo dos slides, limites de texto,
// paleta da marca, modelos visuais e o hash que decide quando re-renderizar.

export const SLIDE_SIZE = { width: 1080, height: 1350 } as const;
export const MIN_SLIDES = 5;
export const MAX_SLIDES = 8;
export const TITLE_MAX = 60;
export const BODY_MAX = 180;

export const CAROUSEL_TEMPLATES = ["editorial", "bold", "minimal"] as const;
export type CarouselTemplate = (typeof CAROUSEL_TEMPLATES)[number];
export const TEMPLATE_LABEL: Record<CarouselTemplate, string> = { editorial: "Editorial", bold: "Bold", minimal: "Minimal" };

export type Slide = { title: string; body: string; visualHint: string };
export type CarouselContent = { hook: string; slides: Slide[]; cta: string; caption: string; hashtags: string[] };
export type Palette = { primary: string; ink: string; surface: string; muted: string };

// Emoji viraria download de fonte na hora de renderizar: fora dos slides.
export function stripEmoji(value: string): string {
  return value.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, "").replace(/\s{2,}/g, " ").trim();
}

// Corta no limite sem quebrar palavra; reticências só quando cortou.
export function fitText(value: string, max: number): string {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.-]+$/, "")}…`;
}

export function sanitizeContent(input: Partial<CarouselContent>): CarouselContent {
  const slides = (Array.isArray(input.slides) ? input.slides : [])
    .slice(0, MAX_SLIDES)
    .map((s) => ({
      title: fitText(String(s?.title ?? ""), TITLE_MAX),
      body: fitText(String(s?.body ?? ""), BODY_MAX),
      visualHint: fitText(String(s?.visualHint ?? ""), 140),
    }));
  return {
    hook: fitText(String(input.hook ?? ""), TITLE_MAX),
    slides,
    cta: fitText(String(input.cta ?? ""), 80),
    caption: String(input.caption ?? "").trim().slice(0, 2200),
    hashtags: (Array.isArray(input.hashtags) ? input.hashtags : [])
      .map((h) => String(h).trim().replace(/^#*/, "").replace(/\s+/g, ""))
      .filter(Boolean)
      .slice(0, 15),
  };
}

export function contentProblems(content: CarouselContent): string[] {
  const problems: string[] = [];
  if (content.slides.length < MIN_SLIDES) problems.push(`O carrossel precisa de pelo menos ${MIN_SLIDES} slides.`);
  if (content.slides.some((s) => !s.title)) problems.push("Todo slide precisa de um título.");
  return problems;
}

const HEX = /^#?([0-9a-f]{6})$/i;
export function normalizeHex(value: string | null | undefined): string | null {
  const m = (value ?? "").trim().match(HEX);
  return m ? `#${m[1].toLowerCase()}` : null;
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

export function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

export function readableInk(background: string): string {
  return contrast(background, "#ffffff") >= contrast(background, "#111111") ? "#ffffff" : "#111111";
}

// Paleta: 1ª cor da identidade visual gerada (ou a cor da marca no
// briefing), senão a cor da agência. Tinta sempre legível sobre ela.
export function pickPalette(input: { identityHexes?: (string | null | undefined)[]; brandColors?: string; fallback: string }): Palette {
  const fromIdentity = (input.identityHexes ?? []).map(normalizeHex).filter((h): h is string => Boolean(h));
  const fromBrief = (input.brandColors ?? "").match(/#?[0-9a-f]{6}\b/gi)?.map(normalizeHex).filter((h): h is string => Boolean(h)) ?? [];
  const primary = fromIdentity[0] ?? fromBrief[0] ?? normalizeHex(input.fallback) ?? "#f76b15";
  const second = [...fromIdentity.slice(1), ...fromBrief.slice(1)].find((h) => contrast(h, primary) >= 3);
  const ink = readableInk(primary);
  return { primary, ink, surface: second ?? (ink === "#ffffff" ? "#111111" : "#faf7f2"), muted: ink === "#ffffff" ? "#ffffffb3" : "#111111b3" };
}

// Hash do slide: muda só quando algo que aparece nele muda.
export function slideHash(input: { template: string; palette: Palette; logoId: string | null; brandName: string; slide: Slide; index: number; total: number }): string {
  return createHash("sha256")
    .update(JSON.stringify([input.template, input.palette, input.logoId, input.brandName, input.slide.title, input.slide.body, input.index, input.total]))
    .digest("hex")
    .slice(0, 16);
}

export function captionText(content: CarouselContent): string {
  const tags = content.hashtags.map((h) => `#${h}`).join(" ");
  return [content.caption, content.cta, tags].filter(Boolean).join("\n\n");
}

// Roteiro de exemplo (AI_MOCK e caminho sem chave), na língua do cliente.
export function mockCarousel(topic: string, lang: "pt-BR" | "en", count = 6): CarouselContent {
  const t = topic.trim() || (lang === "en" ? "your product" : "seu produto");
  const pt = [
    [`${t}: o que ninguém te conta`, "Um guia rápido em slides para decidir sem erro."],
    ["O problema", "A maioria escolhe no impulso e se arrepende depois. Dá para evitar."],
    ["O que observar", "Qualidade, prazo e quem responde quando algo dá errado."],
    ["Como a gente faz", "Processo simples, transparente e com acompanhamento de perto."],
    ["Prova", "Clientes voltam porque o resultado aparece — e dá para medir."],
    ["Próximo passo", "Salve este post e chame no direct para tirar dúvidas."],
    ["Bônus", "Pergunte pelo pacote do mês: condições para quem chega agora."],
    ["Resumo", "Escolha com calma, peça referências e compare o que é entregue."],
  ];
  const en = [
    [`${t}: what nobody tells you`, "A quick slide guide to choose without regrets."],
    ["The problem", "Most people choose on impulse and regret it later. You can avoid that."],
    ["What to look for", "Quality, timing and who answers when something goes wrong."],
    ["How we do it", "A simple, transparent process with close follow-up."],
    ["Proof", "Clients come back because the results show — and can be measured."],
    ["Next step", "Save this post and message us with your questions."],
    ["Bonus", "Ask about this month's package: terms for new clients."],
    ["Recap", "Choose calmly, ask for references and compare what's delivered."],
  ];
  const source = lang === "en" ? en : pt;
  const n = Math.max(MIN_SLIDES, Math.min(MAX_SLIDES, count));
  return sanitizeContent({
    hook: source[0][0],
    slides: source.slice(0, n).map(([title, body]) => ({ title, body, visualHint: "" })),
    cta: lang === "en" ? "Save it and send it to a friend" : "Salve e mande para quem precisa",
    caption: lang === "en" ? `Everything about ${t}, slide by slide.` : `Tudo sobre ${t}, slide a slide.`,
    hashtags: lang === "en" ? ["marketing", "tips"] : ["marketing", "dicas"],
  });
}
