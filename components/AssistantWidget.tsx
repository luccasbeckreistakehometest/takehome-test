"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

type ChatMessage = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Cria uma demanda de ensaio de produto pro kaisan com prazo sexta",
  "Agenda reunião de alinhamento amanhã às 10h",
  "Agenda um post no Instagram do kaisan para sábado 9h",
];

// Assistente flutuante global: fala em linguagem natural e executa ações
// reais na plataforma (demandas, reuniões, posts). A conversa persiste
// entre páginas (sessionStorage) enquanto o navegador estiver aberto.
export default function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);

  function close() {
    setClosing(true);
    setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, 170);
  }
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("assistant_chat");
      if (saved) setMessages(JSON.parse(saved));
    } catch {
      // sem estado salvo
    }
  }, []);

  useEffect(() => {
    sessionStorage.setItem("assistant_chat", JSON.stringify(messages.slice(-30)));
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy, open]);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    const next: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const result = await api<{ reply: string }>("/api/assistant", {
        method: "POST",
        body: JSON.stringify({ messages: next }),
      });
      setMessages([...next, { role: "assistant", content: result.reply }]);
      // Ações do assistente podem ter criado coisas — páginas se atualizam
      window.dispatchEvent(new CustomEvent("jobs:changed"));
    } catch (err) {
      setMessages([
        ...next,
        {
          role: "assistant",
          content: err instanceof Error ? err.message : "Erro ao executar — tente de novo.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="animate-pop-in fixed bottom-5 right-5 z-50 grid size-14 place-items-center rounded-full bg-accent text-2xl text-accent-ink shadow-2xl transition-transform hover:scale-105"
        title="Assistente — fale o que precisa e ele executa"
      >
        ✦
      </button>
    );
  }

  return (
    <div className={`fixed bottom-5 right-5 z-50 flex h-[34rem] w-[24rem] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-edge bg-surface shadow-2xl ${
        closing ? "animate-pop-out" : "animate-pop-in"
      }`}>
      {/* Cabeçalho */}
      <div className="flex items-center justify-between border-b border-edge bg-surface-2 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-full bg-accent text-sm text-accent-ink">
            ✦
          </span>
          <div>
            <p className="text-sm font-semibold">Assistente</p>
            <p className="text-[11px] text-muted">
              {busy ? "executando..." : "fala que eu faço"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={() => {
                setMessages([]);
                sessionStorage.removeItem("assistant_chat");
              }}
              className="rounded-md px-2 py-1 text-xs text-muted transition-colors hover:text-red-400"
              title="Limpar conversa"
            >
              ⌫
            </button>
          )}
          <button
            onClick={close}
            className="rounded-md px-2 py-1 text-sm text-muted transition-colors hover:text-foreground"
            title="Minimizar"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Mensagens */}
      <div ref={scrollRef} className="flex-1 space-y-2.5 overflow-y-auto p-3">
        {messages.length === 0 && (
          <div className="space-y-2 pt-4">
            <p className="text-center text-sm text-muted">
              Eu <span className="text-accent">executo</span> por você: crio
              demandas, agendo reuniões e posts.
            </p>
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => send(suggestion)}
                className="block w-full rounded-lg border border-edge bg-surface-2 px-3 py-2 text-left text-xs text-muted transition-colors hover:border-accent hover:text-foreground"
              >
                “{suggestion}”
              </button>
            ))}
          </div>
        )}
        {messages.map((message, index) => (
          <div
            key={index}
            className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
              message.role === "user"
                ? "ml-auto rounded-br-sm bg-accent text-accent-ink"
                : "rounded-bl-sm bg-surface-2"
            }`}
          >
            {message.content}
          </div>
        ))}
        {busy && (
          <div className="flex w-fit items-center gap-1.5 rounded-2xl rounded-bl-sm bg-surface-2 px-3 py-2.5">
            <span className="size-1.5 animate-bounce rounded-full bg-muted [animation-delay:0ms]" />
            <span className="size-1.5 animate-bounce rounded-full bg-muted [animation-delay:150ms]" />
            <span className="size-1.5 animate-bounce rounded-full bg-muted [animation-delay:300ms]" />
          </div>
        )}
      </div>

      {/* Entrada */}
      <div className="border-t border-edge p-2.5">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder="Diga o que precisa..."
            className="max-h-24 min-h-9 flex-1 resize-none rounded-xl border border-edge bg-surface-2 px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
          <button
            onClick={() => send()}
            disabled={busy || !input.trim()}
            className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-40"
            title="Enviar"
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}
