"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { Button, Card, Input, Spinner } from "@/components/ui";

type ChatMessage = { role: "user" | "assistant"; content: string };

// Assistente que executa: linguagem natural → ações reais na plataforma
export default function AssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const result = await api<{ reply: string }>("/api/assistant", {
        method: "POST",
        body: JSON.stringify({ messages: next }),
      });
      setMessages([...next, { role: "assistant", content: result.reply }]);
    } catch (err) {
      setMessages([
        ...next,
        { role: "assistant", content: err instanceof Error ? err.message : "Erro." },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">
          Assistente
        </h1>
        <p className="mt-1 text-sm text-muted">
          Fale o que precisa e ele executa: cria demandas, agenda reuniões e
          posts. Ex.: &quot;cria uma demanda de ensaio de inverno pro kaisan com
          prazo sexta e agenda reunião de briefing amanhã às 10h&quot;.
        </p>
      </div>
      <Card className="flex min-h-[50vh] flex-col gap-3">
        <div className="flex-1 space-y-3 overflow-y-auto">
          {messages.length === 0 && (
            <p className="py-12 text-center text-sm text-muted">
              O que vamos fazer hoje?
            </p>
          )}
          {messages.map((message, index) => (
            <div
              key={index}
              className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                message.role === "user" ? "ml-auto bg-accent/15" : "bg-surface-2"
              }`}
            >
              {message.content}
            </div>
          ))}
          {busy && <Spinner label="Executando..." />}
        </div>
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Diga o que precisa..."
          />
          <Button onClick={send} disabled={busy}>
            Enviar
          </Button>
        </div>
      </Card>
    </div>
  );
}
