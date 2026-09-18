"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useUiLang } from "@/lib/i18n";
import { CHANNEL_OPTIONS, type Client } from "@/lib/types";
import type { ScheduledPost } from "@/lib/marketplace-db";
import type { CampaignSummary } from "@/lib/campaigns-db";
import { addDays, todayKey } from "@/lib/calendar-utils";
import { Button, Card, ErrorBox, Input, Label, SectionTitle, Select, Spinner, Tag, Textarea } from "./ui";
import { Icon } from "./icons";

type Review = { campaign: CampaignSummary; posts: ScheduledPost[] };

const STATUS_LABEL: Record<ScheduledPost["status"], string> = { draft: "Rascunho", scheduled: "Agendado", published: "Publicado", canceled: "Cancelado" };

// Aba "30 dias": objetivo + canais + início → um mês inteiro de posts
// rascunhados no calendário, revisados um a um (aceitar / pular).
export default function CampaignTab({ client }: { client: Client }) {
  const lang = useUiLang();
  const [campaigns, setCampaigns] = useState<CampaignSummary[] | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [form, setForm] = useState({
    goal: client.goals,
    channels: client.channels.length ? client.channels.slice(0, 3) : ["Instagram"],
    startDate: addDays(todayKey(), 1),
    postsPerWeek: "3",
  });
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [busyPost, setBusyPost] = useState<string | null>(null);

  const loadList = useCallback(() => {
    api<{ campaigns: CampaignSummary[] }>(`/api/clients/${client.id}/campaigns`).then((r) => setCampaigns(r.campaigns)).catch((e) => setError(e.message));
  }, [client.id]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  async function open(id: string) {
    setError("");
    try {
      setReview(await api<Review>(`/api/campaigns/${id}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao abrir");
    }
  }

  async function generate() {
    setGenerating(true);
    setError("");
    try {
      const created = await api<{ campaign: CampaignSummary }>(`/api/clients/${client.id}/campaigns`, {
        method: "POST",
        body: JSON.stringify({ goal: form.goal, channels: form.channels, startDate: form.startDate, days: 30, postsPerWeek: Number(form.postsPerWeek) }),
      });
      loadList();
      await open(created.campaign.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao gerar a campanha");
    } finally {
      setGenerating(false);
    }
  }

  async function decide(postId: string, action: "accept" | "skip") {
    if (!review) return;
    setBusyPost(postId);
    try {
      setReview(await api<Review>(`/api/campaigns/${review.campaign.id}`, { method: "PATCH", body: JSON.stringify({ action, postId }) }));
      loadList();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusyPost(null);
    }
  }

  async function acceptAll() {
    if (!review) return;
    setBusyPost("all");
    try {
      setReview(await api<Review>(`/api/campaigns/${review.campaign.id}`, { method: "PATCH", body: JSON.stringify({ action: "accept_all" }) }));
      loadList();
    } finally {
      setBusyPost(null);
    }
  }

  const toggleChannel = (c: string) => setForm((f) => ({ ...f, channels: f.channels.includes(c) ? f.channels.filter((x) => x !== c) : [...f.channels, c] }));
  const fmtDay = (iso: string) => new Date(iso.length <= 16 ? `${iso}:00` : iso).toLocaleDateString(lang === "en" ? "en-US" : "pt-BR", { weekday: "short", day: "2-digit", month: "short" });

  return (
    <div className="space-y-6" data-testid="campaign-tab">
      <div>
        <h2 className="d4">Campanha de 30 dias</h2>
        <p className="t3 measure-lede mt-2 text-text-muted">
          Do briefing + objetivo + canais para um mês inteiro: temas por semana, formato por canal, dias de postagem e cada post já escrito (gancho, legenda, CTA e brief da imagem) — tudo entra no calendário como rascunho para você aceitar ou pular.
        </p>
      </div>

      {!review && (
        <Card className="space-y-4">
          <SectionTitle>Gerar a campanha</SectionTitle>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label>Objetivo do mês</Label>
              <Textarea value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })} placeholder="Ex.: dobrar os pedidos pelo delivery nas manhãs de semana" data-testid="campaign-goal" />
            </div>
            <div className="md:col-span-2">
              <Label>Canais</Label>
              <div className="flex flex-wrap gap-1.5">
                {CHANNEL_OPTIONS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleChannel(c)}
                    className={`rounded-xs border px-3 py-1 t5 ${form.channels.includes(c) ? "border-edge bg-surface-sunken text-text" : "border-edge text-text-muted hover:border-edge"}`}
                    data-testid="campaign-channel"
                    data-channel={c}
                    aria-pressed={form.channels.includes(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Começa em</Label>
              <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} data-testid="campaign-start" />
            </div>
            <div>
              <Label>Posts por semana</Label>
              <Select value={form.postsPerWeek} onChange={(e) => setForm({ ...form, postsPerWeek: e.target.value })} data-testid="campaign-cadence">
                {["2", "3", "4", "5"].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </Select>
            </div>
          </div>
          {error && <ErrorBox message={error} />}
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={generate} disabled={generating || form.channels.length === 0} data-testid="campaign-generate">
              <Icon name="sparkle" size={15} /> {generating ? "Escrevendo o mês..." : "Gerar campanha de 30 dias"}
            </Button>
            {generating && <Spinner label="A IA está planejando as semanas e escrevendo cada post (2-4 min)..." />}
          </div>
        </Card>
      )}

      {review && (
        <Card className="space-y-4" data-testid="campaign-review" data-status={review.campaign.status}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="t6 text-text-muted">Revisão da campanha</p>
              <h3 className="d4" data-testid="campaign-theme">{review.campaign.theme}</h3>
              <p className="t3 measure-lede mt-2 text-text-muted">{review.campaign.summary}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {review.campaign.weeks.map((w) => (
                  <Tag key={w.week}>
                    <span>Semana</span> {w.week}: {w.theme}
                  </Tag>
                ))}
              </div>
            </div>
            <div className="text-right t5 text-text-muted">
              <p>
                <span data-testid="campaign-drafts">{review.campaign.drafts}</span> <span>rascunhos</span> · <span data-testid="campaign-scheduled">{review.campaign.scheduled}</span> <span>agendados</span>
              </p>
              {review.campaign.demo && <Tag>exemplo — sem chave de IA</Tag>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={acceptAll} disabled={busyPost !== null || review.campaign.drafts === 0} data-testid="campaign-accept-all">
              <Icon name="check" size={14} /> Aceitar todos os rascunhos
            </Button>
            <Link href="/calendar" className="t3 text-text hover:underline">
              Ver no calendário
            </Link>
            <button onClick={() => setReview(null)} className="ml-auto t3 text-text-muted hover:text-text" data-testid="campaign-back">
              ← Voltar
            </button>
          </div>
          {error && <ErrorBox message={error} />}
          <div className="space-y-2">
            {review.posts.map((post) => (
              <div key={post.id} className="rounded-md border border-edge bg-surface-sunken p-3 t3" data-testid="campaign-post" data-status={post.status}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium capitalize">{fmtDay(post.scheduledFor)}</span>
                    <Tag>{post.channel}</Tag>
                    {post.format && <Tag>{post.format}</Tag>}
                    {post.hookType && <Tag>{post.hookType}</Tag>}
                    <Tag>{STATUS_LABEL[post.status]}</Tag>
                  </div>
                  {post.status === "draft" && (
                    <div className="flex gap-1.5">
                      <Button className="!px-2.5 !py-1 t5" disabled={busyPost !== null} onClick={() => decide(post.id, "accept")} data-testid="campaign-accept">Aceitar
                      </Button>
                      <Button variant="ghost" className="!px-2.5 !py-1 t5" disabled={busyPost !== null} onClick={() => decide(post.id, "skip")} data-testid="campaign-skip">
                        Pular
                      </Button>
                    </div>
                  )}
                </div>
                <p className="mt-1 font-semibold">{post.title}</p>
                <details className="mt-1">
                  <summary className="cursor-pointer t5 text-text">Ver legenda, CTA e brief da imagem</summary>
                  <p className="mt-2 whitespace-pre-wrap text-text/90">{post.caption}</p>
                  {post.hashtags.length > 0 && <p className="mt-1 t5 text-text">{post.hashtags.join(" ")}</p>}
                  {post.imageBrief && (
                    <p className="mt-2 whitespace-pre-wrap t5 text-text-muted">
                      <span className="font-semibold">Brief da imagem:</span> {post.imageBrief}
                    </p>
                  )}
                </details>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <SectionTitle>Campanhas geradas</SectionTitle>
        {!campaigns ? (
          <Spinner label="Carregando..." />
        ) : campaigns.length === 0 ? (
          <p className="t3 text-text-muted">Nenhuma campanha ainda — gere a primeira acima.</p>
        ) : (
          <div className="space-y-1.5">
            {campaigns.map((c) => (
              <button
                key={c.id}
                onClick={() => open(c.id)}
                className="flex w-full flex-wrap items-center justify-between gap-2 rounded-md border border-edge bg-surface-sunken px-3 py-2 text-left t3 transition-colors hover:border-edge"
                data-testid="campaign-row"
                data-status={c.status}
              >
                <span>
                  <span className="font-medium">{c.theme}</span>{" "}
                  <span className="t5 text-text-muted">· {c.startDate} · {c.channels.join(", ")}</span>
                </span>
                <span className="t5 text-text-muted">
                  {c.total} posts · {c.drafts} rascunhos · {c.scheduled} agendados {c.status === "done" ? "· revisada ✓" : ""}
                </span>
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
