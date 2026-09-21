"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { Button, Card, ErrorBox, Input, Label, SectionTitle, Skeleton } from "@/components/ui";

type Account = {
  username: string;
  email: string | null;
  name: string;
  role: string;
  mustChangePassword: boolean;
  consentAt: string | null;
  consentVersion: string | null;
  createdAt: string;
};

const ROLE_LABEL: Record<string, string> = { admin: "Admin", agency: "Agência", client: "Marca", professional: "Profissional" };

function Notice({ text }: { text: string }) {
  return (
    <p role="status" className="rounded-md border border-edge bg-surface-sunken px-3 py-2 t3 text-text">
      {text}
    </p>
  );
}

export default function AccountSettings() {
  const params = useSearchParams();
  const forced = params.get("trocar") === "1";
  const [account, setAccount] = useState<Account | null>(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    api<Account>("/api/account")
      .then(setAccount)
      .catch((e) => setLoadError(e instanceof Error ? e.message : "Erro ao carregar"));
  }, []);

  if (loadError) return <ErrorBox message={loadError} />;
  if (!account) return <Skeleton className="h-64" />;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="d3">Minha conta</h1>
        <p className="t3 measure-lede mt-2 text-text-muted">
          {ROLE_LABEL[account.role] ?? account.role} · usuário <span className="font-mono text-text">{account.username}</span>
        </p>
      </div>
      {(forced || account.mustChangePassword) && (
        <p role="alert" className="rounded-md border border-caution/50 bg-caution-wash px-3 py-2 t3">
          Você entrou com uma senha provisória. Crie a sua senha agora.
        </p>
      )}
      <PasswordCard />
      <EmailCard account={account} onSaved={(email) => setAccount({ ...account, email })} />
      <SessionsCard />
      <DataCard account={account} />
    </div>
  );
}

function PasswordCard() {
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setMsg("");
    setError("");
    if (form.next !== form.confirm) {
      setError("A confirmação não confere com a nova senha.");
      return;
    }
    setBusy(true);
    try {
      await api("/api/account/password", { method: "POST", body: JSON.stringify({ current: form.current, next: form.next }) });
      setForm({ current: "", next: "", confirm: "" });
      setMsg("Senha trocada. Outros aparelhos conectados foram desconectados.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao trocar a senha");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <SectionTitle>Senha</SectionTitle>
      <form className="space-y-3" onSubmit={save} aria-label="Trocar senha">
        <input type="text" name="username" autoComplete="username" hidden readOnly />
        <div>
          <Label htmlFor="pw-current">Senha atual</Label>
          <Input id="pw-current" type="password" autoComplete="current-password" required value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="pw-next">Nova senha</Label>
            <Input id="pw-next" type="password" autoComplete="new-password" minLength={8} required value={form.next} onChange={(e) => setForm({ ...form, next: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="pw-confirm">Repita a nova senha</Label>
            <Input id="pw-confirm" type="password" autoComplete="new-password" minLength={8} required value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
          </div>
        </div>
        {error && <ErrorBox message={error} />}
        {msg && <Notice text={msg} />}
        <Button type="submit" disabled={busy} data-testid="pw-save">
          {busy ? "Salvando..." : "Trocar senha"}
        </Button>
      </form>
    </Card>
  );
}

function EmailCard({ account, onSaved }: { account: Account; onSaved: (email: string | null) => void }) {
  const [email, setEmail] = useState(account.email ?? "");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setMsg("");
    setError("");
    try {
      const result = await api<{ email: string | null }>("/api/account", { method: "PATCH", body: JSON.stringify({ email }) });
      onSaved(result.email);
      setMsg("E-mail salvo. Você pode entrar com ele.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar");
    }
  }

  return (
    <Card>
      <SectionTitle>E-mail de acesso</SectionTitle>
      <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={save} aria-label="E-mail de acesso">
        <div className="flex-1">
          <Label htmlFor="acc-email">E-mail</Label>
          <Input id="acc-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <Button type="submit" variant="ghost">
          Salvar e-mail
        </Button>
      </form>
      {error && <div className="mt-3"><ErrorBox message={error} /></div>}
      {msg && <div className="mt-3"><Notice text={msg} /></div>}
    </Card>
  );
}

function SessionsCard() {
  async function logoutAll() {
    if (!window.confirm("Sair de todos os aparelhos, inclusive deste?")) return;
    await fetch("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) });
    window.location.replace(new URL("/login", window.location.origin).href);
  }
  return (
    <Card>
      <SectionTitle>Aparelhos conectados</SectionTitle>
      <p className="mb-3 t3 text-text-muted">Perdeu o celular ou entrou num computador de outra pessoa? Encerre todas as sessões de uma vez.</p>
      <Button variant="ghost" onClick={logoutAll} data-testid="logout-all">
        Sair de todos os dispositivos
      </Button>
    </Card>
  );
}

function DataCard({ account }: { account: Account }) {
  const [confirm, setConfirm] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function remove(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api("/api/account", { method: "DELETE", body: JSON.stringify({ confirm, password }) });
      window.location.replace(new URL("/", window.location.origin).href);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao excluir");
      setBusy(false);
    }
  }

  return (
    <Card>
      <SectionTitle>Seus dados (LGPD)</SectionTitle>
      <p className="t3 text-text-muted">
        {account.consentAt
          ? `Termos aceitos em ${new Date(account.consentAt).toLocaleDateString("pt-BR")} (versão ${account.consentVersion}).`
          : "Conta criada antes do aceite registrado dos termos."}{" "}
        <Link href="/privacidade" className="text-text hover:underline">
          Política de Privacidade
        </Link>
      </p>
      <a
        href="/api/account/export"
        className="mt-3 inline-flex items-center rounded-md border border-edge bg-surface-sunken px-3.5 py-2 t3 hover:border-edge"
        data-testid="export-data"
      >
        Baixar meus dados (JSON)
      </a>

      <form className="mt-6 space-y-3 border-t border-edge pt-4" onSubmit={remove} aria-label="Excluir minha conta">
        <p className="t3 font-medium text-negative">Excluir minha conta</p>
        <p className="t3 text-text-muted">
          {account.role === "client"
            ? "Se você criou a marca sozinho, tudo dela é apagado. Se a conta foi criada por uma agência, só o seu acesso sai; os arquivos do trabalho continuam com a agência."
            : account.role === "professional"
              ? "Seu perfil, portfólio e candidaturas são apagados."
              : "Seu acesso é apagado; os dados da agência continuam."}{" "}
          Pagamentos ficam registrados sem o seu nome, como exige a lei.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="del-confirm">Digite EXCLUIR</Label>
            <Input id="del-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
          </div>
          <div>
            <Label htmlFor="del-password">Sua senha</Label>
            <Input id="del-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
        </div>
        {error && <ErrorBox message={error} />}
        <Button type="submit" variant="danger" disabled={busy || confirm.trim().toUpperCase() !== "EXCLUIR" || !password} data-testid="delete-account">
          {busy ? "Excluindo..." : "Excluir conta definitivamente"}
        </Button>
      </form>
    </Card>
  );
}
