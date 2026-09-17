// Utilidades PURAS do calendário de conteúdo: chave de dia, grade do mês
// (semanas de domingo a sábado, padrão brasileiro), semana de uma data e
// "buracos" (dias futuros sem conteúdo). Sem banco, sem React.

export type CalendarPostLike = {
  id: string;
  scheduledFor: string; // "YYYY-MM-DDTHH:mm" (hora local) ou ISO com Z
  status: "draft" | "scheduled" | "published" | "canceled";
};

const pad = (n: number) => String(n).padStart(2, "0");

export function keyOf(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Dia local do post. Strings sem fuso ("2026-09-18T10:00") são lidas pelo
// prefixo; ISO com Z é convertido para o dia local.
export function dateKey(scheduledFor: string): string {
  if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$/.test(scheduledFor)) return scheduledFor.slice(0, 10);
  const date = new Date(scheduledFor);
  return Number.isNaN(date.getTime()) ? scheduledFor.slice(0, 10) : keyOf(date);
}

export function parseKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: string, n: number): string {
  const date = parseKey(key);
  date.setDate(date.getDate() + n);
  return keyOf(date);
}

export function todayKey(now: Date = new Date()): string {
  return keyOf(now);
}

export function addMonths(key: string, n: number): string {
  const date = parseKey(key);
  date.setDate(1);
  date.setMonth(date.getMonth() + n);
  return keyOf(date);
}

// Grade do mês: linhas de 7 dias começando no domingo, cobrindo o mês
// inteiro (5 ou 6 linhas). Dias de outros meses vêm marcados.
export function monthGrid(anchorKey: string): { key: string; inMonth: boolean }[][] {
  const anchor = parseKey(anchorKey);
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = addDays(keyOf(first), -first.getDay());
  const month = anchor.getMonth();
  const rows: { key: string; inMonth: boolean }[][] = [];
  let cursor = start;
  for (let row = 0; row < 6; row++) {
    const week: { key: string; inMonth: boolean }[] = [];
    for (let col = 0; col < 7; col++) {
      week.push({ key: cursor, inMonth: parseKey(cursor).getMonth() === month });
      cursor = addDays(cursor, 1);
    }
    rows.push(week);
    // para depois de cobrir o mês (evita uma 6ª linha vazia)
    if (row >= 3 && parseKey(cursor).getMonth() !== month) break;
  }
  return rows;
}

// Semana (domingo a sábado) que contém a data.
export function weekOf(anchorKey: string): string[] {
  const anchor = parseKey(anchorKey);
  const start = addDays(anchorKey, -anchor.getDay());
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function groupByDay<T extends CalendarPostLike>(posts: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const post of posts) {
    const key = dateKey(post.scheduledFor);
    const list = map.get(key) ?? [];
    list.push(post);
    map.set(key, list);
  }
  for (const list of map.values()) list.sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
  return map;
}

export type ContentGaps = {
  emptyDays: string[]; // dias (de hoje em diante, dentro do intervalo) sem conteúdo
  streaks: { start: string; end: string; length: number }[]; // sequências de 3+ dias vazios
};

// Buracos: dias do intervalo, a partir de `from`, sem nenhum post que conte
// (cancelado não conta). Sequências de 3+ dias viram alerta.
export function findContentGaps(
  posts: CalendarPostLike[],
  days: string[],
  from: string
): ContentGaps {
  const filled = new Set(posts.filter((p) => p.status !== "canceled").map((p) => dateKey(p.scheduledFor)));
  const emptyDays = days.filter((day) => day >= from && !filled.has(day));
  const streaks: ContentGaps["streaks"] = [];
  let run: string[] = [];
  const flush = () => {
    if (run.length >= 3) streaks.push({ start: run[0], end: run[run.length - 1], length: run.length });
    run = [];
  };
  for (const day of days) {
    if (day >= from && !filled.has(day)) {
      if (run.length && addDays(run[run.length - 1], 1) !== day) flush();
      run.push(day);
    } else {
      flush();
    }
  }
  flush();
  return { emptyDays, streaks };
}
