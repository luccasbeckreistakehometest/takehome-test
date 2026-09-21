"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, ErrorBox, SectionTitle, Select, Tag } from "@/components/ui";

type Message = {
  id: string;
  kind: "contact" | "access_request";
  name: string;
  email: string;
  topic: string;
  message: string;
  meta: Record<string, string>;
  status: "new" | "in_progress" | "done";
  createdAt: string;
};
type Counts = Record<"new" | "in_progress" | "done", number>;

const STATUS_LABEL: Record<Message["status"], string> = { new: "Nova", in_progress: "Em andamento", done: "Resolvida" };
const TOPIC_LABEL: Record<string, string> = {
  duvida: "dúvida",
  pagamento: "pagamento",
  acesso: "acesso",
  privacidade: "LGPD",
  parceria: "parceria",
  outro: "outro",
};

export default function AdminInbox() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [counts, setCounts] = useState<Counts>({ new: 0, in_progress: 0, done: 0 });
  const [filter, setFilter] = useState("");
  const [error, setError] = useState("");

  const load = useCallback((status: string) => {
    api<{ messages: Message[]; counts: Counts }>(`/api/admin/inbox${status ? `?status=${status}` : ""}`)
      .then((r) => {
        setMessages(r.messages);
        setCounts(r.counts);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Erro"));
  }, []);

  useEffect(() => {
    load(filter);
  }, [load, filter]);

  async function setStatus(id: string, status: string) {
    try {
      await api("/api/admin/inbox", { method: "PATCH", body: JSON.stringify({ id, status }) });
      load(filter);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    }
  }

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <SectionTitle>
          Caixa de entrada · {counts.new} nova(s), {counts.in_progress} em andamento
        </SectionTitle>
        <Select aria-label="Filtrar por status" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">Todas</option>
          <option value="new">Novas</option>
          <option value="in_progress">Em andamento</option>
          <option value="done">Resolvidas</option>
        </Select>
      </div>
      {error && <ErrorBox message={error} />}
      <ul className="space-y-3" data-testid="admin-inbox">
        {messages.map((m) => (
          <li key={m.id} className="rounded-lg border border-edge bg-surface-sunken p-3 t3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p>
                <span className="font-medium">{m.name}</span>{" "}
                <a href={`mailto:${m.email}`} className="text-text hover:underline">
                  {m.email}
                </a>
              </p>
              <div className="flex items-center gap-2">
                <Tag>{m.kind === "access_request" ? "pedido de acesso" : (TOPIC_LABEL[m.topic] ?? m.topic)}</Tag>
                <Select
                  aria-label={`Status da mensagem de ${m.name}`}
                  value={m.status}
                  onChange={(e) => setStatus(m.id, e.target.value)}
                >
                  {Object.entries(STATUS_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            {(m.meta.company || m.meta.website) && (
              <p className="mt-1 t5 text-text-muted">
                {[m.meta.company, m.meta.website].filter(Boolean).join(" · ")}
              </p>
            )}
            <p className="mt-2 whitespace-pre-wrap break-words">{m.message}</p>
            <p className="mt-2 t5 text-text-muted">{new Date(m.createdAt).toLocaleString("pt-BR")}</p>
          </li>
        ))}
        {messages.length === 0 && <li className="t3 text-text-muted">Nenhuma mensagem.</li>}
      </ul>
    </Card>
  );
}
