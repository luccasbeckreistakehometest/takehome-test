"use client";

import { useState } from "react";
import ClientForm from "@/components/ClientForm";
import { Card } from "@/components/ui";

// Auto-cadastro: link compartilhável para o cliente preencher o próprio
// briefing e entrar na carteira da agência.
export default function SelfRegisterPage() {
  const [done, setDone] = useState(false);
  const [credentials, setCredentials] = useState<{ username: string; password: string } | null>(null);

  if (done) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">
          Cadastro recebido! 🎉
        </h1>
        <p className="mt-4 text-muted">
          Obrigado! A agência já recebeu seu briefing e vai preparar a
          estratégia da sua marca.
        </p>
        {credentials && (
          <div className="mx-auto mt-6 max-w-sm rounded-xl border border-accent/40 bg-accent/5 p-4 text-left text-sm">
            <p className="font-semibold">Seu acesso ao portal:</p>
            <p className="mt-1">
              Usuário: <span className="font-mono text-accent">{credentials.username}</span>
            </p>
            <p>
              Senha: <span className="font-mono text-accent">{credentials.password}</span>
            </p>
            <a href="/login" className="mt-2 inline-block text-accent hover:underline">
              Entrar agora →
            </a>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">
          Cadastre sua empresa
        </h1>
        <p className="mt-1 text-sm text-muted">
          Conte sobre o seu negócio: com essas informações a agência monta
          estratégia, campanhas e materiais sob medida para a sua marca.
        </p>
      </div>
      <Card className="border-accent/30 bg-accent/5 p-3 text-sm text-muted">
        Quanto mais completo o briefing, mais certeiro o trabalho — mas só o
        nome já basta para começar; o resto pode ser preenchido depois.
      </Card>
      <SelfClientForm
        onDone={(client) => {
          setCredentials(
            (client as { login?: { username: string; password: string } }).login ?? null
          );
          setDone(true);
        }}
      />
    </div>
  );
}

function SelfClientForm({
  onDone,
}: {
  onDone: (client: unknown) => void;
}) {
  return <ClientForm onSaved={(client) => onDone(client)} selfService showSelfServeChoice />;
}
