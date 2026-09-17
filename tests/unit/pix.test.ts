import { describe, expect, it } from "vitest";
import { buildPixPayload, crc16, foldText, parsePixPayload, sanitizeTxid, validatePixKey } from "@/lib/pix";
import {
  brazilToday,
  buildDraftItems,
  daysLate,
  dueDateFor,
  invoiceShareText,
  invoiceState,
  invoicesCsv,
  isDraftDay,
  reminderText,
  sanitizeInvoiceSettings,
  settingsReady,
} from "@/lib/invoice-rules";

// Exemplo do Manual de Padrões para Iniciação do Pix (BCB): QR estático.
const BCB_EXAMPLE =
  "00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D";

describe("pix BR Code", () => {
  it("computes CRC16-CCITT-FALSE", () => {
    expect(crc16("123456789")).toBe("29B1");
    expect(crc16(BCB_EXAMPLE.slice(0, -4))).toBe("1D3D");
  });

  it("reproduces the central bank's reference payload", () => {
    expect(buildPixPayload({ key: "123e4567-e12b-12d1-a456-426655440000", name: "Fulano de Tal", city: "BRASILIA" })).toBe(BCB_EXAMPLE);
  });

  it("round-trips key, amount, name, city and txid", () => {
    const payload = buildPixPayload({ key: "contato@agencia.com.br", name: "Agência Solar Ltda", city: "São Paulo", amount: 2800, txid: "MQ-202609-abc" });
    const parsed = parsePixPayload(payload);
    expect(parsed).toMatchObject({
      crcValid: true,
      key: "contato@agencia.com.br",
      amount: 2800,
      name: "Agencia Solar Ltda",
      city: "Sao Paulo",
      txid: "MQ202609abc",
      currency: "986",
    });
    expect(payload).toContain("54072800.00");
    const tampered = payload.replace("2800.00", "2900.00");
    expect(parsePixPayload(tampered).crcValid).toBe(false);
  });

  it("validates and normalizes each key type", () => {
    expect(validatePixKey("529.982.247-25")).toEqual({ ok: true, type: "cpf", key: "52998224725" });
    expect(validatePixKey("529.982.247-24").ok).toBe(false);
    expect(validatePixKey("11.222.333/0001-81")).toEqual({ ok: true, type: "cnpj", key: "11222333000181" });
    expect(validatePixKey("11.222.333/0001-80").ok).toBe(false);
    expect(validatePixKey("+55 (11) 99876-5432")).toEqual({ ok: true, type: "phone", key: "+5511998765432" });
    expect(validatePixKey("(21) 3333-4444")).toEqual({ ok: true, type: "phone", key: "+552133334444" });
    expect(validatePixKey("Pix@Agencia.COM")).toEqual({ ok: true, type: "email", key: "pix@agencia.com" });
    expect(validatePixKey("7d9f0335-8dcc-4054-9bf9-0ad2b3d3a8f1").ok).toBe(true);
    expect(validatePixKey("").ok).toBe(false);
    expect(validatePixKey("não é chave").ok).toBe(false);
  });

  it("folds names and limits txid", () => {
    expect(foldText("  Conceição & Cia. — Ltda  ", 25)).toBe("Conceicao Cia Ltda");
    expect(foldText("Florianópolis", 15)).toBe("Florianopolis");
    expect(sanitizeTxid("")).toBe("***");
    expect(sanitizeTxid("a".repeat(40))).toHaveLength(25);
  });

  it("rejects invalid input when building", () => {
    expect(() => buildPixPayload({ key: "x", name: "A", city: "B" })).toThrow();
    expect(() => buildPixPayload({ key: "pix@a.com", name: "", city: "B" })).toThrow();
  });
});

describe("invoice rules", () => {
  it("drafts fee plus approved extras", () => {
    const draft = buildDraftItems({
      month: "2026-09",
      monthlyFee: 2500,
      extras: [{ id: "s1", text: "post extra do Dia dos Pais", qty: 1, itemLabel: "Posts no feed", extraPrice: 300 }],
    });
    expect(draft.total).toBe(2800);
    expect(draft.items.map((i) => i.kind)).toEqual(["fee", "extra"]);
    expect(draft.items[0].label).toContain("setembro de 2026");
    expect(buildDraftItems({ month: "2026-09", monthlyFee: 0, extras: [] }).items).toHaveLength(0);
  });

  it("marks sent invoices past due as overdue", () => {
    expect(invoiceState({ status: "sent", dueDate: "2026-09-10" }, "2026-09-11")).toBe("overdue");
    expect(invoiceState({ status: "sent", dueDate: "2026-09-10" }, "2026-09-10")).toBe("sent");
    expect(invoiceState({ status: "paid", dueDate: "2026-09-10" }, "2026-10-10")).toBe("paid");
    expect(invoiceState({ status: "paid_claimed", dueDate: "2026-09-10" }, "2026-09-12")).toBe("overdue");
    expect(daysLate("2026-09-10", "2026-09-15")).toBe(5);
  });

  it("creates drafts on day 1 from 6am in Brasília only", () => {
    expect(isDraftDay(new Date("2026-10-01T09:00:00Z"))).toBe(true); // 06:00 BRT
    expect(isDraftDay(new Date("2026-10-01T08:59:00Z"))).toBe(false);
    expect(isDraftDay(new Date("2026-10-02T02:00:00Z"))).toBe(true); // ainda dia 1 em BRT
    expect(brazilToday(new Date("2026-10-01T02:00:00Z"))).toBe("2026-09-30");
    expect(dueDateFor("2026-09", 31)).toBe("2026-09-28");
  });

  it("needs key, name and city before sending", () => {
    expect(settingsReady(sanitizeInvoiceSettings({ pixKey: "pix@a.com", beneficiaryName: "A", city: "B" }))).toBe(true);
    expect(settingsReady(sanitizeInvoiceSettings({ pixKey: "pix@a.com" }))).toBe(false);
    expect(sanitizeInvoiceSettings({ dueDay: 40 }).dueDay).toBe(28);
  });

  it("writes the WhatsApp texts and the CSV", () => {
    const text = invoiceShareText({ agencyName: "Solar", clientName: "Café", month: "2026-09", total: 2800, dueDate: "2026-09-10", url: "https://x/fatura/t" });
    expect(text).toContain("R$ 2.800,00");
    expect(text).toContain("vence em 10/09");
    expect(reminderText({ agencyName: "Solar", total: 2800, dueDate: "2026-09-10", url: "u", today: "2026-09-15" })).toContain("venceu em 10/09");
    expect(invoiceShareText({ agencyName: "Solar", clientName: "Café", month: "2026-09", total: 10, dueDate: "2026-09-10", url: "u", lang: "en" })).toContain("billed in BRL");
    const csv = invoicesCsv([{ clientName: "Café; Bar", month: "2026-09", total: 2800, dueDate: "2026-09-10", state: "paid", paidAt: "2026-09-09T10:00:00Z" }]);
    expect(csv.split("\n")[1]).toBe('"Café; Bar";2026-09;2800,00;2026-09-10;paid;2026-09-09');
  });
});

describe("pix key ambiguity", () => {
  it("reads 11 loose digits as CPF unless they look like a mobile number", () => {
    expect(validatePixKey("52998224725")).toMatchObject({ type: "cpf" });
    expect(validatePixKey("11998765432")).toEqual({ ok: true, type: "phone", key: "+5511998765432" });
    expect(validatePixKey("12345678900").ok).toBe(false);
  });
});
