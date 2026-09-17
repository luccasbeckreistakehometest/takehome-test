// Margem por conta (puro): receita confirmada (R$) contra o custo real de IA
// (US$ convertidos por uma taxa fixa de referência). Sem banco.

export type RevenueRow = { accountType: string | null; accountId: string | null; revenueBrl: number };
export type CostRow = { accountType: string | null; accountId: string | null; costUsd: number; calls: number };

export type MarginRow = {
  accountType: string;
  accountId: string;
  revenueBrl: number;
  costUsd: number;
  costBrl: number;
  marginBrl: number;
  // null quando não houve receita (margem percentual não faz sentido)
  marginPct: number | null;
  calls: number;
};

export function usdBrlRate(raw: string | undefined = process.env.USD_BRL_RATE): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 5.5;
}

const keyOf = (t: string | null, id: string | null) => `${t ?? ""}|${id ?? ""}`;

export function computeMargins(revenue: RevenueRow[], costs: CostRow[], rate: number): MarginRow[] {
  const rows = new Map<string, MarginRow>();
  const ensure = (t: string | null, id: string | null): MarginRow | null => {
    if (!t || !id) return null;
    const key = keyOf(t, id);
    let row = rows.get(key);
    if (!row) {
      row = { accountType: t, accountId: id, revenueBrl: 0, costUsd: 0, costBrl: 0, marginBrl: 0, marginPct: null, calls: 0 };
      rows.set(key, row);
    }
    return row;
  };
  for (const r of revenue) {
    const row = ensure(r.accountType, r.accountId);
    if (row) row.revenueBrl += Number(r.revenueBrl) || 0;
  }
  for (const c of costs) {
    const row = ensure(c.accountType, c.accountId);
    if (!row) continue;
    row.costUsd += Number(c.costUsd) || 0;
    row.calls += Number(c.calls) || 0;
  }
  const out = [...rows.values()].map((row) => {
    const costBrl = round2(row.costUsd * rate);
    const marginBrl = round2(row.revenueBrl - costBrl);
    return {
      ...row,
      revenueBrl: round2(row.revenueBrl),
      costUsd: Math.round(row.costUsd * 10_000) / 10_000,
      costBrl,
      marginBrl,
      marginPct: row.revenueBrl > 0 ? Math.round((marginBrl / row.revenueBrl) * 1000) / 10 : null,
    };
  });
  // piores primeiro: quem dá prejuízo aparece no topo
  return out.sort((a, b) => a.marginBrl - b.marginBrl);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// Teto diário efetivo de uma conta: o ajuste do admin vale sobre o padrão.
export function effectiveAccountCap(defaultCap: number, override: number | null | undefined): number {
  if (override === null || override === undefined || !Number.isFinite(override) || override < 0) return defaultCap;
  return override;
}
