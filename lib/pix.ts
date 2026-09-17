// Pix "copia e cola" estático (BR Code, padrão EMV do Banco Central), gerado
// localmente a partir da chave Pix da agência. Nenhum dinheiro passa pela
// Marqa: o pagamento cai direto na conta da agência. Puro, sem dependências.

export type PixKeyType = "cpf" | "cnpj" | "email" | "phone" | "random";

const onlyDigits = (s: string) => s.replace(/\D/g, "");

function cpfValid(d: string): boolean {
  if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}

function cnpjValid(d: string): boolean {
  if (!/^\d{14}$/.test(d) || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (len: number) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((acc, w, i) => acc + w * Number(d[i]), 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}

// Valida e normaliza a chave. Telefone vira +55DDDNÚMERO; CPF/CNPJ só dígitos.
export function validatePixKey(raw: string): { ok: true; type: PixKeyType; key: string } | { ok: false; error: string } {
  const value = (raw ?? "").trim();
  if (!value) return { ok: false, error: "Informe a chave Pix." };
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    return { ok: true, type: "random", key: value.toLowerCase() };
  }
  if (value.includes("@")) {
    const email = value.toLowerCase();
    if (email.length > 77 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false, error: "E-mail inválido para chave Pix." };
    return { ok: true, type: "email", key: email };
  }
  const digits = onlyDigits(value);
  if (/^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(value)) {
    return cpfValid(digits) ? { ok: true, type: "cpf", key: digits } : { ok: false, error: "CPF inválido." };
  }
  const looksPhone = value.startsWith("+") || /^\(\d{2}\)\s?9?\d{4}-?\d{4}$/.test(value);
  if (!looksPhone && digits.length === 11) {
    if (cpfValid(digits)) return { ok: true, type: "cpf", key: digits };
    // 11 dígitos soltos só viram celular se o 3º dígito for 9
    if (digits[2] !== "9") return { ok: false, error: "CPF inválido." };
  }
  if (digits.length === 14 && !value.startsWith("+")) {
    return cnpjValid(digits) ? { ok: true, type: "cnpj", key: digits } : { ok: false, error: "CNPJ inválido." };
  }
  const national = digits.startsWith("55") && (digits.length === 12 || digits.length === 13) ? digits.slice(2) : digits;
  if ((national.length === 10 || national.length === 11) && /^[1-9]{2}/.test(national)) {
    return { ok: true, type: "phone", key: `+55${national}` };
  }
  if (digits.length === 11) return { ok: false, error: "CPF inválido." };
  return { ok: false, error: "Chave Pix inválida. Use CPF, CNPJ, e-mail, celular ou chave aleatória." };
}

// Nome/cidade: sem acento, só letras, números e espaço (o que todo banco lê).
export function foldText(value: string, max: number): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
    .trim();
}

// Identificador da transação (campo 62-05): até 25 caracteres alfanuméricos.
export function sanitizeTxid(value: string | null | undefined): string {
  const clean = (value ?? "").replace(/[^A-Za-z0-9]/g, "").slice(0, 25);
  return clean || "***";
}

const tlv = (id: string, value: string) => `${id}${String(value.length).padStart(2, "0")}${value}`;

export function crc16(payload: string): string {
  let crc = 0xffff;
  const bytes = new TextEncoder().encode(payload);
  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export type PixInput = { key: string; name: string; city: string; amount?: number; txid?: string; description?: string };

export function buildPixPayload(input: PixInput): string {
  const key = validatePixKey(input.key);
  if (!key.ok) throw new Error(key.error);
  const name = foldText(input.name, 25);
  const city = foldText(input.city, 15);
  if (!name) throw new Error("Informe o nome de quem recebe.");
  if (!city) throw new Error("Informe a cidade de quem recebe.");
  const description = foldText(input.description ?? "", 40);
  let account = tlv("00", "br.gov.bcb.pix") + tlv("01", key.key);
  // a descrição é opcional e não pode estourar o campo 26 (99 caracteres)
  if (description && account.length + 4 + description.length <= 99) account += tlv("02", description);
  let payload = tlv("00", "01") + tlv("26", account) + tlv("52", "0000") + tlv("53", "986");
  if (input.amount !== undefined && input.amount > 0) payload += tlv("54", input.amount.toFixed(2));
  payload += tlv("58", "BR") + tlv("59", name) + tlv("60", city) + tlv("62", tlv("05", sanitizeTxid(input.txid)));
  payload += "6304";
  return payload + crc16(payload);
}

export type ParsedPix = {
  crcValid: boolean;
  key: string;
  description: string;
  amount: number | null;
  name: string;
  city: string;
  txid: string;
  currency: string;
};

function readTlv(data: string): Map<string, string> {
  const out = new Map<string, string>();
  let i = 0;
  while (i + 4 <= data.length) {
    const id = data.slice(i, i + 2);
    const len = Number(data.slice(i + 2, i + 4));
    if (!Number.isFinite(len)) break;
    out.set(id, data.slice(i + 4, i + 4 + len));
    i += 4 + len;
  }
  return out;
}

// Lê de volta um BR Code estático (testes e conferência na tela).
export function parsePixPayload(payload: string): ParsedPix {
  const fields = readTlv(payload);
  const crc = fields.get("63") ?? "";
  const crcValid = crc.length === 4 && payload.endsWith(crc) && crc16(payload.slice(0, -4)) === crc;
  const account = readTlv(fields.get("26") ?? "");
  const extra = readTlv(fields.get("62") ?? "");
  const amount = fields.get("54");
  return {
    crcValid,
    key: account.get("01") ?? "",
    description: account.get("02") ?? "",
    amount: amount ? Number(amount) : null,
    name: fields.get("59") ?? "",
    city: fields.get("60") ?? "",
    txid: extra.get("05") ?? "",
    currency: fields.get("53") ?? "",
  };
}
