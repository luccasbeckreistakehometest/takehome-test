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

export default function LoginPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api<UserRow[]>("/api/auth/users").then(setUsers).catch(() => {});
  }, []);

  async function login(user?: string) {
    setLoading(true);
    setError("");
    try {
      const result = await api<{ home: string }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: user ?? username, password }),
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
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">
          Entrar
        </h1>
        <p className="mt-2 text-sm text-muted">
          Cada papel tem seu painel: agência, cliente ou profissional.
        </p>
      </div>
      <Card className="space-y-4">
        <div>
          <Label>Usuário</Label>
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="ex.: agencia"
            autoFocus
          />
        </div>
        <div>
          <Label>Senha</Label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()}
            placeholder="••••••••"
          />
        </div>
        {error && <ErrorBox message={error} />}
        <Button className="w-full" onClick={() => login()} disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </Button>
        <div className="border-t border-edge pt-3 text-center text-sm text-muted">
          Ainda não tem conta?{" "}
          <Link href="/criar-conta" className="font-medium text-accent hover:underline">
            Criar conta grátis →
          </Link>
        </div>
      </Card>

      {users.length > 0 && (
        <Card>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
            Contas disponíveis (instância local)
          </p>
          <div className="space-y-1">
            {users.map((user) => (
              <button
                key={user.username}
                onClick={() => setUsername(user.username)}
                className="flex w-full items-center justify-between rounded-md border border-edge bg-surface-2 px-3 py-1.5 text-sm transition-colors hover:border-accent"
              >
                <span>
                  <span className="font-mono text-accent">{user.username}</span>{" "}
                  <span className="text-muted">— {user.name}</span>
                </span>
                <span className="text-xs text-muted">{ROLE_LABEL[user.role] ?? user.role}</span>
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
