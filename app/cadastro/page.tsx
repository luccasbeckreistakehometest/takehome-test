"use client";

import { useState } from "react";
import ClientForm from "@/components/ClientForm";
import { Card } from "@/components/ui";

// Auto-cadastro: link compartilhável para o cliente preencher o próprio
// briefing e entrar na carteira da agência.
export default function SelfRegisterPage() {
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">
          Cadastro recebido! 🎉
        </h1>
        <p className="mt-4 text-muted">
          Obrigado! A agência já recebeu seu briefing e vai preparar a
          estratégia da sua marca. Você receberá o contato em breve.
        </p>
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
      <SelfClientForm onDone={() => setDone(true)} />
    </div>
  );
}

function SelfClientForm({ onDone }: { onDone: () => void }) {
  return <ClientForm onSaved={onDone} selfService />;
}
