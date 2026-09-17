"use client";

import { Button, Card, CopyButton } from "./ui";

export type OneTimeLoginData = { username: string; password: string };

// Acesso criado pela agência: a senha provisória aparece UMA vez. Quem
// recebe troca no primeiro login.
export default function OneTimeLogin({
  who,
  login,
  onContinue,
  continueLabel = "Continuar",
}: {
  who: string;
  login: OneTimeLoginData;
  onContinue: () => void;
  continueLabel?: string;
}) {
  const text = `Acesso à plataforma\nEndereço: ${typeof window === "undefined" ? "" : window.location.origin}/login\nUsuário: ${login.username}\nSenha provisória: ${login.password}\n(Troque a senha no primeiro acesso.)`;
  return (
    <Card className="space-y-4 border-accent" data-testid="one-time-login">
      <div>
        <p className="font-semibold">Acesso criado para {who}</p>
        <p className="mt-1 text-sm text-muted">
          Envie estes dados para a pessoa. A senha provisória só aparece agora — se perder, gere outra pelo suporte do admin.
        </p>
      </div>
      <dl className="grid gap-2 rounded-lg border border-edge bg-surface-2 p-3 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-4">
        <dt className="text-muted">Usuário</dt>
        <dd className="font-mono text-accent" data-testid="otp-username">{login.username}</dd>
        <dt className="text-muted">Senha provisória</dt>
        <dd className="font-mono" data-testid="otp-password">{login.password}</dd>
      </dl>
      <div className="flex flex-wrap items-center gap-3">
        <CopyButton text={text} label="Copiar acesso" />
        <Button onClick={onContinue}>{continueLabel}</Button>
      </div>
    </Card>
  );
}
