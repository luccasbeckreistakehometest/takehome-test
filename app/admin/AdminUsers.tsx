"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button, Card, ErrorBox, Input, Select, SectionTitle, Tag } from "@/components/ui";

type Billing = {
  accountType: string;
  accountId: string;
  planId: string;
  planName: string;
  renewsAt: string;
  coins: number;
  usageThisMonth: number;
} | null;

type AdminUser = {
  id: string;
  username: string;
  email: string | null;
  role: string;
  name: string;
  disabledAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  mustChangePassword: boolean;
  agencyId: string | null;
  agencyName: string;
  billing: Billing;
};

const PLAN_OPTIONS: Record<string, { id: string; label: string }[]> = {
  agency: [
    { id: "agency_free", label: "Grátis" },
    { id: "agency_starter", label: "Starter" },
    { id: "agency_growth", label: "Growth" },
    { id: "agency_scale", label: "Scale" },
  ],
  client: [
    { id: "client_free", label: "Grátis" },
    { id: "client_starter", label: "Starter" },
    { id: "client_pro", label: "Pro" },
  ],
  professional: [
    { id: "pro_free", label: "Grátis" },
    { id: "pro_plus", label: "Pro" },
  ],
};

const ROLE_LABEL: Record<string, string> = { admin: "admin", agency: "agência", client: "marca", professional: "profissional" };
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");

