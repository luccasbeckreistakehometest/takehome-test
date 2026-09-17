// Cobrança do fee por Pix (puro): rascunho do mês, vencimento, estado
// (inclui "atrasada"), lembrete e texto para o WhatsApp.

export type InvoiceItem = { label: string; amount: number; kind: "fee" | "extra" | "manual"; ref?: string };
export type InvoiceStatus = "draft" | "sent" | "paid_claimed" | "paid" | "void";
export type InvoiceState = InvoiceStatus | "overdue";

export type InvoiceSettings = {
  pixKey: string;
  beneficiaryName: string;
  city: string;
  dueDay: number;
  lateNote: string;
};

export const DEFAULT_INVOICE_SETTINGS: InvoiceSettings = { pixKey: "", beneficiaryName: "", city: "", dueDay: 10, lateNote: "" };

export function sanitizeInvoiceSettings(input: Partial<InvoiceSettings>): InvoiceSettings {
  const dueDay = Math.floor(Number(input.dueDay));
  return {
    pixKey: String(input.pixKey ?? "").trim().slice(0, 80),
    beneficiaryName: String(input.beneficiaryName ?? "").trim().slice(0, 60),
    city: String(input.city ?? "").trim().slice(0, 40),
    dueDay: Number.isFinite(dueDay) ? Math.max(1, Math.min(28, dueDay)) : DEFAULT_INVOICE_SETTINGS.dueDay,
    lateNote: String(input.lateNote ?? "").trim().slice(0, 200),
  };
}

const money = (n: number) => Math.round(n * 100) / 100;

export function monthLabelPt(month: string): string {
  const names = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const [y, m] = month.split("-").map(Number);
  return `${names[m - 1] ?? month} de ${y}`;
}

// Rascunho do mês: fee + extras aprovados (+ linhas avulsas).
export function buildDraftItems(input: {
  month: string;
  monthlyFee: number;
  extras: { id: string; text: string; qty: number; itemLabel: string; extraPrice: number }[];
  manual?: { label: string; amount: number }[];
}): { items: InvoiceItem[]; total: number } {
  const items: InvoiceItem[] = [];
  if (input.monthlyFee > 0) items.push({ label: `Fee mensal — ${monthLabelPt(input.month)}`, amount: money(input.monthlyFee), kind: "fee" });
  for (const extra of input.extras) {
    if (extra.extraPrice <= 0) continue;
    items.push({ label: `Extra: ${extra.qty}× ${extra.itemLabel || "item"} — ${extra.text.slice(0, 60)}`, amount: money(extra.extraPrice), kind: "extra", ref: extra.id });
  }
  for (const line of input.manual ?? []) {
    if (!line.label.trim() || !(line.amount > 0)) continue;
    items.push({ label: line.label.trim().slice(0, 120), amount: money(line.amount), kind: "manual" });
  }
  return { items, total: invoiceTotal(items) };
}

export function invoiceTotal(items: InvoiceItem[]): number {
  return money(items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0));
}

export function dueDateFor(month: string, dueDay: number): string {
  const day = String(Math.max(1, Math.min(28, Math.floor(dueDay)))).padStart(2, "0");
  return `${month}-${day}`;
}

// Data de hoje em Brasília (o vencimento é uma data, sem hora).
export function brazilToday(now: Date = new Date()): string {
  return new Date(now.getTime() - 3 * 3_600_000).toISOString().slice(0, 10);
}

export function invoiceState(invoice: { status: InvoiceStatus; dueDate: string }, today: string): InvoiceState {
  if ((invoice.status === "sent" || invoice.status === "paid_claimed") && invoice.dueDate < today) return "overdue";
  return invoice.status;
}

export function daysLate(dueDate: string, today: string): number {
  const ms = Date.parse(`${today}T00:00:00Z`) - Date.parse(`${dueDate}T00:00:00Z`);
  return Math.max(0, Math.round(ms / 86_400_000));
}

export function daysUntil(dueDate: string, today: string): number {
  const ms = Date.parse(`${dueDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

// O agendador cria os rascunhos no dia 1 (a partir das 6h de Brasília).
export function isDraftDay(now: Date = new Date()): boolean {
  const brt = new Date(now.getTime() - 3 * 3_600_000);
  return brt.getUTCDate() === 1 && brt.getUTCHours() >= 6;
}

export function settingsReady(settings: InvoiceSettings): boolean {
  return Boolean(settings.pixKey && settings.beneficiaryName && settings.city);
}

const brl = (n: number) => `R$ ${n.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;

export function invoiceShareText(input: { agencyName: string; clientName: string; month: string; total: number; dueDate: string; url: string; lang?: "pt-BR" | "en" }): string {
  const due = `${input.dueDate.slice(8, 10)}/${input.dueDate.slice(5, 7)}`;
  if (input.lang === "en") {
    return `Hi! Here is ${input.agencyName}'s invoice for ${input.month}: ${brl(input.total)} (billed in BRL), due ${due}. Pay by Pix with the QR code or the copy-and-paste code: ${input.url}`;
  }
  return `Oi! Segue a fatura da ${input.agencyName} de ${monthLabelPt(input.month)} para ${input.clientName}: ${brl(input.total)}, vence em ${due}. É só pagar pelo Pix com o QR ou o copia e cola: ${input.url}`;
}

export function reminderText(input: { agencyName: string; total: number; dueDate: string; url: string; today: string; lang?: "pt-BR" | "en" }): string {
  const late = daysLate(input.dueDate, input.today);
  const due = `${input.dueDate.slice(8, 10)}/${input.dueDate.slice(5, 7)}`;
  if (input.lang === "en") {
    return late > 0
      ? `Hi! A friendly reminder from ${input.agencyName}: the invoice of ${brl(input.total)} was due on ${due}. If it's already paid, just tap "I've paid" on the page: ${input.url}`
      : `Hi! A reminder from ${input.agencyName}: the invoice of ${brl(input.total)} is due on ${due}. Pix code here: ${input.url}`;
  }
  return late > 0
    ? `Oi! Passando para lembrar: a fatura de ${brl(input.total)} da ${input.agencyName} venceu em ${due}. Se já pagou, é só tocar em "Já paguei" na página: ${input.url}`
    : `Oi! Lembrete da ${input.agencyName}: a fatura de ${brl(input.total)} vence em ${due}. O Pix está aqui: ${input.url}`;
}

export function invoicesCsv(rows: { clientName: string; month: string; total: number; dueDate: string; state: InvoiceState; paidAt: string | null }[]): string {
  const esc = (v: string) => (/[",;\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = ["cliente;mes;total;vencimento;situacao;pago_em"];
  for (const r of rows) {
    lines.push([esc(r.clientName), r.month, r.total.toFixed(2).replace(".", ","), r.dueDate, r.state, r.paidAt ? r.paidAt.slice(0, 10) : ""].join(";"));
  }
  return lines.join("\n");
}
