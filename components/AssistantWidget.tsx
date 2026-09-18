"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api";
import { Icon } from "@/components/icons";

type ChatMessage = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Cria uma demanda de ensaio de produto pro kaisan com prazo sexta",
  "Agenda reunião de alinhamento amanhã às 10h",
  "Agenda um post no Instagram do kaisan para sábado 9h",
];

// Assistente flutuante global: fala em linguagem natural e executa ações
// reais na plataforma (demandas, reuniões, posts). A conversa persiste
// entre páginas (sessionStorage) enquanto o navegador estiver aberto.
// Rotas em que o painel NUNCA aparece: são a peça que a agência mostra ao
// cliente dela (relatório, proposta, fatura, página pública, aprovação) ou a
// versão de impressão. Um botão flutuante da ferramenta em cima do documento
// do cliente é o erro que motivou esta regra (§13, bloco 4).
const DOC_ROUTES = [/^\/print\//, /\/report$/, /^\/proposta\//, /^\/fatura\//, /^\/aprovar\//, /^\/a\//];

export default function AssistantWidget() {
  const pathname = usePathname() ?? "/";
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

  if (DOC_ROUTES.some((re) => re.test(pathname))) return null;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Abrir assistente"
        className="no-print t5 fixed bottom-5 right-5 z-50 inline-flex h-10 items-center gap-2 rounded-sm border border-edge bg-surface px-3 font-medium shadow-e1 transition-colors duration-[var(--dur-1)] hover:bg-surface-sunken"
        title="Assistente — fale o que precisa e ele executa"
      >
        <Icon name="message" size={16} />
        Assistente
      </button>
    );
  }

  return (
    <div className={`no-print fixed bottom-5 right-5 z-50 flex h-[34rem] w-[24rem] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-md border border-edge bg-surface shadow-e2 ${
        closing ? "animate-pop-out" : "animate-pop-in"
      }`}>
      {/* Cabeçalho */}
      <div className="flex items-center justify-between border-b border-rule bg-surface-sunken px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-full bg-text text-canvas">
            <Icon name="message" size={16} />
          </span>
          <div>
            <p className="t3 font-semibold">Assistente</p>
            <p className="text-[11px] text-text-muted">
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
              className="rounded-md px-2 py-1 t5 text-text-muted transition-colors hover:text-negative"
              title="Limpar conversa"
            >
              ⌫
            </button>
          )}
          <button
            onClick={close}
            className="rounded-md px-2 py-1 t3 text-text-muted transition-colors hover:text-text"
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
            <p className="text-center t3 text-text-muted">
              Eu <span className="font-medium text-text">executo</span> por você: crio
              demandas, agendo reuniões e posts.
            </p>
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => send(suggestion)}
                className="block w-full rounded-lg border border-edge bg-surface-sunken px-3 py-2 text-left t5 text-text-muted transition-colors hover:border-edge hover:text-text"
              >
                “{suggestion}”
              </button>
            ))}
          </div>
        )}
        {messages.map((message, index) => (
          <div
            key={index}
            className={`t3 max-w-[85%] whitespace-pre-wrap rounded-sm px-3 py-2 ${
              message.role === "user"
                ? "ml-auto bg-text text-canvas"
                : "rounded-bl-sm bg-surface-sunken"
            }`}
          >
            {message.content}
          </div>
        ))}
        {busy && (
          <div className="flex w-fit items-center gap-1.5 rounded-sm bg-surface-sunken px-3 py-2.5">
            <span className="size-1.5 animate-bounce rounded-full bg-text-muted [animation-delay:0ms]" />
            <span className="size-1.5 animate-bounce rounded-full bg-text-muted [animation-delay:150ms]" />
            <span className="size-1.5 animate-bounce rounded-full bg-text-muted [animation-delay:300ms]" />
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
            className="max-h-24 min-h-9 flex-1 resize-none rounded-md border border-edge bg-surface-sunken px-3 py-2 t3 outline-none transition-colors focus:border-edge"
          />
          <button
            onClick={() => send()}
            disabled={busy || !input.trim()}
            className="grid size-9 shrink-0 place-items-center rounded-sm bg-brand-solid text-brand-ink transition-[filter] duration-[var(--dur-1)] hover:brightness-95 disabled:bg-surface-sunken disabled:text-text-faint"
            title="Enviar"
          ></button>
        </div>
      </div>
    </div>
  );
}
