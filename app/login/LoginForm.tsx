"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Button, Card, ErrorBox, Input, Label } from "@/components/ui";

type UserRow = { username: string; role: string; name: string };

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  agency: "Agência",
  client: "Cliente",
  professional: "Profissional",
};

export default function LoginForm({ showDevAccounts }: { showDevAccounts: boolean }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!showDevAccounts) return;
    api<UserRow[]>("/api/auth/users").then(setUsers).catch(() => {});
  }, [showDevAccounts]);

  async function login(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await api<{ home: string }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      window.location.href = result.home;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro no login");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6 py-12">
      <div className="text-center">
        <h1 className="d3">Entrar</h1>
        <p className="mt-2 t3 text-text-muted">Agência, marca ou profissional: cada um no seu painel.</p>
      </div>
      <Card>
        <form className="space-y-4" onSubmit={login} aria-label="Entrar na conta">
          <div>
            <Label htmlFor="login-identifier">Usuário ou e-mail</Label>
            <Input
              id="login-identifier"
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div>
            <Label htmlFor="login-password">Senha</Label>
            <Input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <ErrorBox message={error} />}
          <Button type="submit" className="w-full" disabled={loading || !username.trim() || !password}>
            {loading ? "Entrando..." : "Entrar"}
          </Button>
          <p className="text-center t5 text-text-muted">
            Esqueceu a senha?{" "}
            <Link href="/contato?assunto=acesso" className="text-text hover:underline">
              Fale com o suporte
            </Link>{" "}
            — se a sua conta foi criada por uma agência, ela também pode gerar uma senha nova para você.
          </p>
          <div className="border-t border-edge pt-3 text-center t3 text-text-muted">
            Ainda não tem conta?{" "}
            <Link href="/criar-conta" className="font-medium text-text hover:underline">
              Criar conta grátis →
            </Link>
          </div>
        </form>
      </Card>

      {users.length > 0 && (
        <Card>
          <p className="mb-2 t5 font-semibold uppercase tracking-wider text-text-muted">Contas disponíveis (ambiente local)</p>
          <div className="space-y-1">
            {users.map((user) => (
              <button
                key={user.username}
                type="button"
                onClick={() => setUsername(user.username)}
                className="flex w-full items-center justify-between rounded-md border border-edge bg-surface-sunken px-3 py-1.5 t3 transition-colors hover:border-edge"
              >
                <span>
                  <span className="font-mono text-text">{user.username}</span> <span className="text-text-muted">— {user.name}</span>
                </span>
                <span className="t5 text-text-muted">{ROLE_LABEL[user.role] ?? user.role}</span>
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
