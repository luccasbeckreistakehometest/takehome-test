// Pacote do cliente e guardião do escopo (puro, sem banco): o que o pacote
// inclui, quanto já foi usado no mês e quando um pedido vira extra pago.

export const SCOPE_UNITS = ["post", "reel", "carrossel", "story", "demanda", "reunião", "relatório"] as const;
export type ScopeUnit = (typeof SCOPE_UNITS)[number];

export const UNIT_LABEL: Record<ScopeUnit, { one: string; many: string }> = {
  post: { one: "post", many: "posts" },
  reel: { one: "reel", many: "reels" },
  carrossel: { one: "carrossel", many: "carrosséis" },
  story: { one: "story", many: "stories" },
  demanda: { one: "demanda", many: "demandas" },
  "reunião": { one: "reunião", many: "reuniões" },
  "relatório": { one: "relatório", many: "relatórios" },
};

export type PackageItem = { key: string; label: string; unit: ScopeUnit; qty: number; extraPrice: number };
export type ClientPackage = { items: PackageItem[]; rolloverUnused: boolean };

export const PACKAGE_PRESETS: { key: string; name: string; items: PackageItem[] }[] = [
  {
    key: "social_basico",
    name: "Social básico",
    items: [
      { key: "post", label: "Posts no feed", unit: "post", qty: 12, extraPrice: 120 },
      { key: "story", label: "Stories", unit: "story", qty: 4, extraPrice: 40 },
      { key: "relatorio", label: "Relatório mensal", unit: "relatório", qty: 1, extraPrice: 250 },
    ],
  },
  {
    key: "social_trafego",
    name: "Social + tráfego",
    items: [
      { key: "post", label: "Posts no feed", unit: "post", qty: 12, extraPrice: 120 },
      { key: "reel", label: "Reels", unit: "reel", qty: 4, extraPrice: 250 },
      { key: "story", label: "Stories", unit: "story", qty: 8, extraPrice: 40 },
      { key: "demanda", label: "Peças para anúncio", unit: "demanda", qty: 2, extraPrice: 300 },
      { key: "reuniao", label: "Reuniões", unit: "reunião", qty: 2, extraPrice: 200 },
      { key: "relatorio", label: "Relatório mensal", unit: "relatório", qty: 1, extraPrice: 250 },
    ],
  },
  {
    key: "conteudo_premium",
    name: "Conteúdo premium",
    items: [
      { key: "post", label: "Posts no feed", unit: "post", qty: 16, extraPrice: 150 },
      { key: "reel", label: "Reels", unit: "reel", qty: 8, extraPrice: 300 },
      { key: "carrossel", label: "Carrosséis", unit: "carrossel", qty: 4, extraPrice: 220 },
      { key: "story", label: "Stories", unit: "story", qty: 12, extraPrice: 50 },
      { key: "demanda", label: "Produções extras (foto, vídeo, arte)", unit: "demanda", qty: 4, extraPrice: 400 },
      { key: "reuniao", label: "Reuniões", unit: "reunião", qty: 2, extraPrice: 250 },
      { key: "relatorio", label: "Relatório mensal", unit: "relatório", qty: 1, extraPrice: 300 },
    ],
  },
];

const clampInt = (n: unknown, min: number, max: number, fallback = min) => {
  const v = Math.floor(Number(n));
  return Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback;
};

export function sanitizePackage(input: { items?: unknown; rolloverUnused?: unknown }): ClientPackage {
  const raw = Array.isArray(input.items) ? input.items : [];
  const seen = new Set<string>();
  const items: PackageItem[] = [];
  for (const entry of raw.slice(0, 12)) {
    const e = entry as Partial<PackageItem>;
    const unit = SCOPE_UNITS.includes(e.unit as ScopeUnit) ? (e.unit as ScopeUnit) : null;
    if (!unit) continue;
    const key = String(e.key ?? unit)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9_]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 30) || unit;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      key,
      label: String(e.label ?? UNIT_LABEL[unit].many).trim().slice(0, 60) || UNIT_LABEL[unit].many,
      unit,
      qty: clampInt(e.qty, 0, 999),
      extraPrice: Math.max(0, Math.min(100_000, Math.round(Number(e.extraPrice) * 100) / 100 || 0)),
    });
  }
  return { items, rolloverUnused: input.rolloverUnused === true };
}

// Formato do post no calendário → unidade do pacote.
export function formatUnit(format: string | null | undefined): ScopeUnit {
  const f = (format ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (/reel|video|tiktok|short/.test(f)) return "reel";
  if (/carross|carousel/.test(f)) return "carrossel";
  if (/stor/.test(f)) return "story";
  return "post";
}

export type ConsumptionInput = {
  posts: { format: string; scheduledFor: string; status: string }[];
  projects: { createdAt: string }[];
  meetings: { scheduledAt: string }[];
  reports: { month: string }[];
  // pedidos do portal dentro do pacote ainda em produção: reservam a cota
  // até a peça entrar no calendário (ou a demanda ser concluída)
  reserved?: { unit: ScopeUnit; qty: number; createdAt: string }[];
};
export type Consumption = Record<ScopeUnit, number>;

export const monthOf = (isoOrLocal: string) => isoOrLocal.slice(0, 7);

export function previousMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return d.toISOString().slice(0, 7);
}

