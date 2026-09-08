"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button, Card, ErrorBox, Input, Label, SectionTitle, Select, Tag } from "./ui";
import { Icon } from "./icons";
import { fmtCurrency, fmtNum, useUiLang } from "@/lib/i18n";

type Sale = {
  id: string;
  source: string;
  kind: "product" | "service";
  periodStart: string;
  periodEnd: string;
  revenue: number;
  units: number;
  currency: string;
};
type Totals = {
  revenue: number;
  units: number;
  entries: number;
  currency: string;
  byKind: { product: number; service: number };
};
type Connection = {
  platform: string;
  accountId: string;
  status: string;
  lastSyncAt: string | null;
  lastError: string;
  hasToken: boolean;
};
type Snapshot = {
  platform: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  periodStart: string;
  periodEnd: string;
};

const PLATFORMS = [
  { key: "ga4", label: "Google Analytics 4", account: "Property ID" },
  { key: "meta_ads", label: "Meta Ads (FB/IG)", account: "Ad Account ID (act_...)" },
  { key: "google_ads", label: "Google Ads", account: "Customer ID" },
  { key: "tiktok_ads", label: "TikTok Ads", account: "Advertiser ID" },
  { key: "sales_api", label: "API de vendas / marketplace", account: "Loja / Seller ID" },
];

