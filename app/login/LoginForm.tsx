"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Button, ErrorBox, Input, Label } from "@/components/ui";

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
    // Entrada em split editorial (§4.1A, lead 5+6): a marca e a promessa à
    // esquerda, o formulário à direita — em vez de um cartão centrado no meio
    // de um vazio, que é o desenho de tela de login que todo gerador entrega.
    <div className="full-bleed">
      <div className="ed sec">
        <div className="ed-grid">
          <div className="c5">
            <p className="t6 text-text-muted">Marqa</p>
            <h1 className="d2 mt-4">Entrar</h1>
            <p className="t1 measure-lede mt-4 text-text-muted">
              Agência, marca ou profissional: cada um no seu painel.
            </p>
            <p className="t3 measure-prose mt-8 border-t border-rule pt-4 text-text-muted">
              Esqueceu a senha?{" "}
              <Link href="/contato?assunto=acesso" className="text-text underline underline-offset-4">
                Fale com o suporte
              </Link>{" "}
              — se a sua conta foi criada por uma agência, ela também pode gerar uma senha nova
              para você.
            </p>
            <p className="t3 mt-4 text-text-muted">
              Ainda não tem conta?{" "}
              <Link href="/criar-conta" className="font-medium text-text underline underline-offset-4">
                Criar conta grátis
              </Link>
            </p>
          </div>

          <div className="c6 c-start7">
            <form className="border-t border-edge pt-5" onSubmit={login} aria-label="Entrar na conta">
              <div className="space-y-4">
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
                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading || !username.trim() || !password}
                >
                  {loading ? "Entrando..." : "Entrar"}
                </Button>
              </div>
            </form>

            {users.length > 0 && (
              <section className="mt-10 border-t border-edge pt-3">
                <p className="t6 text-text-muted">Contas disponíveis (ambiente local)</p>
                <div className="mt-2">
                  {users.map((user) => (
                    <button
                      key={user.username}
                      type="button"
                      onClick={() => setUsername(user.username)}
                      className="flex w-full items-baseline justify-between gap-3 border-b border-rule py-2 text-left transition-colors duration-[var(--dur-1)] hover:bg-surface-sunken"
                    >
                      <span className="min-w-0 truncate">
                        <span className="font-mono t4 text-text">{user.username}</span>{" "}
                        <span className="t4 text-text-muted">— {user.name}</span>
                      </span>
                      <span className="t5 shrink-0 text-text-muted">
                        {ROLE_LABEL[user.role] ?? user.role}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
