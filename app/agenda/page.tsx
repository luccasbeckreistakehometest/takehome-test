"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Client } from "@/lib/types";
import type { MeetingWithNames } from "@/lib/marketplace-db";
import type { MeetingRecs } from "@/lib/marketplace-schemas";
import { googleCalendarUrl } from "@/lib/gcal";
import { Button, Card, ErrorBox, Input, Label, SectionTitle, Select, Spinner, Tag } from "@/components/ui";

export default function AgendaPage() {
  const [meetings, setMeetings] = useState<MeetingWithNames[] | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [recs, setRecs] = useState<MeetingRecs | null>(null);
  const [recommending, setRecommending] = useState(false);
  const [scheduled, setScheduled] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");
  const [form, setForm] = useState({ clientId: "", title: "", scheduledAt: "", link: "" });

  const load = useCallback(() => {
    api<MeetingWithNames[]>("/api/meetings").then(setMeetings);
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
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">
            Agenda
          </h1>
          <p className="mt-1 text-sm text-muted">
            Todas as reuniões da agência, com um clique para o Google Calendar — e
            recomendações da IA sobre quais reuniões valem ser feitas, com o porquê.
          </p>
        </div>
        <Button onClick={recommend} disabled={recommending}>
          {recommending ? "Analisando as contas..." : "✦ Recomendar reuniões (IA)"}
        </Button>
      </div>
      {recommending && (
        <Spinner label="Cruzando o estado de todas as contas e demandas..." />
      )}
      {error && <ErrorBox message={error} />}

      {recs && (
        <Card className="space-y-3">
          <SectionTitle>Reuniões recomendadas</SectionTitle>
          <p className="text-sm text-muted">{recs.summary}</p>
          {recs.meetings.map((rec, index) => (
            <div key={index} className="rounded-lg border border-edge bg-surface-2 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">{rec.title}</p>
                <div className="flex items-center gap-2">
                  <Tag>{new Date(rec.suggestedAt).toLocaleString("pt-BR")}</Tag>
                  {scheduled.has(index) ? (
                    <span className="text-xs text-accent">✓ Agendada</span>
                  ) : (
                    <Button className="!px-2.5 !py-1 text-xs" onClick={() => schedule(index)}>
                      Agendar
                    </Button>
                  )}
                </div>
              </div>
              <p className="mt-1 text-xs text-muted">
                <span className="font-semibold text-foreground/80">Participantes: </span>
                {rec.participants}
              </p>
              <p className="mt-1 text-xs text-muted">
                <span className="font-semibold text-accent">Por quê: </span>
                {rec.reasoning}
              </p>
            </div>
          ))}
        </Card>
      )}

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
              <p className="text-sm text-muted">Nada agendado.</p>
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
      <div className="rounded-md border border-accent/40 bg-surface-2 px-3 py-2">
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
              className="!px-2.5 !py-1.5 text-xs"
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
              className="!px-2.5 !py-1.5 text-xs"
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
    <div className="rounded-md border border-edge bg-surface-2 px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p>
          <span className="font-medium">{meeting.title}</span>{" "}
          <span className="text-xs text-muted">
            · {new Date(meeting.scheduledAt).toLocaleString("pt-BR")}
            {meeting.clientName && ` · ${meeting.clientName}`}
            {meeting.projectTitle && ` · ${meeting.projectTitle}`}
          </span>
        </p>
        <span className="flex items-center gap-2 text-xs">
          {meeting.link && (
            <a href={meeting.link} target="_blank" rel="noreferrer" className="text-accent hover:underline">
              entrar ↗
            </a>
          )}
          <a
            href={googleCalendarUrl(meeting)}
            target="_blank"
            rel="noreferrer"
            className="text-muted hover:text-accent"
            title="Adicionar ao Google Calendar"
          >
            📅 Calendar
          </a>
          <button className="text-muted hover:text-accent" onClick={() => setEditing(true)}>
            Editar
          </button>
          <button
            className="text-muted hover:text-red-400"
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
        <p className="mt-1 text-xs text-muted">
          <span className="text-accent">Por quê: </span>
          {meeting.reasoning}
        </p>
      )}
    </div>
  );
}
