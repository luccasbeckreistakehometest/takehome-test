"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useUiLang } from "@/lib/i18n";
import { BUDGET_BAND_LABELS, normalizeSlug, type AgencyPageConfig, type BudgetBand, type Testimonial } from "@/lib/agency-page-rules";
import type { LeadRecord, PortfolioItem, ShowcaseClient } from "@/lib/agency-page-db";
import { Button, Card, CopyButton, ErrorBox, Input, Label, SectionTitle, Textarea } from "./ui";

type Payload = {
  config: AgencyPageConfig;
  agencyName: string;
  path: string;
  portfolio: PortfolioItem[];
  clients: ShowcaseClient[];
  leads: LeadRecord[];
};

// Card de Configurações: a página pública da agência (/a/slug) — endereço,
// textos, serviços, depoimentos, peças do portfólio, clientes com
// consentimento e os leads que chegaram pelo formulário.
export default function AgencyPageCard({ origin }: { origin: string }) {
  const lang = useUiLang();
  const [data, setData] = useState<Payload | null>(null);
  const [config, setConfig] = useState<AgencyPageConfig | null>(null);
  const [servicesText, setServicesText] = useState("");
  const [portfolioIds, setPortfolioIds] = useState<string[]>([]);
  const [clientIds, setClientIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const loaded = useRef(false);
  useEffect(() => {
    api<Payload>("/api/agency-page")
      .then((p) => {
        // efeito duplo do dev: a segunda resposta não sobrescreve o formulário
        if (loaded.current) return;
        loaded.current = true;
        setData(p);
        setConfig(p.config);
        setServicesText(p.config.services.join("\n"));
        setPortfolioIds(p.portfolio.filter((i) => i.public).map((i) => i.id));
        setClientIds(p.clients.filter((c) => c.showcase).map((c) => c.id));
      })
      .catch(() => {});
  }, []);

  if (!data || !config) return null;

  const slug = normalizeSlug(config.slug || data.agencyName) || "agencia";
  const publicUrl = `${origin}/a/${slug}`;
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  async function save() {
    if (!config) return;
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const next = await api<Payload>("/api/agency-page", {
        method: "PUT",
        body: JSON.stringify({
          config: { ...config, services: servicesText.split("\n").map((s) => s.trim()).filter(Boolean) },
          portfolioIds,
          showcaseClientIds: clientIds,
        }),
      });
      setData(next);
      setConfig(next.config);
      setServicesText(next.config.services.join("\n"));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  const setTestimonial = (index: number, patch: Partial<Testimonial>) =>
    setConfig((prev) => (prev ? { ...prev, testimonials: prev.testimonials.map((t, i) => (i === index ? { ...t, ...patch } : t)) } : prev));

  return (
    <Card className="space-y-5" id="pagina-publica" data-testid="agency-page-card" data-tour="settings-agency-page">
      <div>
        <SectionTitle>Página pública da agência</SectionTitle>
        <p className="t3 text-text-muted">
          Sua vitrine sem login: serviços, trabalhos, clientes e depoimentos, com um formulário que vira prospect e avisa você na hora.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <Label>Endereço público</Label>
          <div className="flex items-center gap-1">
            <span className="shrink-0 t3 text-text-muted">{origin}/a/</span>
            <Input value={config.slug} onChange={(e) => setConfig({ ...config, slug: e.target.value })} placeholder={normalizeSlug(data.agencyName)} data-testid="page-slug" />
          </div>
        </div>
        <label className="flex items-center gap-2 rounded-md border border-edge bg-surface-sunken px-3 py-2 t3">
          <input type="checkbox" checked={config.published} onChange={(e) => setConfig({ ...config, published: e.target.checked })} className="accent-[var(--accent)]" data-testid="page-published" />
          Publicada
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2 t5 text-text-muted">
        <span className="font-mono" data-testid="page-url">{publicUrl}</span>
        <CopyButton text={publicUrl} label="Copiar link" />
        {config.published && data.config.slug && (
          <a href={`/a/${data.config.slug}`} target="_blank" rel="noreferrer" className="text-text hover:underline" data-testid="page-open">
            Abrir página
          </a>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="md:col-span-2">
          <Label>Frase principal</Label>
          <Input value={config.headline} onChange={(e) => setConfig({ ...config, headline: e.target.value })} placeholder="Ex.: Marketing que vende para negócios de bairro" data-testid="page-headline" />
        </div>
        <div className="md:col-span-2">
          <Label>Quem somos</Label>
          <Textarea value={config.about} onChange={(e) => setConfig({ ...config, about: e.target.value })} placeholder="Dois ou três parágrafos sobre a agência, o jeito de trabalhar e os resultados." data-testid="page-about" />
        </div>
        <div>
          <Label>Serviços (um por linha)</Label>
          <Textarea value={servicesText} onChange={(e) => setServicesText(e.target.value)} placeholder={"Gestão de redes sociais\nTráfego pago\nAtendimento por WhatsApp com IA"} data-testid="page-services" />
        </div>
        <div className="space-y-3">
          <div>
            <Label>Título do bloco de contato</Label>
            <Input value={config.ctaTitle} onChange={(e) => setConfig({ ...config, ctaTitle: e.target.value })} placeholder="Vamos conversar?" />
          </div>
          <div>
            <Label>WhatsApp público (opcional)</Label>
            <Input value={config.whatsapp} onChange={(e) => setConfig({ ...config, whatsapp: e.target.value })} placeholder="5511999999999" />
          </div>
        </div>
      </div>

      <div className="space-y-2 border-t border-edge pt-4">
        <div className="flex items-center justify-between">
          <p className="t6 text-text-muted">Depoimentos</p>
          <button
            type="button"
            className="t5 text-text hover:underline"
            onClick={() => setConfig({ ...config, testimonials: [...config.testimonials, { author: "", role: "", text: "" }] })}
            data-testid="testimonial-add"
          >
            + Adicionar depoimento
          </button>
        </div>
        {config.testimonials.length === 0 && <p className="t5 text-text-muted">Nenhum depoimento ainda — cole o que um cliente disse sobre o trabalho.</p>}
        {config.testimonials.map((t, i) => (
          <div key={i} className="grid gap-2 rounded-md border border-edge bg-surface-sunken p-3 sm:grid-cols-[1fr_1fr_auto]" data-testid="testimonial-row">
            <Input value={t.author} onChange={(e) => setTestimonial(i, { author: e.target.value })} placeholder="Quem disse" data-testid="testimonial-author" />
            <Input value={t.role} onChange={(e) => setTestimonial(i, { role: e.target.value })} placeholder="Cargo / empresa" />
            <button type="button" className="t5 text-text-muted hover:text-negative" onClick={() => setConfig({ ...config, testimonials: config.testimonials.filter((_, j) => j !== i) })}>
              Remover
            </button>
            <div className="sm:col-span-3">
              <Textarea value={t.text} onChange={(e) => setTestimonial(i, { text: e.target.value })} placeholder="O depoimento" data-testid="testimonial-text" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 border-t border-edge pt-4 md:grid-cols-2">
        <div>
          <p className="t6 text-text-muted">Mostrar no portfólio</p>
          <p className="mb-2 t5 text-text-muted">Entregas em imagem. Marque só o que o cliente autorizou divulgar.</p>
          {data.portfolio.length === 0 ? (
            <p className="t5 text-text-muted">Nenhuma entrega em imagem ainda.</p>
          ) : (
            <div className="max-h-56 space-y-1 overflow-y-auto">
              {data.portfolio.map((item) => (
                <label key={item.id} className="flex items-center gap-2 rounded-md border border-edge bg-surface-sunken px-2.5 py-1.5 t3" data-testid="portfolio-option">
                  <input type="checkbox" checked={portfolioIds.includes(item.id)} onChange={() => setPortfolioIds((l) => toggle(l, item.id))} className="accent-[var(--accent)]" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/files/${item.id}`} alt="" className="size-8 rounded object-cover" />
                  <span className="min-w-0 flex-1 truncate">
                    {item.title} <span className="t5 text-text-muted">· {item.clientName}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
        <div>
          <p className="t6 text-text-muted">Clientes na página</p>
          <label className="mb-2 flex items-center gap-2 t5 text-text-muted">
            <input type="checkbox" checked={config.showClients} onChange={(e) => setConfig({ ...config, showClients: e.target.checked })} className="accent-[var(--accent)]" />
            Mostrar a faixa “quem confia na gente”
          </label>
          <p className="mb-2 t5 text-text-muted">Marque apenas quem consentiu em aparecer. O logo vem dos arquivos de identidade visual do cliente; sem logo, mostra o nome.</p>
          <div className="max-h-56 space-y-1 overflow-y-auto">
            {data.clients.map((client) => (
              <label key={client.id} className="flex items-center gap-2 rounded-md border border-edge bg-surface-sunken px-2.5 py-1.5 t3" data-testid="showcase-option">
                <input type="checkbox" checked={clientIds.includes(client.id)} onChange={() => setClientIds((l) => toggle(l, client.id))} className="accent-[var(--accent)]" />
                <span className="min-w-0 flex-1 truncate">{client.name}</span>
                {client.hasLogo && <span className="t6 text-text">logo</span>}
              </label>
            ))}
          </div>
        </div>
      </div>

      {error && <ErrorBox message={error} />}
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving} data-testid="page-save">
          {saving ? "Salvando..." : "Salvar página"}
        </Button>
        {saved && <span className="t3 text-text">Aplicado ✓</span>}
      </div>

      <div className="space-y-2 border-t border-edge pt-4">
        <p className="t6 text-text-muted">Leads recebidos</p>
        {data.leads.length === 0 ? (
          <p className="t5 text-text-muted">Nenhum lead ainda. Compartilhe o link da página nas redes e na bio.</p>
        ) : (
          <div className="space-y-1">
            {data.leads.map((lead) => (
              <div key={lead.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-edge bg-surface-sunken px-3 py-2 t3" data-testid="lead-row">
                <div className="min-w-0">
                  <p className="font-medium">
                    {lead.name} <span className="t5 text-text-muted">· +{lead.whatsapp}</span>
                  </p>
                  <p className="truncate t5 text-text-muted">{lead.need}</p>
                </div>
                <div className="text-right t5 text-text-muted">
                  <p>{BUDGET_BAND_LABELS[lead.budgetBand as BudgetBand]?.[lang === "en" ? "en" : "pt"] ?? lead.budgetBand}</p>
                  <p>{new Date(lead.createdAt).toLocaleDateString(lang === "en" ? "en-US" : "pt-BR")}</p>
                </div>
              </div>
            ))}
            <a href="/prospecting" className="inline-block t5 text-text hover:underline">
              Ver na prospecção
            </a>
          </div>
        )}
      </div>
    </Card>
  );
}
