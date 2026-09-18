"use client";

import { useEffect, useState } from "react";

// Mostra o usuário de acesso logo depois do cadastro (o username é gerado a
// partir do nome; sem isso a pessoa não sabe com o que entrar da próxima vez).
export default function WelcomeLogin() {
  const [login, setLogin] = useState<{ username: string; email: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/account", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((a) => {
        if (!cancelled && a?.username) setLogin({ username: a.username, email: a.email ?? null });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!login) return null;
  return (
    <div className="mb-4 rounded-lg border border-edge bg-surface-sunken px-3 py-2 text-sm" data-testid="welcome-username">
      <p>
        Seu usuário de acesso: <strong className="font-mono text-text">{login.username}</strong>
      </p>
      <p className="text-xs text-muted">
        {login.email ? `Você também pode entrar com o e-mail ${login.email}.` : "Guarde este usuário para entrar de novo."}
      </p>
    </div>
  );
}
