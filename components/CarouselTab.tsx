"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { CAROUSEL_TEMPLATES, TEMPLATE_LABEL, BODY_MAX, TITLE_MAX, type CarouselContent, type CarouselTemplate } from "@/lib/carousel-rules";
import type { Client } from "@/lib/types";
import BrandVoiceCheck from "./BrandVoiceCheck";
import PanelTester from "./PanelTester";
import { Button, Card, ErrorBox, Input, Label, SectionTitle, Select, Spinner, Tag, Textarea } from "./ui";
import { Icon } from "./icons";

type CarouselRow = {
  id: string;
  topic: string;
  goal: string;
  template: CarouselTemplate;
  content: CarouselContent;
  source: "ai" | "manual" | "demo";
  postId: string | null;
  hashes: string[];
  createdAt: string;
};
type Payload = { aiAvailable: boolean; palette: { primary: string }; hasLogo: boolean; carousels: CarouselRow[] };

const initialLink = () => {
  if (typeof window === "undefined") return { topic: "", post: "" };
  const params = new URLSearchParams(window.location.search);
  return { topic: params.get("topic") ?? "", post: params.get("post") ?? "" };
};

// Carrossel pronto para postar: roteiro (IA ou à mão), slides 1080×1350 na
// identidade do cliente, ZIP para baixar e envio para o calendário.
export default function CarouselTab({ client }: { client: Client }) {
  const [link] = useState(initialLink);
  const [data, setData] = useState<Payload | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState({ topic: link.topic, goal: "", count: "6", template: "editorial" as CarouselTemplate });
  const [busy, setBusy] = useState<"" | "ai" | "manual">("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(
    () =>
      api<Payload>(`/api/clients/${client.id}/carousels`)
        .then((payload) => {
          setData(payload);
          setSelectedId((current) => current ?? payload.carousels[0]?.id ?? null);
        })
        .catch((e) => setError(e instanceof Error ? e.message : "Erro")),
    [client.id]
  );

  useEffect(() => {
    load();
  }, [load]);

  async function create(mode: "ai" | "manual") {
    setBusy(mode);
    setError("");
    setNote("");
    try {
      const result = await api<{ carousel: CarouselRow; charged: boolean; cached?: boolean }>(`/api/clients/${client.id}/carousels`, {
        method: "POST",
        body: JSON.stringify({ mode, topic: form.topic, goal: form.goal, count: Number(form.count), template: form.template, postId: link.post || undefined }),
      });
      setSelectedId(result.carousel.id);
      if (mode === "ai") setNote(result.cached ? "Mesmo pedido de antes: veio do histórico, sem gastar coins." : "Carrossel criado. Ajuste o texto de qualquer slide e a imagem se atualiza sozinha.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao criar");
    } finally {
      setBusy("");
    }
  }

  if (!data) return <Spinner label="Carregando carrosséis..." />;
  const selected = data.carousels.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="space-y-6" data-testid="carousel-tab">
      <Card className="space-y-4">
        <div>
          <SectionTitle>Carrossel pronto para postar</SectionTitle>
          <p className="text-sm text-muted">
            A IA escreve de 5 a 8 slides no tom da marca e a Marqa monta as imagens (1080×1350) com as cores e o logo do cliente. Baixe o ZIP ou mande para o calendário.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="carousel-topic">Tema</Label>
            <Input id="carousel-topic" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} placeholder="Ex.: 5 erros ao escolher um café especial" data-testid="carousel-topic" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="carousel-goal">Objetivo (opcional)</Label>
            <Input id="carousel-goal" value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })} placeholder="Ex.: salvar o post e pedir pelo direct" />
          </div>
          <div>
            <Label htmlFor="carousel-count">Slides</Label>
            <Select id="carousel-count" value={form.count} onChange={(e) => setForm({ ...form, count: e.target.value })}>
              {[5, 6, 7, 8].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="carousel-template">Modelo visual</Label>
            <Select id="carousel-template" value={form.template} onChange={(e) => setForm({ ...form, template: e.target.value as CarouselTemplate })}>
              {CAROUSEL_TEMPLATES.map((t) => (
                <option key={t} value={t}>
                  {TEMPLATE_LABEL[t]}
                </option>
              ))}
            </Select>
          </div>
        </div>
        {error && <ErrorBox message={error} />}
        {note && <p className="text-sm text-accent">{note}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => create("ai")} disabled={busy !== "" || form.topic.trim().length < 2 || !data.aiAvailable} data-testid="carousel-generate">
            <Icon name="sparkle" size={14} /> {busy === "ai" ? "Escrevendo os slides..." : "Gerar com IA · 3 coins"}
          </Button>
          <Button variant="ghost" onClick={() => create("manual")} disabled={busy !== "" || form.topic.trim().length < 2} data-testid="carousel-manual">
            <Icon name="edit" size={14} /> Escrever eu mesmo
          </Button>
          {!data.aiAvailable && <span className="text-xs text-muted">A IA não está disponível agora: escreva os slides e as imagens saem igual.</span>}
          {!data.hasLogo && <span className="text-xs text-muted">Dica: suba o logo em Briefing → Arquivos da marca (com &quot;logo&quot; no nome).</span>}
        </div>
      </Card>

      {data.carousels.length === 0 ? (
        <p className="rounded-md border border-dashed border-edge p-4 text-sm text-muted" data-testid="carousel-empty">
          Nenhum carrossel ainda. Escolha um tema acima — carrosséis foram o formato com mais engajamento no Instagram em 2026.
        </p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
          <ul className="space-y-1.5 text-sm" data-testid="carousel-list">
            {data.carousels.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  className={`w-full rounded-md border px-3 py-2 text-left ${c.id === selectedId ? "border-accent bg-accent/5" : "border-edge hover:border-accent/60"}`}
                >
                  <span className="block truncate font-medium">{c.content.hook || c.topic}</span>
                  <span className="text-xs text-muted">{`${c.content.slides.length} slides · ${TEMPLATE_LABEL[c.template]}`}</span>
                </button>
              </li>
            ))}
          </ul>
          {selected && <CarouselEditor key={selected.id} clientId={client.id} carousel={selected} onChanged={load} />}
        </div>
      )}
    </div>
  );
}

