// Painel de público sintético (puro): personas da estratégia, validação das
// variantes, leitura da tabela persona × variante e a calibragem contra os
// cliques reais. É uma simulação — serve para descartar opções fracas.

export const MIN_VARIANTS = 2;
export const MAX_VARIANTS = 3;
export const MIN_CALIBRATION_TESTS = 5;

export type Persona = { name: string; description: string };
export type PanelCell = { persona: string; variant: number; stopScroll: number; clarity: number; wouldClick: boolean; objection: string; quote: string };
export type PanelResult = { cells: PanelCell[]; winner: number; why: string; fix: string };

export function validateVariants(input: unknown): { ok: true; variants: string[] } | { ok: false; error: string } {
  const list = Array.isArray(input) ? input.map((v) => String(v ?? "").trim()).filter(Boolean) : [];
  if (list.length < MIN_VARIANTS || list.length > MAX_VARIANTS) return { ok: false, error: "Teste de 2 a 3 variantes." };
  if (list.some((v) => v.length < 3 || v.length > 2200)) return { ok: false, error: "Cada variante precisa de 3 a 2.200 caracteres." };
  if (new Set(list.map((v) => v.toLowerCase())).size !== list.length) return { ok: false, error: "As variantes precisam ser diferentes." };
  return { ok: true, variants: list };
}

// Personas da estratégia gerada (buyerPersonas / personas), de 4 a 6.
export function personasFromStrategy(content: string | null | undefined): Persona[] {
  if (!content) return [];
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    const raw = (parsed.buyerPersonas ?? parsed.personas ?? parsed.targetBuyers ?? []) as Record<string, unknown>[];
    return (Array.isArray(raw) ? raw : [])
      .map((p) => ({
        name: String(p.persona ?? p.name ?? p.title ?? "").trim().slice(0, 60),
        description: [p.profile, p.description, p.pains, p.desires, p.buyingTriggers]
          .flat()
          .filter((x) => typeof x === "string" && x.trim())
          .join(" · ")
          .slice(0, 300),
      }))
      .filter((p) => p.name)
      .slice(0, 6);
  } catch {
    return [];
  }
}

export function genericPersonas(audience: string, lang: "pt-BR" | "en"): Persona[] {
  const base = audience.trim() || (lang === "en" ? "the brand's audience" : "o público da marca");
  return lang === "en"
    ? [
        { name: "Skeptical first-timer", description: `Part of ${base}; never bought from the brand, distrusts ads.` },
        { name: "Loyal regular", description: `Part of ${base}; already a customer, wants news and perks.` },
        { name: "Busy scroller", description: `Part of ${base}; decides in two seconds, hates long text.` },
        { name: "Price hunter", description: `Part of ${base}; compares prices and looks for a reason to act now.` },
      ]
    : [
        { name: "Desconfiada de primeira vez", description: `Faz parte de ${base}; nunca comprou da marca e desconfia de anúncio.` },
        { name: "Cliente fiel", description: `Faz parte de ${base}; já compra e quer novidade e vantagem.` },
        { name: "Rolagem apressada", description: `Faz parte de ${base}; decide em dois segundos e odeia texto longo.` },
        { name: "Caçador de preço", description: `Faz parte de ${base}; compara preço e procura motivo para agir agora.` },
      ];
}

const clamp = (n: unknown) => Math.max(0, Math.min(10, Math.round(Number(n) || 0)));

// Tabela completa (toda persona × toda variante) e vencedor válido.
export function normalizeResult(raw: PanelResult, personas: Persona[], variants: number): PanelResult {
  const cells: PanelCell[] = [];
  for (const persona of personas) {
    for (let v = 0; v < variants; v++) {
      const found = raw.cells.find((c) => c.persona === persona.name && Number(c.variant) === v);
      cells.push({
        persona: persona.name,
        variant: v,
        stopScroll: clamp(found?.stopScroll),
        clarity: clamp(found?.clarity),
        wouldClick: Boolean(found?.wouldClick),
        objection: String(found?.objection ?? "").slice(0, 200),
        quote: String(found?.quote ?? "").slice(0, 200),
      });
    }
  }
  const scores = variantScores({ cells, winner: 0, why: "", fix: "" }, variants);
  const best = scores.reduce((a, b) => (b.score > a.score ? b : a), scores[0]);
  const winner = Number.isInteger(raw.winner) && raw.winner >= 0 && raw.winner < variants ? raw.winner : best.variant;
  return { cells, winner, why: String(raw.why ?? "").slice(0, 400), fix: String(raw.fix ?? "").slice(0, 400) };
}

export type VariantScore = { variant: number; stopScroll: number; clarity: number; clickRate: number; score: number };

export function variantScores(result: PanelResult, variants: number): VariantScore[] {
  return Array.from({ length: variants }, (_, v) => {
    const cells = result.cells.filter((c) => c.variant === v);
    const n = Math.max(1, cells.length);
    const stopScroll = cells.reduce((s, c) => s + c.stopScroll, 0) / n;
    const clarity = cells.reduce((s, c) => s + c.clarity, 0) / n;
    const clickRate = cells.filter((c) => c.wouldClick).length / n;
    const round1 = (x: number) => Math.round(x * 10) / 10;
    return { variant: v, stopScroll: round1(stopScroll), clarity: round1(clarity), clickRate: Math.round(clickRate * 100), score: round1(stopScroll * 0.4 + clarity * 0.3 + clickRate * 10 * 0.3) };
  });
}

// O painel acertou? Só com 5+ testes em que as variantes foram ao ar e
// tiveram cliques; antes disso, "ainda sem dados".
export function calibration(tests: { predictedWinner: number; clicksByVariant: (number | null)[] }[]): { hits: number; total: number; pct: number } | null {
  const comparable = tests.filter((t) => {
    const known = t.clicksByVariant.filter((c): c is number => c !== null);
    return known.length >= 2 && known.some((c) => c > 0);
  });
  if (comparable.length < MIN_CALIBRATION_TESTS) return null;
  const hits = comparable.filter((t) => {
    let best = -1;
    let bestIndex = -1;
    t.clicksByVariant.forEach((c, i) => {
      if (c !== null && c > best) {
        best = c;
        bestIndex = i;
      }
    });
    return bestIndex === t.predictedWinner;
  }).length;
  return { hits, total: comparable.length, pct: Math.round((hits / comparable.length) * 100) };
}

export const LETTERS = ["A", "B", "C"];

export function mockPanel(personas: Persona[], variants: string[]): PanelResult {
  // a variante mais curta vence (rolagem rápida) — determinístico
  const lengths = variants.map((v) => v.length);
  const winner = lengths.indexOf(Math.min(...lengths));
  const cells: PanelCell[] = [];
  personas.forEach((p, pi) => {
    variants.forEach((_, v) => {
      const base = v === winner ? 7 : 5;
      cells.push({
        persona: p.name,
        variant: v,
        stopScroll: Math.min(10, base + (pi % 2)),
        clarity: Math.min(10, base + 1 - (pi % 2)),
        wouldClick: v === winner || pi % 3 === 0,
        objection: v === winner ? "Quero ver o preço logo." : "Texto longo demais para o feed.",
        quote: v === winner ? "Parei para ler." : "Passei direto.",
      });
    });
  });
  return { cells, winner, why: `A variante ${LETTERS[winner]} é mais direta e chama atenção no primeiro segundo.`, fix: "Coloque o benefício principal na primeira linha e termine com uma chamada clara." };
}
