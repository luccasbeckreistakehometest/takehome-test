import fs from "fs";
import path from "path";

// Transporte da API do Mercado Pago. Em produção: HTTPS com o token do
// ambiente. Com MP_TRANSPORT=file (testes), nada sai da máquina: cada
// requisição é anotada em DATA_DIR/mp-outbox.json e as leituras vêm de
// DATA_DIR/mp-fake.json (o teste escreve ali o que o "MP" responderia).

const BASE = "https://api.mercadopago.com";

export function mpFileTransport(): boolean {
  return process.env.MP_TRANSPORT === "file";
}

const dataDir = () => process.env.DATA_DIR ?? path.join(process.cwd(), "data");
const outboxPath = () => path.join(dataDir(), "mp-outbox.json");
const fakePath = () => path.join(dataDir(), "mp-fake.json");

type FakeStore = { preapprovals: Record<string, Record<string, unknown>>; authorized_payments: Record<string, Record<string, unknown>>; seq: number };

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file);
}

function fakeRequest(method: string, urlPath: string, body: Record<string, unknown> | undefined): Record<string, unknown> {
  const outbox = readJson<unknown[]>(outboxPath(), []);
  outbox.push({ method, path: urlPath, body: body ?? null, at: new Date().toISOString() });
  writeJson(outboxPath(), outbox);
  const store = readJson<FakeStore>(fakePath(), { preapprovals: {}, authorized_payments: {}, seq: 0 });
  store.preapprovals ??= {};
  store.authorized_payments ??= {};
  const preapproval = urlPath.match(/^\/preapproval\/([^/?]+)$/);
  const authorized = urlPath.match(/^\/authorized_payments\/([^/?]+)$/);
  if (method === "POST" && urlPath === "/preapproval") {
    store.seq = (store.seq ?? 0) + 1;
    const id = `fake-pre-${store.seq}`;
    const record = {
      ...(body ?? {}),
      id,
      status: "pending",
      init_point: `${(process.env.APP_URL ?? "").replace(/\/$/, "")}/plans?sub=fake&preapproval=${id}`,
      date_created: new Date().toISOString(),
    };
    store.preapprovals[id] = record;
    writeJson(fakePath(), store);
    return record;
  }
  if (preapproval && method === "PUT") {
    const current = store.preapprovals[preapproval[1]];
    if (!current) throw new MpError(404, "preapproval not found");
    store.preapprovals[preapproval[1]] = { ...current, ...(body ?? {}) };
    writeJson(fakePath(), store);
    return store.preapprovals[preapproval[1]];
  }
  if (preapproval && method === "GET") {
    const current = store.preapprovals[preapproval[1]];
    if (!current) throw new MpError(404, "preapproval not found");
    return current;
  }
  if (authorized && method === "GET") {
    const current = store.authorized_payments[authorized[1]];
    if (!current) throw new MpError(404, "authorized payment not found");
    return current;
  }
  throw new MpError(501, `fake transport: ${method} ${urlPath} não simulado`);
}

export class MpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function mpApi(method: "GET" | "POST" | "PUT", urlPath: string, body?: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (mpFileTransport()) return fakeRequest(method, urlPath, body);
  const token = process.env.MP_ACCESS_TOKEN || "";
  if (!token) throw new MpError(503, "MP_ACCESS_TOKEN ausente");
  const res = await fetch(BASE + urlPath, {
    method,
    signal: AbortSignal.timeout(15_000),
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new MpError(res.status, (data?.message as string) ?? `Mercado Pago ${res.status}`);
  return data;
}