// O que já saiu (ou está marcado para sair) no mês. Post cancelado não conta.
export function consumption(month: string, input: ConsumptionInput): Consumption {
  const out = Object.fromEntries(SCOPE_UNITS.map((u) => [u, 0])) as Consumption;
  for (const post of input.posts) {
    if (post.status === "canceled" || monthOf(post.scheduledFor) !== month) continue;
    out[formatUnit(post.format)] += 1;
  }
  out.demanda += input.projects.filter((p) => monthOf(p.createdAt) === month).length;
  out["reunião"] += input.meetings.filter((m) => monthOf(m.scheduledAt) === month).length;
  out["relatório"] += input.reports.filter((r) => r.month === month).length;
  for (const r of input.reserved ?? []) {
    if (monthOf(r.createdAt) !== month || !SCOPE_UNITS.includes(r.unit)) continue;
    out[r.unit] += Math.max(1, Math.floor(r.qty || 1));
  }
  return out;
}

// Demanda concluída: a peça já foi entregue (e, se for post, está na agenda),
// então a reserva do pedido deixa de contar.
export const DONE_PROJECT_STATUSES = new Set(["approved", "paid"]);

// A sugestão do sistema (IA em cache ou palavras-chave) e o que o cliente
// escolheu: quem classificou de verdade, e se a agência deve conferir.
export function classificationOf(input: {
  chosenKey: string;
  ai: { itemKey: string; confidence: number; reasoning: string } | null;
  rules: { itemKey: string; confidence: number };
}): { classifiedBy: "ai" | "rules" | "manual"; aiReasoning: string; suggestedKey: string; needsReview: boolean } {
  if (input.ai && input.ai.itemKey === input.chosenKey) {
    return { classifiedBy: "ai", aiReasoning: input.ai.reasoning.slice(0, 500), suggestedKey: input.ai.itemKey, needsReview: false };
  }
  const suggestion = input.ai ?? input.rules;
  if (!input.ai && input.rules.itemKey === input.chosenKey) {
    return { classifiedBy: "rules", aiReasoning: "", suggestedKey: input.rules.itemKey, needsReview: false };
  }
  // o cliente escolheu outro item: vale a escolha, mas a agência confere
  // quando a sugestão era confiável
  const confident = input.ai ? input.ai.confidence >= 0.6 : input.rules.confidence >= 0.7;
  return { classifiedBy: "manual", aiReasoning: "", suggestedKey: suggestion.itemKey, needsReview: confident && Boolean(suggestion.itemKey) };
}

export type UsageRow = PackageItem & { used: number; allowance: number; remaining: number };

// Uso por item. Com "acumular o que sobrar", a sobra do mês anterior soma
// (só um mês; nunca negativa).
export function packageUsage(pkg: ClientPackage, current: Consumption, previous?: Consumption): UsageRow[] {
  // itens com a mesma unidade dividem o consumo na ordem do pacote
  const pool = { ...current };
  const prevPool = previous ? { ...previous } : null;
  return pkg.items.map((item) => {
    const used = Math.min(pool[item.unit], item.qty);
    pool[item.unit] -= used;
    let carry = 0;
    if (pkg.rolloverUnused && prevPool) {
      const prevUsed = Math.min(prevPool[item.unit], item.qty);
      prevPool[item.unit] -= prevUsed;
      carry = Math.max(0, item.qty - prevUsed);
    }
    const allowance = item.qty + carry;
    // o que passou da cota deste item conta aqui (último item da unidade)
    const overflow = isLastOfUnit(pkg, item) ? pool[item.unit] : 0;
    const totalUsed = used + overflow;
    return { ...item, used: totalUsed, allowance, remaining: Math.max(0, allowance - totalUsed) };
  });
}

function isLastOfUnit(pkg: ClientPackage, item: PackageItem): boolean {
  const same = pkg.items.filter((i) => i.unit === item.unit);
  return same[same.length - 1]?.key === item.key;
}

export type QuotaVerdict = { inPackage: boolean; extraQty: number; extraTotal: number; remaining: number };

// Um pedido de `qty` unidades do item cabe no que sobrou?
export function quotaCheck(row: Pick<UsageRow, "remaining" | "extraPrice">, qty: number): QuotaVerdict {
  const want = Math.max(1, Math.floor(qty));
  const extraQty = Math.max(0, want - row.remaining);
  return {
    inPackage: extraQty === 0,
    extraQty,
    extraTotal: Math.round(extraQty * row.extraPrice * 100) / 100,
    remaining: row.remaining,
  };
}

// Classificação sem IA (palavras-chave): o menu pré-selecionado e a
// resposta de exemplo quando a IA está em modo de teste.
export function guessItem(text: string, pkg: ClientPackage): { itemKey: string; qty: number; confidence: number } {
  const t = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const qtyMatch = t.match(/\b(\d{1,2})\b/);
  const qty = qtyMatch ? clampInt(qtyMatch[1], 1, 50, 1) : /\b(dois|duas)\b/.test(t) ? 2 : /\btres\b/.test(t) ? 3 : 1;
  const order: [RegExp, ScopeUnit][] = [
    [/reel|video|tiktok/, "reel"],
    [/carross/, "carrossel"],
    [/stor/, "story"],
    [/reuniao|call|conversa|alinhamento/, "reunião"],
    [/relatorio/, "relatório"],
    [/post|arte|feed|publicac/, "post"],
  ];
  for (const [re, unit] of order) {
    if (!re.test(t)) continue;
    const item = pkg.items.find((i) => i.unit === unit);
    if (item) return { itemKey: item.key, qty, confidence: 0.7 };
  }
  const fallback = pkg.items.find((i) => i.unit === "demanda") ?? pkg.items[0];
  return { itemKey: fallback?.key ?? "", qty, confidence: 0.3 };
}

export function describeUsage(rows: UsageRow[]): string {
  return rows.map((r) => `${r.used}/${r.allowance} ${r.label.toLowerCase()}`).join(" · ");
}
