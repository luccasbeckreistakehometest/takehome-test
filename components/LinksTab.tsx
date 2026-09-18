"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Client } from "@/lib/types";
import { Button, Card, CopyButton, ErrorBox, Input, Label, SectionTitle, Spinner, Textarea } from "./ui";
import { Icon } from "./icons";

type LinkRow = { code: string; destUrl: string; label: string; postId: string | null; clicks: number; clicks30: number; uniques30: number; shortUrl: string; utm: Record<string, string> };
type Bio = { slug: string; title: string; bio: string; buttons: { code: string; label: string }[]; published: boolean; indexable: boolean };
type Payload = { links: LinkRow[]; bio: Bio | null; suggestedSlug: string; base: string };

// Links rastreáveis + link na bio: cada link ganha UTM sozinho e conta
// cliques (sem cookie); a bio mostra os botões e os últimos posts.
export default function LinksTab({ client }: { client: Client }) {
  const [data, setData] = useState<Payload | null>(null);
  const [form, setForm] = useState({ destUrl: "", label: "" });
  const [bio, setBio] = useState<Bio | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const load = useCallback(
    (resetBio: boolean) =>
      api<Payload>(`/api/clients/${client.id}/links`)
        .then((payload) => {
          setData(payload);
          if (resetBio) {
            setBio(payload.bio ?? { slug: payload.suggestedSlug, title: client.name, bio: "", buttons: [], published: false, indexable: false });
          }
        })
        .catch((e) => setError(e instanceof Error ? e.message : "Erro")),
    [client.id, client.name]
  );

  useEffect(() => {
    load(true);
  }, [load]);

  async function addLink() {
    setError("");
    try {
      const link = await api<LinkRow>(`/api/clients/${client.id}/links`, { method: "POST", body: JSON.stringify(form) });
      setForm({ destUrl: "", label: "" });
      // link novo já entra como botão da bio
      if (bio && bio.buttons.length < 8) setBio({ ...bio, buttons: [...bio.buttons, { code: link.code, label: link.label }] });
      await load(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    }
  }

  async function archive(code: string) {
    await api(`/api/links/${code}`, { method: "PATCH", body: JSON.stringify({ archived: true }) });
    if (bio) setBio({ ...bio, buttons: bio.buttons.filter((b) => b.code !== code) });
    await load(false);
  }

  async function saveBio() {
    if (!bio) return;
    setError("");
    setSaved(false);
    try {
      const next = await api<Bio>(`/api/clients/${client.id}/bio`, { method: "PUT", body: JSON.stringify(bio) });
      setBio(next);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar");
    }
  }

  function move(index: number, delta: number) {
    if (!bio) return;
    const buttons = [...bio.buttons];
    const target = index + delta;
    if (target < 0 || target >= buttons.length) return;
    [buttons[index], buttons[target]] = [buttons[target], buttons[index]];
    setBio({ ...bio, buttons });
  }

  if (!data || !bio) return <Spinner label="Carregando links..." />;
  const inBio = new Set(bio.buttons.map((b) => b.code));
  const byCode = new Map(data.links.map((l) => [l.code, l]));
  const pageUrl = `${data.base}/b/${bio.slug}`;

  return (
    <div className="grid gap-6 lg:grid-cols-2" data-testid="links-tab">
      <Card className="space-y-4">
        <div>
          <SectionTitle>Links rastreáveis</SectionTitle>
          <p className="text-sm text-muted">Cole o endereço: a Marqa cria um link curto com UTM e conta os cliques (sem cookie). Nos posts do calendário, use o campo Link.</p>
        </div>
        {error && <ErrorBox message={error} />}
        <div className="grid gap-2 sm:grid-cols-[1fr_160px_auto] sm:items-end">
          <div>
            <Label htmlFor="link-dest">Endereço de destino</Label>
            <Input id="link-dest" value={form.destUrl} onChange={(e) => setForm({ ...form, destUrl: e.target.value })} placeholder="https://loja.com/produto" data-testid="link-dest" />
          </div>
          <div>
            <Label htmlFor="link-label">Nome do botão</Label>
            <Input id="link-label" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Ver a loja" data-testid="link-label" />
          </div>
          <Button onClick={addLink} disabled={!form.destUrl.trim()} data-testid="link-create">
            <Icon name="link" size={14} /> Criar
          </Button>
        </div>
        {data.links.length === 0 ? (
          <p className="text-sm text-muted" data-testid="links-empty">Nenhum link ainda.</p>
        ) : (
          <ul className="space-y-2" data-testid="links-list">
            {data.links.map((link) => (
              <li key={link.code} className="rounded-md border border-edge bg-surface-2 px-3 py-2 text-sm" data-testid="link-row" data-code={link.code}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0 flex-1 truncate font-medium">{link.label || link.destUrl}</span>
                  <span className="text-xs text-muted" data-testid="link-clicks">{`${link.clicks30} cliques · ${link.uniques30} pessoas (30 dias)`}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-mono text-text">{link.shortUrl.replace(/^https?:\/\//, "")}</span>
                  <CopyButton text={link.shortUrl} label="Copiar" />
                  {link.postId && <span className="text-muted">de um post do calendário</span>}
                  {!inBio.has(link.code) && bio.buttons.length < 8 && (
                    <button type="button" className="text-text hover:underline" onClick={() => setBio({ ...bio, buttons: [...bio.buttons, { code: link.code, label: link.label }] })}>
                      + na bio
                    </button>
                  )}
                  <button type="button" className="ml-auto text-negative hover:underline" onClick={() => archive(link.code)}>
                    Arquivar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="space-y-4">
        <div>
          <SectionTitle>Link na bio</SectionTitle>
          <p className="text-sm text-muted">Uma página com as cores e o logo da marca, os botões e os últimos posts publicados. Cada toque conta como clique.</p>
        </div>
        <div className="grid gap-3">
          <div>
            <Label htmlFor="bio-slug">Endereço</Label>
            <div className="flex items-center gap-1 text-sm">
              <span className="shrink-0 text-muted">{`${data.base.replace(/^https?:\/\//, "")}/b/`}</span>
              <Input id="bio-slug" value={bio.slug} onChange={(e) => setBio({ ...bio, slug: e.target.value })} data-testid="bio-slug" />
            </div>
          </div>
          <div>
            <Label htmlFor="bio-title">Título</Label>
            <Input id="bio-title" value={bio.title} maxLength={80} onChange={(e) => setBio({ ...bio, title: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="bio-text">Texto curto</Label>
            <Textarea id="bio-text" value={bio.bio} maxLength={280} onChange={(e) => setBio({ ...bio, bio: e.target.value })} placeholder="O que a marca faz, em uma frase." />
          </div>
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Botões (até 8)</p>
            {bio.buttons.length === 0 ? (
              <p className="text-sm text-muted">Crie um link ao lado para virar botão.</p>
            ) : (
              <ul className="space-y-1.5" data-testid="bio-buttons">
                {bio.buttons.map((button, index) => (
                  <li key={button.code} className="flex items-center gap-2">
                    <Input
                      aria-label="Texto do botão"
                      value={button.label}
                      placeholder={byCode.get(button.code)?.destUrl ?? ""}
                      onChange={(e) => setBio({ ...bio, buttons: bio.buttons.map((b) => (b.code === button.code ? { ...b, label: e.target.value } : b)) })}
                    />
                    <button type="button" aria-label="Subir" onClick={() => move(index, -1)} className="px-1 text-muted hover:text-foreground">↑</button>
                    <button type="button" aria-label="Descer" onClick={() => move(index, 1)} className="px-1 text-muted hover:text-foreground">↓</button>
                    <button type="button" aria-label="Tirar da bio" onClick={() => setBio({ ...bio, buttons: bio.buttons.filter((b) => b.code !== button.code) })} className="px-1 text-muted hover:text-negative">×</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={bio.published} onChange={(e) => setBio({ ...bio, published: e.target.checked })} data-testid="bio-published" />
            Página no ar
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={bio.indexable} onChange={(e) => setBio({ ...bio, indexable: e.target.checked })} />
            Aparecer no Google
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={saveBio} data-testid="bio-save">Salvar página</Button>
          {saved && <span className="text-sm text-text">Salvo ✓</span>}
          {bio.published && (
            <a href={pageUrl} target="_blank" rel="noreferrer" className="text-sm text-text hover:underline" data-testid="bio-open">
              Abrir a página ↗
            </a>
          )}
          {bio.published && <CopyButton text={pageUrl} label="Copiar endereço" />}
        </div>
      </Card>
    </div>
  );
}
