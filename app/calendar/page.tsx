"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useUiLang } from "@/lib/i18n";
import type { Client } from "@/lib/types";
import type { ScheduledPostWithClient } from "@/lib/marketplace-db";
import {
  addDays,
  addMonths,
  findContentGaps,
  groupByDay,
  monthGrid,
  parseKey,
  todayKey,
  weekOf,
} from "@/lib/calendar-utils";
import { Button, Card, ErrorBox, Input, Label, Select, Spinner, Tag, Textarea } from "@/components/ui";
import { Icon } from "@/components/icons";
import BrandVoiceCheck from "@/components/BrandVoiceCheck";
import { ApprovalLinkDialog } from "@/components/ApprovalLinkPanel";

type Post = ScheduledPostWithClient;
type View = "month" | "week";

const STATUS_STYLE: Record<Post["status"], string> = {
  draft: "border-dashed border-amber-500/70 bg-amber-500/10 text-amber-600 dark:text-amber-300",
  scheduled: "border-accent/60 bg-accent/10 text-foreground",
  published: "border-emerald-500/60 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  canceled: "border-edge bg-surface-2 text-muted line-through",
};
const STATUS_LABEL: Record<Post["status"], string> = {
  draft: "Rascunho",
  scheduled: "Agendado",
  published: "Publicado",
  canceled: "Cancelado",
};
const CHANNELS = ["Instagram", "Facebook", "TikTok", "LinkedIn", "YouTube", "WhatsApp", "E-mail", "Blog/SEO"];