// Painel genérico de vendas + integrações de dados. Funciona para produto
// (unidades) e serviço (negócios). Vendas por entrada manual ou CSV.
export default function SalesIntegrations({ clientId }: { clientId: string }) {
  const lang = useUiLang();
  // Vendas importadas mantêm a moeda de origem (não converte); só o locale.
  const brl = (n: number, currency = "BRL") => fmtCurrency(n, currency, lang);
  const [sales, setSales] = useState<Sale[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api<{ sales: Sale[]; totals: Totals }>(`/api/clients/${clientId}/sales`).then((r) => {
      setSales(r.sales);
      setTotals(r.totals);
    });
    api<{ connections: Connection[] }>(`/api/clients/${clientId}/connections`).then((r) =>
      setConnections(r.connections)
    );
    api<{ snapshots: Snapshot[] }>(`/api/clients/${clientId}/sync`).then((r) => setSnapshots(r.snapshots));
  }, [clientId]);

  useEffect(() => load(), [load]);

  const [form, setForm] = useState({
    source: "",
    kind: "product" as "product" | "service",
    periodStart: "",
    periodEnd: "",
    revenue: "",
    units: "",
  });

  async function addSale() {
    setError("");
    try {
      await api(`/api/clients/${clientId}/sales`, {
        method: "POST",
        body: JSON.stringify({
          ...form,
          revenue: Number(form.revenue) || 0,
          units: Number(form.units) || 0,
          currency: "BRL",
        }),
      });
      setForm({ source: "", kind: form.kind, periodStart: "", periodEnd: "", revenue: "", units: "" });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar venda");
    }
  }

  // CSV: source,kind,periodStart,periodEnd,revenue,units
  async function importCsv(file: File) {
    const text = await file.text();
    const lines = text.trim().split(/\r?\n/);
    const header = lines[0]?.toLowerCase();
    const start = header?.includes("source") || header?.includes("revenue") ? 1 : 0;
    const rows = lines.slice(start).map((line) => {
      const [source, kind, periodStart, periodEnd, revenue, units] = line.split(",");
      return {
        source: (source ?? "").trim(),
        kind: (kind ?? "").trim() === "service" ? "service" : "product",
        periodStart: (periodStart ?? "").trim(),
        periodEnd: (periodEnd ?? "").trim(),
        revenue: Number(revenue) || 0,
        units: Number(units) || 0,
        currency: "BRL",
      };
    });
    await api(`/api/clients/${clientId}/sales`, {
      method: "POST",
      body: JSON.stringify({ rows }),
    });
    load();
  }

  async function connect(
    platform: string,
    accountId: string,
    accessToken: string,
    oauth?: { refreshToken: string; oauthClientId: string; oauthClientSecret: string }
  ) {
    await api(`/api/clients/${clientId}/connections`, {
      method: "POST",
      body: JSON.stringify({ platform, accountId, accessToken, ...oauth }),
    });
    load();
  }

  async function sync() {
    setError("");
    try {
      await api(`/api/clients/${clientId}/sync`, { method: "POST" });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao sincronizar");
    }
  }

  return (
    <div className="space-y-6">
      {/* Totais */}
      {totals && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Card>
            <p className="text-xs uppercase tracking-wide text-muted">Receita total</p>
            <p className="mt-1 font-[family-name:var(--font-display)] text-3xl font-bold text-accent">
              {brl(totals.revenue, totals.currency)}
            </p>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-wide text-muted">Unidades / negócios</p>
            <p className="mt-1 font-[family-name:var(--font-display)] text-3xl font-bold">
              {fmtNum(totals.units, lang)}
            </p>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-wide text-muted">Produto vs serviço</p>
            <p className="mt-1 text-sm">
              <span className="text-accent">{brl(totals.byKind.product, totals.currency)}</span> produto
              <br />
              <span className="text-accent">{brl(totals.byKind.service, totals.currency)}</span> serviço
            </p>
          </Card>
        </div>
      )}

      {error && <ErrorBox message={error} />}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Registrar venda */}
        <Card>
          <SectionTitle>
            <span className="flex items-center gap-1.5"><Icon name="money" size={15} /> Registrar vendas</span>
          </SectionTitle>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Origem</Label>
                <Input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="Shopify, Mercado Livre, contratos..." />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as "product" | "service" })}>
                  <option value="product">Produto (unidades)</option>
                  <option value="service">Serviço (negócios)</option>
                </Select>
              </div>
              <div>
                <Label>Início do período</Label>
                <Input type="date" value={form.periodStart} onChange={(e) => setForm({ ...form, periodStart: e.target.value })} />
              </div>
              <div>
                <Label>Fim do período</Label>
                <Input type="date" value={form.periodEnd} onChange={(e) => setForm({ ...form, periodEnd: e.target.value })} />
              </div>
              <div>
                <Label>Receita (R$)</Label>
                <Input type="number" value={form.revenue} onChange={(e) => setForm({ ...form, revenue: e.target.value })} />
              </div>
              <div>
                <Label>Unidades / negócios</Label>
                <Input type="number" value={form.units} onChange={(e) => setForm({ ...form, units: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={addSale} disabled={!form.revenue}>
                <Icon name="plus" size={15} /> Adicionar
              </Button>
              <label className="cursor-pointer rounded-md border border-edge bg-surface-2 px-3 py-2 text-sm transition-colors hover:border-accent">
                Importar CSV
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])}
                />
              </label>
            </div>
            <p className="text-xs text-muted">
              CSV: <code>origem,tipo,inicio,fim,receita,unidades</code> (tipo = product|service)
            </p>
          </div>
        </Card>

        {/* Integrações de dados */}
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <SectionTitle>
              <span className="flex items-center gap-1.5"><Icon name="link" size={15} /> Integrações de dados</span>
            </SectionTitle>
            <Button variant="ghost" onClick={sync}>
              <Icon name="radar" size={14} /> Sincronizar
            </Button>
          </div>
          <div className="space-y-2">
            {PLATFORMS.map((p) => {
              const conn = connections.find((c) => c.platform === p.key);
              return (
                <ConnectionRow
                  key={p.key}
                  platform={p}
                  conn={conn}
                  onConnect={connect}
                />
              );
            })}
          </div>
          {snapshots.length > 0 && (
            <div className="mt-4 space-y-1.5 border-t border-edge pt-3">
              <p className="text-xs uppercase tracking-wide text-muted">Últimas métricas (30 dias)</p>
              {snapshots.map((s) => (
                <div key={s.platform} className="flex items-center justify-between rounded-md bg-surface-2 px-3 py-1.5 text-xs">
                  <span className="font-medium">{s.platform}</span>
                  <span className="text-muted">
                    {s.spend > 0 && `${brl(s.spend)} invest · `}
                    {s.clicks > 0 && `${fmtNum(s.clicks, lang)} cliques · `}
                    {s.revenue > 0 && `${brl(s.revenue)} receita`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Histórico de vendas */}
      {sales.length > 0 && (
        <Card>
          <SectionTitle>Histórico de vendas</SectionTitle>
          <div className="space-y-1.5">
            {sales.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-md border border-edge bg-surface-2 px-3 py-2 text-sm">
                <span className="flex items-center gap-2">
                  <Tag>{s.kind === "product" ? "Produto" : "Serviço"}</Tag>
                  <span className="font-medium">{s.source || "—"}</span>
                  <span className="text-xs text-muted">
                    {s.periodStart && `${s.periodStart}${s.periodEnd ? ` → ${s.periodEnd}` : ""}`}
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-semibold text-accent">{brl(s.revenue, s.currency)}</span>
                  <span className="text-xs text-muted">{s.units} un.</span>
                  <button
                    onClick={async () => {
                      await api(`/api/clients/${clientId}/sales?saleId=${s.id}`, { method: "DELETE" });
                      load();
                    }}
                    className="text-muted transition-colors hover:text-red-500"
                  >
                    <Icon name="trash" size={15} />
                  </button>
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

type OAuthFields = { refreshToken: string; oauthClientId: string; oauthClientSecret: string };

function ConnectionRow({
  platform,
  conn,
  onConnect,
}: {
  platform: { key: string; label: string; account: string };
  conn?: Connection;
  onConnect: (platform: string, accountId: string, token: string, oauth?: OAuthFields) => void;
}) {
  const [open, setOpen] = useState(false);
  const [accountId, setAccountId] = useState(conn?.accountId ?? "");
  const [token, setToken] = useState("");
  const [refreshToken, setRefreshToken] = useState("");
  const [oauthClientId, setOauthClientId] = useState("");
  const [oauthClientSecret, setOauthClientSecret] = useState("");
  const supportsOAuth = platform.key === "ga4"; // GA4/Google usa refresh token

  return (
    <div className="rounded-md border border-edge bg-surface-2 px-3 py-2 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-medium">{platform.label}</span>
        <span className="flex items-center gap-2">
          {conn?.status === "connected" ? (
            <span className="text-xs text-emerald-500">conectado ✓</span>
          ) : conn?.status === "error" ? (
            <span className="text-xs text-red-500">erro</span>
          ) : (
            <span className="text-xs text-muted">não conectado</span>
          )}
          <button onClick={() => setOpen(!open)} className="text-xs text-accent hover:underline">
            {open ? "fechar" : "configurar"}
          </button>
        </span>
      </div>
      {conn?.lastError && <p className="mt-1 text-xs text-red-500">{conn.lastError}</p>}
      {open && (
        <div className="mt-2 space-y-2">
          <Input value={accountId} onChange={(e) => setAccountId(e.target.value)} placeholder={platform.account} />
          <Input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Token de acesso" />
          {supportsOAuth && (
            <div className="space-y-2 rounded border border-edge bg-surface p-2">
              <p className="text-[11px] text-muted">
                Opcional — OAuth para renovar o token automaticamente (o token do GA4 expira em ~1h):
              </p>
              <Input type="password" value={refreshToken} onChange={(e) => setRefreshToken(e.target.value)} placeholder="Refresh token" />
              <Input value={oauthClientId} onChange={(e) => setOauthClientId(e.target.value)} placeholder="OAuth Client ID" />
              <Input type="password" value={oauthClientSecret} onChange={(e) => setOauthClientSecret(e.target.value)} placeholder="OAuth Client Secret" />
            </div>
          )}
          <Button
            onClick={() => {
              onConnect(
                platform.key,
                accountId,
                token,
                supportsOAuth ? { refreshToken, oauthClientId, oauthClientSecret } : undefined
              );
              setOpen(false);
              setToken("");
              setRefreshToken("");
              setOauthClientSecret("");
            }}
          >
            Salvar
          </Button>
        </div>
      )}
    </div>
  );
}
