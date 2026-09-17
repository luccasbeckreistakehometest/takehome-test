// Radar de IA (puro): quando alguém pergunta a um assistente de IA, a marca
// aparece? Nomes comparados sem acento/caixa/espaço, participação na conversa
// (share of voice), tipos de fonte citados e o que fazer a seguir.

export const MAX_QUESTIONS = 10;
export const SUGGESTED_QUESTIONS = 8;
export const RUN_EVERY_DAYS = 7;
export const RUN_COST_COINS = 12;

export type SourceType = "review" | "lista" | "site" | "diretório" | "notícia" | "rede social";
export const SOURCE_TYPES: SourceType[] = ["review", "lista", "site", "diretório", "notícia", "rede social"];

export type BrandMention = { name: string; position: number; sentiment: "positivo" | "neutro" | "negativo" };
export type QuestionResult = {
  question: string;
  answerSummary: string;
  brandsMentioned: BrandMention[];
  clientMentioned: boolean;
  clientPosition: number | null;
  citedSources: { url: string; type: SourceType }[];
};

export function foldName(name: string): string {
  return (name ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

// Mesmo nome com grafia diferente ("Pet Shop Au-Au" = "PetShop AuAu"). Nome
// longo pode vir com complemento ("Café Aurora Vila Mariana"), curto não.
export function sameBrand(a: string, b: string): boolean {
  const x = foldName(a);
  const y = foldName(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short.length >= 6 && long.startsWith(short);
}

export function competitorList(raw: string): string[] {
  return (raw ?? "")
    .split(/[,;\n]|\s+e\s+|\s+and\s+/i)
    .map((s) => s.replace(/\(.*?\)/g, "").trim())
    .filter((s) => s.length >= 2)
    .slice(0, 12);
}

export type RadarSummary = {
  questions: number;
  totalMentions: number;
  clientMentions: number;
  shareOfVoice: number; // 0-100
  answersWithClient: number;
  bestPosition: number | null;
  competitors: { name: string; mentions: number }[];
  sources: { type: SourceType; answers: number }[];
  actions: string[];
};

const ACTIONS: Record<SourceType, { pt: string; en: string }> = {
  review: { pt: "Peça avaliações no Google e responda todas — é o que os assistentes mais leem.", en: "Ask for Google reviews and answer every one — assistants read them most." },
  lista: { pt: "Entre nas listas de \"melhores\" do seu bairro e segmento (blogs, guias locais).", en: "Get into local \"best of\" lists for your area and niche (blogs, local guides)." },
  site: { pt: "Deixe claro no site o que você vende, onde atende e para quem — com perguntas e respostas.", en: "Make your site state clearly what you sell, where and for whom — with an FAQ." },
  "diretório": { pt: "Complete o perfil no Google Maps e nos diretórios do setor com o mesmo nome e endereço.", en: "Complete your Google Maps and industry directory profiles with the same name and address." },
  "notícia": { pt: "Conte uma novidade para a imprensa local: matérias viram fonte para a IA.", en: "Pitch a story to local press: articles become sources for AI." },
  "rede social": { pt: "Publique com frequência respondendo às perguntas que as pessoas fazem.", en: "Post regularly answering the questions people actually ask." },
};

export function summarizeRun(results: QuestionResult[], clientName: string, competitorsRaw: string, lang: "pt-BR" | "en" = "pt-BR"): RadarSummary {
  const competitors = competitorList(competitorsRaw);
  let total = 0;
  let clientMentions = 0;
  let answersWithClient = 0;
  let bestPosition: number | null = null;
  const compCount = new Map<string, number>(competitors.map((c) => [c, 0]));
  const sourceAnswers = new Map<SourceType, number>();
  for (const r of results) {
    let mentionedHere = false;
    for (const brand of r.brandsMentioned) {
      total += 1;
      if (sameBrand(brand.name, clientName)) {
        clientMentions += 1;
        mentionedHere = true;
        if (bestPosition === null || brand.position < bestPosition) bestPosition = brand.position;
        continue;
      }
      const comp = competitors.find((c) => sameBrand(c, brand.name));
      if (comp) compCount.set(comp, (compCount.get(comp) ?? 0) + 1);
    }
    if (mentionedHere || r.clientMentioned) answersWithClient += 1;
    const types = new Set(r.citedSources.map((s) => s.type));
    for (const t of types) sourceAnswers.set(t, (sourceAnswers.get(t) ?? 0) + 1);
  }
  const sources = [...sourceAnswers.entries()].map(([type, answers]) => ({ type, answers })).sort((a, b) => b.answers - a.answers);
  const key = lang === "en" ? "en" : "pt";
  const actions = sources.slice(0, 3).map((s) => ACTIONS[s.type][key]);
  if (actions.length === 0) actions.push(key === "en" ? "Publish clear answers to your customers' questions on your site." : "Publique no site respostas claras para as perguntas dos seus clientes.");
  return {
    questions: results.length,
    totalMentions: total,
    clientMentions,
    shareOfVoice: total > 0 ? Math.round((clientMentions / total) * 1000) / 10 : 0,
    answersWithClient,
    bestPosition,
    competitors: [...compCount.entries()].map(([name, mentions]) => ({ name, mentions })).sort((a, b) => b.mentions - a.mentions),
    sources,
    actions,
  };
}

// "7 de 10 respostas citam avaliações" — o porquê de a marca não aparecer.
export function whyNotYou(summary: RadarSummary, lang: "pt-BR" | "en" = "pt-BR"): string[] {
  const label: Record<SourceType, { pt: string; en: string }> = {
    review: { pt: "avaliações", en: "reviews" },
    lista: { pt: "listas de recomendação", en: "recommendation lists" },
    site: { pt: "sites das marcas", en: "brand websites" },
    "diretório": { pt: "diretórios e mapas", en: "directories and maps" },
    "notícia": { pt: "notícias", en: "news" },
    "rede social": { pt: "redes sociais", en: "social media" },
  };
  return summary.sources.slice(0, 3).map((s) =>
    lang === "en"
      ? `${s.answers} of ${summary.questions} answers cite ${label[s.type].en}`
      : `${s.answers} de ${summary.questions} respostas citam ${label[s.type].pt}`
  );
}

export function nextRunAt(lastRanAt: string | null, days = RUN_EVERY_DAYS): string | null {
  if (!lastRanAt) return null;
  return new Date(Date.parse(lastRanAt) + days * 86_400_000).toISOString();
}

export function canRun(lastRanAt: string | null, now: Date = new Date()): boolean {
  const next = nextRunAt(lastRanAt);
  return !next || next <= now.toISOString();
}

export function sanitizeQuestions(input: unknown): string[] {
  const list = Array.isArray(input) ? input : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const q of list) {
    const text = String(q ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
    const key = text.toLowerCase();
    if (text.length < 8 || seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length >= MAX_QUESTIONS) break;
  }
  return out;
}

const COUNTRY_CODES: Record<string, string> = { brasil: "BR", brazil: "BR", portugal: "PT", "estados unidos": "US", eua: "US", usa: "US", "united states": "US", argentina: "AR", chile: "CL", mexico: "MX", "méxico": "MX", colombia: "CO" };
export function countryCode(country: string | null | undefined): string | undefined {
  return COUNTRY_CODES[(country ?? "").trim().toLowerCase()];
}

export function disclaimer(ranAt: string, lang: "pt-BR" | "en" = "pt-BR"): string {
  const d = ranAt.slice(0, 10).split("-").reverse().join("/");
  return lang === "en"
    ? `AI simulation with web search on ${d}. Assistants like ChatGPT and Gemini may answer differently.`
    : `Simulação feita por IA com busca na web em ${d}. Assistentes como ChatGPT e Gemini podem responder diferente.`;
}

// Resultado de exemplo (modo de teste e demonstração sem chave).
export function mockResults(questions: string[], clientName: string, competitorsRaw: string): QuestionResult[] {
  const comps = competitorList(competitorsRaw);
  const others = comps.length ? comps : ["Concorrente A", "Concorrente B", "Concorrente C"];
  const types: SourceType[] = ["review", "lista", "diretório"];
  return questions.map((question, i) => {
    const withClient = i % 3 === 0;
    const brands: BrandMention[] = [
      { name: others[i % others.length], position: 1, sentiment: "positivo" },
      { name: others[(i + 1) % others.length], position: 2, sentiment: "neutro" },
      ...(withClient ? [{ name: clientName, position: 3, sentiment: "positivo" as const }] : []),
    ];
    return {
      question,
      answerSummary: withClient ? `Recomenda ${others[i % others.length]} e cita ${clientName}.` : `Recomenda ${others[i % others.length]} e ${others[(i + 1) % others.length]}.`,
      brandsMentioned: brands,
      clientMentioned: withClient,
      clientPosition: withClient ? 3 : null,
      citedSources: [
        { url: "https://www.google.com/maps", type: types[i % types.length] },
        { url: "https://exemplo.com/melhores", type: "lista" },
      ],
    };
  });
}