// Calendário de conteúdo: semana/mês com os posts de cada cliente, troca de
// status sem arrastar, e o aviso de "buracos" (dias sem conteúdo à frente).
export default function CalendarPage() {
  const lang = useUiLang();
  const locale = lang === "en" ? "en-US" : "pt-BR";
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [view, setView] = useState<View>("month");
  const [anchor, setAnchor] = useState<string>(() => todayKey());
  const [clientFilter, setClientFilter] = useState("all");
  const [selected, setSelected] = useState<Post | null>(null);
  const [adding, setAdding] = useState<{ date: string } | null>(null);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => api<Post[]>("/api/scheduled-posts").then(setPosts).catch((e) => setError(e.message)), []);
  useEffect(() => {
    load();
    api<Client[]>("/api/clients").then(setClients).catch(() => {});
  }, [load]);

  const visible = useMemo(
    () => (posts ?? []).filter((p) => clientFilter === "all" || p.clientId === clientFilter),
    [posts, clientFilter]
  );
  const byDay = useMemo(() => groupByDay(visible), [visible]);
  const grid = useMemo(
    () => (view === "month" ? monthGrid(anchor) : [weekOf(anchor).map((key) => ({ key, inMonth: true }))]),
    [view, anchor]
  );
  const rangeDays = useMemo(() => grid.flat().filter((d) => d.inMonth).map((d) => d.key), [grid]);
  const today = todayKey();
  const gaps = useMemo(() => findContentGaps(visible, rangeDays, today), [visible, rangeDays, today]);
  const longestStreak = useMemo(() => gaps.streaks.reduce((max, s) => Math.max(max, s.length), 0), [gaps]);

  const title =
    view === "month"
      ? parseKey(anchor).toLocaleDateString(locale, { month: "long", year: "numeric" })
      : `${parseKey(weekOf(anchor)[0]).toLocaleDateString(locale, { day: "2-digit", month: "short" })} – ${parseKey(weekOf(anchor)[6]).toLocaleDateString(locale, { day: "2-digit", month: "short" })}`;
  const weekdayNames = weekOf(today).map((k) => parseKey(k).toLocaleDateString(locale, { weekday: "short" }));

  async function patch(post: Post, body: Record<string, unknown>) {
    setError("");
    try {
      await api(`/api/scheduled-posts/${post.id}`, { method: "PATCH", body: JSON.stringify(body) });
      await load();
      setSelected((prev) => (prev && prev.id === post.id ? { ...prev, ...body } : prev));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao atualizar");
    }
  }

  async function remove(post: Post) {
    if (!confirm("Excluir este post do calendário?")) return;
    await api(`/api/scheduled-posts/${post.id}`, { method: "DELETE" });
    setSelected(null);
    load();
  }

  return (
    <div className="space-y-6" data-testid="calendar-page">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">Calendário de conteúdo</h1>
          <p className="mt-1 text-sm text-muted">
            Tudo o que vai ao ar, por cliente e por dia. Rascunhos nascem das aprovações; mude o status com um clique.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} data-testid="calendar-client">
            <option value="all">Todos os clientes</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <div className="flex rounded-md border border-edge">
            <button onClick={() => setView("month")} className={`px-3 py-1.5 text-sm ${view === "month" ? "bg-accent/15 text-accent" : "text-muted"}`} data-testid="view-month">
              Mês
            </button>
            <button onClick={() => setView("week")} className={`px-3 py-1.5 text-sm ${view === "week" ? "bg-accent/15 text-accent" : "text-muted"}`} data-testid="view-week">
              Semana
            </button>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setAnchor((a) => (view === "month" ? addMonths(a, -1) : addDays(a, -7)))} className="grid size-8 place-items-center rounded-md border border-edge hover:border-accent" aria-label="Anterior">
              ‹
            </button>
            <button onClick={() => setAnchor(todayKey())} className="rounded-md border border-edge px-2 py-1 text-xs hover:border-accent">
              Hoje
            </button>
            <button onClick={() => setAnchor((a) => (view === "month" ? addMonths(a, 1) : addDays(a, 7)))} className="grid size-8 place-items-center rounded-md border border-edge hover:border-accent" aria-label="Próximo">
              ›
            </button>
          </div>
          <Button variant="ghost" onClick={() => setSharing(true)} data-testid="calendar-approval-link" disabled={clients.length === 0}>
            <Icon name="send" size={14} /> Enviar para aprovação
          </Button>
          <Button onClick={() => setAdding({ date: today })} data-testid="calendar-add">
            <Icon name="plus" size={14} /> Novo post
          </Button>
        </div>
      </div>

      {error && <ErrorBox message={error} />}

      {gaps.emptyDays.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm" data-testid="calendar-gaps">
          <span className="font-medium">Buracos no calendário:</span>
          <span>
            <span data-testid="gap-count">{gaps.emptyDays.length}</span> <span>dias sem conteúdo à frente</span>
          </span>
          {longestStreak > 0 && (
            <span className="text-xs text-muted">
              · <span>maior sequência:</span> {longestStreak} <span>dias</span>
            </span>
          )}
          <span className="flex flex-wrap gap-1">
            {gaps.emptyDays.slice(0, 8).map((day) => (
              <button
                key={day}
                onClick={() => setAdding({ date: day })}
                className="rounded border border-amber-500/50 px-1.5 py-0.5 text-xs hover:bg-amber-500/20"
                title="Criar post neste dia"
              >
                {parseKey(day).toLocaleDateString(locale, { weekday: "short", day: "2-digit" })} +
              </button>
            ))}
            {gaps.emptyDays.length > 8 && <span className="text-xs text-muted">…</span>}
          </span>
        </div>
      )}

      <Card className="!p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="font-[family-name:var(--font-display)] text-lg font-semibold capitalize" data-testid="calendar-title">
            {title}
          </p>
          <div className="hidden gap-2 text-[10px] uppercase tracking-wide text-muted sm:flex">
            {(["draft", "scheduled", "published", "canceled"] as const).map((s) => (
              <span key={s} className={`rounded border px-1.5 py-0.5 ${STATUS_STYLE[s]}`}>
                {STATUS_LABEL[s]}
              </span>
            ))}
          </div>
        </div>
        {!posts ? (
          <div className="grid place-items-center py-16">
            <Spinner label="Carregando o calendário..." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[700px]">
              <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wider text-muted">
                {weekdayNames.map((name, i) => (
                  <div key={i} className="py-1">
                    {name}
                  </div>
                ))}
              </div>
              {grid.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7 gap-1">
                  {week.map((day) => {
                    const items = byDay.get(day.key) ?? [];
                    const isToday = day.key === today;
                    const isGap = gaps.emptyDays.includes(day.key);
                    const limit = view === "month" ? 3 : 12;
                    return (
                      <div
                        key={day.key}
                        className={`group rounded-md border p-1.5 ${view === "month" ? "min-h-24" : "min-h-48"} ${
                          day.inMonth ? "bg-surface" : "bg-surface-2/50 opacity-50"
                        } ${isToday ? "border-accent" : isGap ? "border-amber-500/40" : "border-edge"}`}
                        data-testid="calendar-day"
                        data-date={day.key}
                      >
                        <div className="mb-1 flex items-center justify-between">
                          <span className={`text-xs ${isToday ? "font-bold text-accent" : "text-muted"}`}>{parseKey(day.key).getDate()}</span>
                          <button
                            onClick={() => setAdding({ date: day.key })}
                            className="text-xs text-muted opacity-0 transition-opacity hover:text-accent group-hover:opacity-100"
                            aria-label="Novo post neste dia"
                          >
                            +
                          </button>
                        </div>
                        <div className="space-y-1">
                          {items.slice(0, limit).map((post) => (
                            <button
                              key={post.id}
                              onClick={() => setSelected(post)}
                              className={`block w-full truncate rounded border px-1.5 py-0.5 text-left text-[11px] leading-tight ${STATUS_STYLE[post.status]}`}
                              title={`${post.clientName} · ${post.channel} · ${STATUS_LABEL[post.status]}`}
                              data-testid="calendar-post"
                              data-status={post.status}
                            >
                              {post.clientApproval === "approved" ? "✓ " : post.clientApproval === "changes_requested" ? "↩ " : post.clientApproval === "pending" ? "⏳ " : ""}
                              {post.title}
                              {clientFilter === "all" && <span className="text-muted"> · {post.clientName}</span>}
                            </button>
                          ))}
                          {items.length > limit && <p className="text-[10px] text-muted">+{items.length - limit}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {selected && (
        <PostPanel
          post={selected}
          locale={locale}
          onClose={() => setSelected(null)}
          onPatch={(body) => patch(selected, body)}
          onDelete={() => remove(selected)}
        />
      )}

      {sharing && (
        <ApprovalLinkDialog
          clients={clients}
          defaultClientId={clientFilter !== "all" ? clientFilter : ""}
          onClose={() => {
            setSharing(false);
            load();
          }}
        />
      )}

      {adding && (
        <QuickAdd
          date={adding.date}
          clients={clients}
          defaultClientId={clientFilter !== "all" ? clientFilter : clients[0]?.id ?? ""}
          onClose={() => setAdding(null)}
          onCreated={() => {
            setAdding(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function PostPanel({
  post,
  locale,
  onClose,
  onPatch,
  onDelete,
}: {
  post: Post;
  locale: string;
  onClose: () => void;
  onPatch: (body: Record<string, unknown>) => Promise<void>;
  onDelete: () => void;
}) {
  const [when, setWhen] = useState(post.scheduledFor.slice(0, 16));
  const [caption, setCaption] = useState(post.caption);
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-lg animate-pop-in rounded-2xl border border-edge bg-surface p-5 shadow-2xl [transform-origin:center]" onClick={(e) => e.stopPropagation()} data-testid="post-panel">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-accent">{post.clientName}</p>
            <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold">{post.title}</h3>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <Tag>{post.channel}</Tag>
              {post.format && <Tag>{post.format}</Tag>}
              {post.hookType && <Tag>{post.hookType}</Tag>}
              <Tag>{STATUS_LABEL[post.status]}</Tag>
              {post.campaignId && <Tag>campanha de 30 dias</Tag>}
              {post.clientApproval === "pending" && <Tag>Aguardando o cliente</Tag>}
              {post.clientApproval === "approved" && <Tag>Aprovado pelo cliente</Tag>}
              {post.clientApproval === "changes_requested" && <Tag>Cliente pediu ajuste</Tag>}
            </div>
          </div>
          <button onClick={onClose} className="text-muted hover:text-foreground" aria-label="Fechar" data-testid="post-close">
            <Icon name="x" size={18} />
          </button>
        </div>
        {post.deliverableId && (
          <a href={`/api/files/${post.deliverableId}`} target="_blank" rel="noreferrer" className="mt-3 block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/files/${post.deliverableId}`} alt={post.title} className="max-h-48 rounded-md border border-edge object-contain" />
            <span className="mt-1 block text-xs text-accent">Peça aprovada pelo cliente ↗</span>
          </a>
        )}
        {post.clientApproval === "changes_requested" && post.clientApprovalNote && (
          <p className="mt-3 rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm" data-testid="post-client-note">
            <span className="block text-xs font-medium">{post.clientApprovalBy ? `Ajuste pedido por ${post.clientApprovalBy}` : "Ajuste pedido pelo cliente"}</span>
            “{post.clientApprovalNote}”
          </p>
        )}
        {post.imageBrief && (
          <p className="mt-3 whitespace-pre-wrap rounded-md border border-edge bg-surface-2 p-2 text-xs text-muted" data-testid="post-image-brief">
            {post.imageBrief}
          </p>
        )}
        <div className="mt-3 space-y-2">
          <Label>Legenda</Label>
          <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Legenda do post" data-testid="post-caption" />
          {caption !== post.caption && (
            <Button variant="ghost" className="!px-2.5 !py-1 text-xs" onClick={() => onPatch({ caption })} data-testid="post-caption-save">
              Salvar legenda
            </Button>
          )}
          <BrandVoiceCheck clientId={post.clientId} text={caption} kind="post" onRewrite={setCaption} />
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <div>
            <Label>Data e hora</Label>
            <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} data-testid="post-when" />
          </div>
          <Button variant="ghost" onClick={() => onPatch({ scheduledFor: when })} disabled={!when || when === post.scheduledFor.slice(0, 16)}>
            Salvar data
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {post.status === "draft" && (
            <Button onClick={() => onPatch({ status: "scheduled", scheduledFor: when })} data-testid="post-schedule">
              <Icon name="clock" size={14} /> Agendar
            </Button>
          )}
          {post.status === "scheduled" && (
            <Button onClick={() => onPatch({ status: "published" })} data-testid="post-publish">
              <Icon name="check" size={14} /> Marcar publicado
            </Button>
          )}
          {(post.status === "scheduled" || post.status === "published") && (
            <Button variant="ghost" onClick={() => onPatch({ status: "draft" })}>
              Voltar para rascunho
            </Button>
          )}
          {post.status !== "canceled" && (
            <Button variant="ghost" onClick={() => onPatch({ status: "canceled" })}>
              Cancelar post
            </Button>
          )}
          {post.status === "canceled" && (
            <Button variant="ghost" onClick={() => onPatch({ status: "scheduled" })}>
              Reativar
            </Button>
          )}
          {post.status !== "published" && post.format !== "Carrossel" && (
            <a
              href={`/clients/${post.clientId}?tab=carousels&topic=${encodeURIComponent(post.title)}&post=${post.id}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-edge px-3.5 py-2 text-sm hover:border-accent"
              data-testid="post-to-carousel"
            >
              <Icon name="layers" size={14} /> Transformar em carrossel
            </a>
          )}
          <Button variant="danger" className="ml-auto" onClick={onDelete}>
            Excluir
          </Button>
        </div>
        <p className="mt-3 text-[11px] text-muted">
          <span>Criado em</span> {new Date(post.createdAt).toLocaleDateString(locale)}
        </p>
      </div>
    </div>
  );
}

function QuickAdd({
  date,
  clients,
  defaultClientId,
  onClose,
  onCreated,
}: {
  date: string;
  clients: Client[];
  defaultClientId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    clientId: defaultClientId,
    title: "",
    channel: "Instagram",
    when: `${date}T10:00`,
    caption: "",
    status: "scheduled" as "scheduled" | "draft",
    format: "",
    hookType: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    setSaving(true);
    setError("");
    try {
      await api("/api/scheduled-posts", {
        method: "POST",
        body: JSON.stringify({
          clientId: form.clientId,
          title: form.title,
          channel: form.channel,
          caption: form.caption,
          hashtags: [],
          scheduledFor: form.when,
          status: form.status,
          format: form.format,
          hookType: form.hookType,
        }),
      });
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao criar");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-lg animate-pop-in space-y-3 rounded-2xl border border-edge bg-surface p-5 shadow-2xl [transform-origin:center]" onClick={(e) => e.stopPropagation()} data-testid="quick-add">
        <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold">Novo post</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Cliente</Label>
            <Select value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} data-testid="quick-client">
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label>Título</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex.: Reels dos bastidores" data-testid="quick-title" />
          </div>
          <div>
            <Label>Canal</Label>
            <Select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
              {CHANNELS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Data e hora</Label>
            <Input type="datetime-local" value={form.when} onChange={(e) => setForm({ ...form, when: e.target.value })} data-testid="quick-when" />
          </div>
          <div>
            <Label>Formato</Label>
            <Select value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })}>
              <option value="">—</option>
              {["Feed", "Carrossel", "Reels", "Stories", "Vídeo", "Texto", "Newsletter", "Artigo"].map((f) => (
                <option key={f}>{f}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Tipo de gancho</Label>
            <Select value={form.hookType} onChange={(e) => setForm({ ...form, hookType: e.target.value })}>
              <option value="">—</option>
              {["dor", "prova social", "bastidores", "dado", "pergunta", "tutorial", "oferta"].map((h) => (
                <option key={h}>{h}</option>
              ))}
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label>Legenda (opcional)</Label>
            <Textarea value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} data-testid="quick-caption" />
            {form.clientId && form.caption.trim() && (
              <div className="mt-2">
                <BrandVoiceCheck clientId={form.clientId} text={form.caption} kind="post" onRewrite={(text) => setForm((f) => ({ ...f, caption: text }))} compact />
              </div>
            )}
          </div>
          <div className="sm:col-span-2">
            <Label>Entrar como</Label>
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as "scheduled" | "draft" })}>
              <option value="scheduled">Agendado</option>
              <option value="draft">Rascunho</option>
            </Select>
          </div>
        </div>
        {error && <ErrorBox message={error} />}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving || !form.clientId || !form.title.trim() || !form.when} data-testid="quick-save">
            {saving ? "Salvando..." : "Criar post"}
          </Button>
        </div>
      </div>
    </div>
  );
}
