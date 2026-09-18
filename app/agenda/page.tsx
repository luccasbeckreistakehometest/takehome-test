"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Client } from "@/lib/types";
import type { MeetingWithNames, ScheduledPostWithClient } from "@/lib/marketplace-db";
import type { MeetingRecs } from "@/lib/marketplace-schemas";
import { googleCalendarUrl } from "@/lib/gcal";
import { Button, Card, ErrorBox, Input, SectionTitle, Select, Spinner, Tag } from "@/components/ui";

export default function AgendaPage() {
  const [meetings, setMeetings] = useState<MeetingWithNames[] | null>(null);
  const [posts, setPosts] = useState<ScheduledPostWithClient[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [recs, setRecs] = useState<MeetingRecs | null>(null);
  const [recommending, setRecommending] = useState(false);
  const [scheduled, setScheduled] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");
  const [form, setForm] = useState({ clientId: "", title: "", scheduledAt: "", link: "" });

  const load = useCallback(() => {
    api<MeetingWithNames[]>("/api/meetings").then(setMeetings);
    api<ScheduledPostWithClient[]>("/api/scheduled-posts").then(setPosts);
  }, []);

  useEffect(() => {
    load();
    api<Client[]>("/api/clients").then(setClients);
  }, [load]);

  async function recommend() {
    setRecommending(true);
    setError("");
    try {
      setRecs(await api<MeetingRecs>("/api/meetings/recommend", { method: "POST" }));
      setScheduled(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao recomendar");
    } finally {
      setRecommending(false);
    }
  }

  async function schedule(index: number) {
    const rec = recs?.meetings[index];
    if (!rec) return;
    await api("/api/meetings", {
      method: "POST",
      body: JSON.stringify({
        clientId: rec.clientId || null,
        projectId: rec.projectId || null,
        title: rec.title,
        scheduledAt: rec.suggestedAt,
        link: "",
        notes: `Participantes: ${rec.participants}`,
        reasoning: rec.reasoning,
      }),
    });
    setScheduled((prev) => new Set(prev).add(index));
    load();
  }

  const now = new Date();
  const upcoming = (meetings ?? []).filter((m) => new Date(m.scheduledAt) >= now);
  const past = (meetings ?? []).filter((m) => new Date(m.scheduledAt) < now).reverse();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="d3">
            Agenda
          </h1>
          <p className="t3 measure-lede mt-2 text-text-muted">
            Todas as reuniões da agência, com um clique para o Google Calendar — e
            recomendações da IA sobre quais reuniões valem ser feitas, com o porquê.
          </p>
        </div>
        <Button onClick={recommend} disabled={recommending}>
          {recommending ? "Analisando as contas..." : "Recomendar reuniões (IA)"}
        </Button>
      </div>
      {recommending && (
        <Spinner label="Cruzando o estado de todas as contas e demandas..." />
      )}
      {error && <ErrorBox message={error} />}

      {recs && (
        <Card className="space-y-3">
          <SectionTitle>Reuniões recomendadas</SectionTitle>
          <p className="t3 text-text-muted">{recs.summary}</p>
          {recs.meetings.map((rec, index) => (
            <div key={index} className="rounded-lg border border-edge bg-surface-sunken p-3 t3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">{rec.title}</p>
                <div className="flex items-center gap-2">
                  <Tag>{new Date(rec.suggestedAt).toLocaleString("pt-BR")}</Tag>
                  {scheduled.has(index) ? (
                    <span className="t5 text-text">✓ Agendada</span>
                  ) : (
                    <Button className="!px-2.5 !py-1 t5" onClick={() => schedule(index)}>
                      Agendar
                    </Button>
                  )}
                </div>
              </div>
              <p className="mt-1 t5 text-text-muted">
                <span className="font-semibold text-text/80">Participantes: </span>
                {rec.participants}
              </p>
              <p className="mt-1 t5 text-text-muted">
                <span className="font-semibold text-text">Por quê: </span>
                {rec.reasoning}
              </p>
            </div>
          ))}
        </Card>
      )}

      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <SectionTitle>Fila de publicações</SectionTitle>
          <a href="/calendar" className="t5 text-text hover:underline">
            Ver no calendário
          </a>
        </div>
        <p className="t3 text-text-muted">
          Posts agendados a partir do calendário/posts dos clientes. A publicação
          automática nas redes é ativada quando a integração (Meta/TikTok) estiver
          conectada — até lá, publique manualmente e confirme aqui.
        </p>
        {posts.filter((p) => p.status !== "canceled").length === 0 ? (
          <p className="t3 text-text-muted">
            Nada na fila — agende pelo botão 🕐 nos posts de cada cliente.
          </p>
        ) : (
          <div className="space-y-1.5">
            {posts
              .filter((p) => p.status !== "canceled")
              .map((post) => {
                const due =
                  post.status === "scheduled" && new Date(post.scheduledFor) <= new Date();
                return (
                  <div
                    key={post.id}
                    className={`rounded-md border px-3 py-2 t3 ${
                      due ? "border-caution/60 bg-caution-wash" : "border-edge bg-surface-sunken"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p>
                        <span className="font-medium">{post.title}</span>{" "}
                        <span className="t5 text-text-muted">
                          · {post.channel} · {post.clientName} ·{" "}
                          {new Date(post.scheduledFor).toLocaleString("pt-BR")}
                        </span>
                        {post.status === "published" && (
                          <span className="ml-2 t5 text-text">✓ Publicado</span>
                        )}
                        {post.status === "draft" && (
                          <span className="ml-2 t5 text-caution">rascunho — confirme a data no Calendário</span>
                        )}
                        {due && (
                          <span className="ml-2 t5 font-semibold text-caution">
                            ⏰ Na hora — publicar agora
                          </span>
                        )}
                      </p>
                      <span className="flex items-center gap-2 t5">
                        {post.status === "scheduled" && (
                          <button
                            className="rounded bg-brand-solid px-2 py-0.5 font-medium text-brand-ink"
                            onClick={async () => {
                              await api(`/api/scheduled-posts/${post.id}`, {
                                method: "PATCH",
                                body: JSON.stringify({ status: "published" }),
                              });
                              load();
                            }}
                          >
                            ✓ Marcar publicado
                          </button>
                        )}
                        <button
                          className="text-text-muted hover:text-negative"
                          onClick={async () => {
                            await api(`/api/scheduled-posts/${post.id}`, { method: "DELETE" });
                            load();
                          }}
                        >
                          Excluir
                        </button>
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 t5 text-text-muted">{post.caption}</p>
                  </div>
                );
              })}
          </div>
        )}
      </Card>

      <Card className="space-y-3">
        <SectionTitle>Agendar manualmente</SectionTitle>
        <div className="grid gap-2 sm:grid-cols-5">
          <Select
            value={form.clientId}
            onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
          >
            <option value="">Reunião geral...</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </Select>
          <Input
            placeholder="Título"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
          <Input
            type="datetime-local"
            value={form.scheduledAt}
            onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))}
          />
          <Input
            placeholder="Link Meet/Zoom (opcional)"
            value={form.link}
            onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))}
          />
          <Button
            variant="ghost"
            disabled={!form.title || !form.scheduledAt}
            onClick={async () => {
              await api("/api/meetings", {
                method: "POST",
                body: JSON.stringify({
                  clientId: form.clientId || null,
                  projectId: null,
                  title: form.title,
                  scheduledAt: form.scheduledAt,
                  link: form.link,
                  notes: "",
                  reasoning: "",
                }),
              });
              setForm({ clientId: "", title: "", scheduledAt: "", link: "" });
              load();
            }}
          >
            Agendar
          </Button>
        </div>
      </Card>

      {!meetings ? (
        <Spinner label="Carregando agenda..." />
      ) : (
        <>
          <Card>
            <SectionTitle>Próximas reuniões</SectionTitle>
            {upcoming.length === 0 ? (
              <p className="t3 text-text-muted">Nada agendado.</p>
            ) : (
              <div className="space-y-1.5">
                {upcoming.map((meeting) => (
                  <MeetingRow key={meeting.id} meeting={meeting} onChanged={load} />
                ))}
              </div>
            )}
          </Card>
          {past.length > 0 && (
            <Card>
              <SectionTitle>Realizadas</SectionTitle>
              <div className="space-y-1.5 opacity-60">
                {past.slice(0, 10).map((meeting) => (
                  <MeetingRow key={meeting.id} meeting={meeting} onChanged={load} />
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function MeetingRow({
  meeting,
  onChanged,
}: {
  meeting: MeetingWithNames;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    title: meeting.title,
    scheduledAt: meeting.scheduledAt.slice(0, 16),
    link: meeting.link,
  });

  if (editing) {
    return (
      <div className="rounded-md border border-edge bg-surface-sunken px-3 py-2">
        <div className="grid gap-2 sm:grid-cols-4">
          <Input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
          <Input
            type="datetime-local"
            value={form.scheduledAt}
            onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))}
          />
          <Input
            placeholder="Link Meet/Zoom"
            value={form.link}
            onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))}
          />
          <div className="flex gap-2">
            <Button
              className="!px-2.5 !py-1.5 t5"
              onClick={async () => {
                await api(`/api/meetings/${meeting.id}`, {
                  method: "PATCH",
                  body: JSON.stringify(form),
                });
                setEditing(false);
                onChanged();
              }}
            >
              Salvar
            </Button>
            <Button
              variant="ghost"
              className="!px-2.5 !py-1.5 t5"
              onClick={() => setEditing(false)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-edge bg-surface-sunken px-3 py-2 t3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p>
          <span className="font-medium">{meeting.title}</span>{" "}
          <span className="t5 text-text-muted">
            · {new Date(meeting.scheduledAt).toLocaleString("pt-BR")}
            {meeting.clientName && ` · ${meeting.clientName}`}
            {meeting.projectTitle && ` · ${meeting.projectTitle}`}
          </span>
        </p>
        <span className="flex items-center gap-2 t5">
          {meeting.link && (
            <a href={meeting.link} target="_blank" rel="noreferrer" className="text-text hover:underline">
              entrar
            </a>
          )}
          <a
            href={googleCalendarUrl(meeting)}
            target="_blank"
            rel="noreferrer"
            className="text-text-muted hover:text-text"
            title="Adicionar ao Google Calendar"
          >Calendar
          </a>
          <button className="text-text-muted hover:text-text" onClick={() => setEditing(true)}>
            Editar
          </button>
          <button
            className="text-text-muted hover:text-negative"
            onClick={async () => {
              await api(`/api/meetings/${meeting.id}`, { method: "DELETE" });
              onChanged();
            }}
          >
            Excluir
          </button>
        </span>
      </div>
      {meeting.reasoning && (
        <p className="mt-1 t5 text-text-muted">
          <span className="text-text">Por quê: </span>
          {meeting.reasoning}
        </p>
      )}
    </div>
  );
}