export default function AdminUsers({ agency = "" }: { agency?: string }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api<{ users: AdminUser[] }>(`/api/admin/users${agency ? `?agency=${encodeURIComponent(agency)}` : ""}`)
      .then((r) => {
        setUsers(r.users);
        setSelected((prev) => (prev ? (r.users.find((u) => u.id === prev.id) ?? null) : null));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Erro"));
  }, [agency]);

  useEffect(() => {
    load();
  }, [load]);

  const q = query.trim().toLowerCase();
  const visible = q
    ? users.filter((u) => [u.username, u.email ?? "", u.name, u.role].some((v) => v.toLowerCase().includes(q)))
    : users;

  return (
    <div className="space-y-4">
      {error && <ErrorBox message={error} />}
      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <SectionTitle>Usuários ({users.length})</SectionTitle>
          <Input
            aria-label="Buscar usuário"
            placeholder="Buscar por usuário, e-mail ou nome"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm" data-testid="admin-users">
            <thead className="text-xs uppercase text-muted">
              <tr>
                <th className="py-2 pr-3">Conta</th>
                <th className="py-2 pr-3">Papel</th>
                <th className="py-2 pr-3">Plano</th>
                <th className="py-2 pr-3">Coins</th>
                <th className="py-2 pr-3">Último acesso</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-edge">
              {visible.map((u) => (
                <tr key={u.id} className={u.disabledAt ? "opacity-60" : ""}>
                  <td className="py-2 pr-3">
                    <p className="font-mono text-accent">{u.username}</p>
                    <p className="text-xs text-muted">
                      {u.name}
                      {u.email ? ` · ${u.email}` : ""}
                      {u.agencyName ? ` · ${u.agencyName}` : ""}
                    </p>
                  </td>
                  <td className="py-2 pr-3">
                    <Tag>{ROLE_LABEL[u.role] ?? u.role}</Tag>
                    {u.disabledAt && <span className="ml-1 text-xs text-red-500">desativada</span>}
                  </td>
                  <td className="py-2 pr-3">{u.billing ? `${u.billing.planName} · até ${fmt(u.billing.renewsAt)}` : "—"}</td>
                  <td className="py-2 pr-3">{u.billing ? Math.floor(u.billing.coins) : "—"}</td>
                  <td className="py-2 pr-3">{fmt(u.lastLoginAt)}</td>
                  <td className="py-2 text-right">
                    <Button variant="ghost" onClick={() => setSelected(u)} data-testid={`admin-user-${u.username}`}>
                      Gerenciar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {selected && <UserPanel user={selected} onChanged={load} onClose={() => setSelected(null)} />}
    </div>
  );
}

function UserPanel({ user, onChanged, onClose }: { user: AdminUser; onChanged: () => void; onClose: () => void }) {
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [otp, setOtp] = useState<string | null>(null);
  const [planId, setPlanId] = useState(user.billing?.planId ?? "");
  const [months, setMonths] = useState("1");
  const [coins, setCoins] = useState("");
  const [note, setNote] = useState("");
  const [email, setEmail] = useState(user.email ?? "");
  const plans = PLAN_OPTIONS[user.billing?.accountType ?? ""] ?? [];

  async function act(body: Record<string, unknown>, success: string) {
    setMsg("");
    setError("");
    try {
      const result = await api<{ password?: string }>(`/api/admin/users/${user.id}`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (result.password) setOtp(result.password);
      setMsg(success);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    }
  }

  return (
    <Card className="space-y-4 border-accent" data-testid="admin-user-panel">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold">
            {user.name} <span className="font-mono text-sm text-accent">({user.username})</span>
          </p>
          <p className="text-xs text-muted">
            criada em {fmt(user.createdAt)} · {user.mustChangePassword ? "senha provisória pendente" : "senha própria"}
            {user.billing ? ` · uso no mês: ${Math.round(user.billing.usageThisMonth)} coins` : ""}
          </p>
        </div>
        <Button variant="ghost" onClick={onClose}>
          Fechar
        </Button>
      </div>
      {error && <ErrorBox message={error} />}
      {msg && (
        <p role="status" className="text-sm text-accent">
          {msg}
        </p>
      )}
      {otp && (
        <p className="rounded-md border border-accent/40 bg-accent/5 px-3 py-2 text-sm" data-testid="admin-otp">
          Senha provisória (mostrada só agora): <strong className="font-mono">{otp}</strong>
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {user.disabledAt ? (
          <Button variant="ghost" onClick={() => act({ action: "enable" }, "Conta reativada.")}>
            Reativar
          </Button>
        ) : (
          <Button variant="danger" onClick={() => window.confirm("Desativar e desconectar esta conta?") && act({ action: "disable" }, "Conta desativada e desconectada.")}>
            Desativar
          </Button>
        )}
        <Button
          variant="ghost"
          onClick={() => window.confirm("Gerar uma senha provisória nova? A atual deixa de valer.") && act({ action: "reset_password" }, "Senha redefinida.")}
          data-testid="admin-reset-password"
        >
          Redefinir senha
        </Button>
      </div>

      <form
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          act({ action: "set_email", email }, "E-mail salvo.");
        }}
      >
        <label className="flex-1 text-xs text-muted" htmlFor="admin-email">
          E-mail
          <Input id="admin-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <Button type="submit" variant="ghost">
          Salvar e-mail
        </Button>
      </form>

      {user.billing && (
        <>
          <form
            className="flex flex-col gap-2 sm:flex-row sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              act({ action: "set_plan", planId, months: Number(months) || 1 }, "Plano atualizado.");
            }}
          >
            <label className="flex-1 text-xs text-muted" htmlFor="admin-plan">
              Plano (sem cobrança)
              <Select id="admin-plan" value={planId} onChange={(e) => setPlanId(e.target.value)}>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </label>
            <label className="w-28 text-xs text-muted" htmlFor="admin-months">
              Meses
              <Input id="admin-months" type="number" min={1} max={36} value={months} onChange={(e) => setMonths(e.target.value)} />
            </label>
            <Button type="submit" variant="ghost" data-testid="admin-set-plan">
              Aplicar plano
            </Button>
          </form>
          <form
            className="flex flex-col gap-2 sm:flex-row sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              act({ action: "grant_coins", coins: Math.trunc(Number(coins)), note }, "Coins ajustados.");
              setCoins("");
            }}
          >
            <label className="w-32 text-xs text-muted" htmlFor="admin-coins">
              Coins (+/−)
              <Input id="admin-coins" type="number" value={coins} onChange={(e) => setCoins(e.target.value)} required />
            </label>
            <label className="flex-1 text-xs text-muted" htmlFor="admin-coins-note">
              Motivo
              <Input id="admin-coins-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="cortesia, ajuste..." />
            </label>
            <Button type="submit" variant="ghost" data-testid="admin-grant-coins">
              Lançar coins
            </Button>
          </form>
          <p className="text-xs text-muted">
            Contas de agência compartilham a mesma carteira (&quot;agency&quot;) até o isolamento por agência.
          </p>
        </>
      )}
    </Card>
  );
}