function CarouselEditor({ clientId, carousel, onChanged }: { clientId: string; carousel: CarouselRow; onChanged: () => Promise<unknown> }) {
  const [content, setContent] = useState<CarouselContent>(carousel.content);
  const [hashes, setHashes] = useState(carousel.hashes);
  const [template, setTemplate] = useState<CarouselTemplate>(carousel.template);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [when, setWhen] = useState(() => new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10) + "T10:00");
  const [scheduled, setScheduled] = useState("");
  const dirty = JSON.stringify(content) !== JSON.stringify(carousel.content);

  async function save(next: { content?: CarouselContent; template?: CarouselTemplate }) {
    setSaving(true);
    setError("");
    try {
      const updated = await api<CarouselRow>(`/api/carousels/${carousel.id}`, { method: "PATCH", body: JSON.stringify(next) });
      setHashes(updated.hashes);
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function schedule() {
    setError("");
    try {
      const r = await api<{ postId: string; mediaCount: number }>(`/api/carousels/${carousel.id}/schedule`, {
        method: "POST",
        body: JSON.stringify({ scheduledFor: when, channel: "Instagram", status: "draft" }),
      });
      setScheduled(r.postId);
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao agendar");
    }
  }

  async function remove() {
    if (!confirm("Excluir este carrossel?")) return;
    await api(`/api/carousels/${carousel.id}`, { method: "DELETE" });
    await onChanged();
  }

  const setSlide = (index: number, patch: Partial<CarouselContent["slides"][number]>) =>
    setContent((c) => ({ ...c, slides: c.slides.map((s, i) => (i === index ? { ...s, ...patch } : s)) }));

  return (
    <div className="space-y-4" data-testid="carousel-editor">
      <div className="flex flex-wrap items-center gap-2">
        {carousel.source === "demo" && <Tag>exemplo (modo de teste)</Tag>}
        <Select
          aria-label="Modelo visual"
          value={template}
          onChange={(e) => {
            const next = e.target.value as CarouselTemplate;
            setTemplate(next);
            void save({ template: next });
          }}
          data-testid="carousel-template-switch"
        >
          {CAROUSEL_TEMPLATES.map((t) => (
            <option key={t} value={t}>
              {TEMPLATE_LABEL[t]}
            </option>
          ))}
        </Select>
        <a href={`/api/carousels/${carousel.id}/zip`} className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3.5 py-2 text-sm font-medium text-accent-ink" data-testid="carousel-zip">
          <Icon name="download" size={14} /> Baixar tudo (ZIP)
        </a>
        <button type="button" onClick={remove} className="ml-auto text-xs text-red-500 hover:underline">
          Excluir
        </button>
      </div>
      {error && <ErrorBox message={error} />}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {content.slides.map((slide, index) => (
          <div key={index} className="space-y-2 rounded-xl border border-edge bg-surface p-3" data-testid="carousel-slide" data-hash={hashes[index] ?? ""}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/carousels/${carousel.id}/slide/${index}?v=${hashes[index] ?? ""}`}
              alt={`Slide ${index + 1}`}
              width={1080}
              height={1350}
              loading="lazy"
              className="aspect-[4/5] w-full rounded-lg border border-edge bg-surface-2 object-cover"
            />
            <Input aria-label={`Título do slide ${index + 1}`} value={slide.title} maxLength={TITLE_MAX} onChange={(e) => setSlide(index, { title: e.target.value })} data-testid="slide-title" />
            <Textarea aria-label={`Texto do slide ${index + 1}`} value={slide.body} maxLength={BODY_MAX} onChange={(e) => setSlide(index, { body: e.target.value })} />
            <div className="flex items-center justify-between text-xs text-muted">
              <span>{slide.visualHint}</span>
              <a href={`/api/carousels/${carousel.id}/slide/${index}?download=1&v=${hashes[index] ?? ""}`} className="shrink-0 text-accent hover:underline">
                Baixar
              </a>
            </div>
          </div>
        ))}
      </div>

      <Card className="space-y-2">
        <Label htmlFor="carousel-caption">Legenda</Label>
        <Textarea id="carousel-caption" value={content.caption} onChange={(e) => setContent({ ...content, caption: e.target.value })} data-testid="carousel-caption" />
        <p className="text-xs text-muted">{[content.cta, content.hashtags.map((h) => `#${h}`).join(" ")].filter(Boolean).join(" · ")}</p>
        <BrandVoiceCheck clientId={clientId} text={content.caption} kind="post" onRewrite={(text) => setContent({ ...content, caption: text })} />
        {content.slides[0] && (
          <PanelTester clientId={clientId} initial={content.slides[0].title} label="Testar o gancho (slide 1) com o público" onApply={(text) => setSlide(0, { title: text.slice(0, 60) })} />
        )}
      </Card>

      <div className="flex flex-wrap items-end gap-2">
        <Button onClick={() => save({ content })} disabled={!dirty || saving} data-testid="carousel-save">
          {saving ? "Salvando..." : "Salvar textos"}
        </Button>
        <div>
          <Label htmlFor="carousel-when">Postar em</Label>
          <Input id="carousel-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        </div>
        <Button variant="ghost" onClick={schedule} disabled={dirty} data-testid="carousel-schedule">
          <Icon name="calendar" size={14} /> {carousel.postId ? "Atualizar no calendário" : "Levar para o calendário"}
        </Button>
        {scheduled && <span className="text-sm text-accent" data-testid="carousel-scheduled">No calendário como rascunho ✓</span>}
      </div>
    </div>
  );
}
