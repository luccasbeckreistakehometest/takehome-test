"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { PROSPECT_STATUS_LABELS, type Prospect } from "@/lib/marketplace-types";
import { Button, Card, ErrorBox, Input, Label, Spinner, Tag } from "@/components/ui";
import ProposalPanel from "@/components/ProposalPanel";

export default function ProspectingPage() {
  const [prospects, setProspects] = useState<Prospect[] | null>(null);
  const [lastSearch, setLastSearch] = useState<{
    query: string;
    summary: string;
    resultCount: number;
    createdAt: string;
  } | null>(null);
  const [form, setForm] = useState({ niche: "", region: "", notes: "" });
  const [searching, setSearching] = useState(false);
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");
  const [proposalFor, setProposalFor] = useState<string | null>(null);
  const [manual, setManual] = useState({ name: "", segment: "", location: "", website: "", instagram: "", notes: "" });
  const [manualOpen, setManualOpen] = useState(false);
  const [manualSaving, setManualSaving] = useState(false);

  async function addManual() {
    if (!manual.name.trim()) return;
    setManualSaving(true);
    setError("");
    try {
      await api("/api/prospects/manual", { method: "POST", body: JSON.stringify(manual) });
      setManual({ name: "", segment: "", location: "", website: "", instagram: "", notes: "" });
      setManualOpen(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao adicionar");
    } finally {
      setManualSaving(false);
    }
  }

  const load = () =>
    api<{ prospects: Prospect[]; lastSearch: typeof lastSearch }>("/api/prospects").then(
      (data) => {
        setProspects(data.prospects);
        setLastSearch(data.lastSearch);
      }
    );
  useEffect(() => {
    load();
    const handler = () => load();
    window.addEventListener("jobs:changed", handler);
    return () => window.removeEventListener("jobs:changed", handler);
  }, []);

  async function discover() {
    setSearching(true);
    setError("");
    setSummary("");
    try {
      const result = await api<{ summary: string; prospects: Prospect[] }>(
        "/api/prospects",
        { method: "POST", body: JSON.stringify(form) }
      );
      setSummary(result.summary);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro na prospecção");
    } finally {
      setSearching(false);
    }
  }

  async function setStatus(prospect: Prospect, status: Prospect["status"]) {
    const result = await api<{ prospect: Prospect; clientId: string | null }>(
      `/api/prospects/${prospect.id}`,
      { method: "PATCH", body: JSON.stringify({ status }) }
    );
    load();
    return result;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="d3">
          Prospecção de clientes
        </h1>
        <p className="t3 measure-lede mt-2 text-text-muted">
          A IA pesquisa na web negócios reais do nicho/região e qualifica cada
          lead — mesmo quem ainda não está na plataforma. Converta em cliente com
          um clique.
        </p>
      </div>

      <Card className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label>Nicho *</Label>
            <Input
              value={form.niche}
              onChange={(e) => setForm((f) => ({ ...f, niche: e.target.value }))}
              placeholder="Ex.: clínicas odontológicas"
            />
          </div>
          <div>
            <Label>Região *</Label>
            <Input
              value={form.region}
              onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
              placeholder="Ex.: Curitiba e região"
            />
          </div>
          <div>
            <Label>Critérios extras (opcional)</Label>
            <Input
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Ex.: porte médio, sem agência atual"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={discover} disabled={searching || !form.niche || !form.region}>
            {searching ? "Pesquisando..." : "Descobrir potenciais clientes"}
          </Button>
          <button
            onClick={() => setManualOpen((v) => !v)}
            className="t3 text-text-muted underline-offset-2 hover:text-text hover:underline"
            data-testid="manual-prospect-toggle"
          >
            + Adicionar um prospect à mão
          </button>
          {searching && (
            <Spinner label="Varrendo a web em busca de empresas reais do nicho (2-4 min)..." />
          )}
        </div>
        {manualOpen && (
          <div className="grid gap-2 rounded-lg border border-edge bg-surface-sunken p-3 sm:grid-cols-3" data-testid="manual-prospect-form">
            <Input value={manual.name} onChange={(e) => setManual((m) => ({ ...m, name: e.target.value }))} placeholder="Nome do negócio *" data-testid="manual-name" />
            <Input value={manual.segment} onChange={(e) => setManual((m) => ({ ...m, segment: e.target.value }))} placeholder="Segmento" data-testid="manual-segment" />
            <Input value={manual.location} onChange={(e) => setManual((m) => ({ ...m, location: e.target.value }))} placeholder="Cidade" />
            <Input value={manual.website} onChange={(e) => setManual((m) => ({ ...m, website: e.target.value }))} placeholder="Site" />
            <Input value={manual.instagram} onChange={(e) => setManual((m) => ({ ...m, instagram: e.target.value }))} placeholder="@instagram" />
            <Input value={manual.notes} onChange={(e) => setManual((m) => ({ ...m, notes: e.target.value }))} placeholder="Por que é um bom fit" />
            <div className="sm:col-span-3">
              <Button onClick={addManual} disabled={manualSaving || !manual.name.trim()} data-testid="manual-save">
                {manualSaving ? "Salvando..." : "Adicionar prospect"}
              </Button>
            </div>
          </div>
        )}
        {error && <ErrorBox message={error} />}
        {summary && <p className="t3 text-text-muted">{summary}</p>}
        {!summary && lastSearch && (
          <div
            className={`rounded-md border p-3 t3 ${
              lastSearch.resultCount === 0
                ? "border-caution/60 bg-caution-wash"
                : "border-edge bg-surface-sunken"
            }`}
          >
            <p className="t6 text-text-muted">
              Última busca: {lastSearch.query} ·{" "}
              {new Date(lastSearch.createdAt).toLocaleString("pt-BR")} ·{" "}
              {lastSearch.resultCount} resultado(s)
            </p>
            <p className="mt-1 text-text-muted">{lastSearch.summary}</p>
          </div>
        )}
      </Card>

      {!prospects ? (
        <Spinner label="Carregando prospects..." />
      ) : prospects.length === 0 ? (
        <p className="py-8 text-center t3 text-text-muted">
          Nenhum prospect ainda — rode uma busca acima.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {prospects.map((prospect) => (
            <Card key={prospect.id} className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{prospect.name}</p>
                  <p className="t5 text-text-muted">
                    {prospect.segment} · {prospect.location}
                  </p>
                </div>
                <span className="flex flex-wrap justify-end gap-1">
                  {prospect.searchQuery === "pagina-publica" && <Tag>Lead da página pública</Tag>}
                  <Tag>{PROSPECT_STATUS_LABELS[prospect.status]}</Tag>
                </span>
              </div>
              <p className="t3 text-text-muted">
                <span className="font-semibold text-text/80">Por que é fit: </span>
                {prospect.whyFit}
              </p>
              <p className="t3 text-text-muted">
                <span className="font-semibold text-text/80">Maturidade: </span>
                {prospect.marketingMaturity}
              </p>
              <p className="t3 text-text-muted">
                <span className="font-semibold text-text">Abordagem: </span>
                {prospect.suggestedApproach}
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1 t5">
                {prospect.website && (
                  <a
                    href={prospect.website.startsWith("http") ? prospect.website : `https://${prospect.website}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-text hover:underline"
                  >
                    site
                  </a>
                )}
                {prospect.instagram && <span className="text-text-muted">{prospect.instagram}</span>}
                <span className="ml-auto flex gap-2">
                  {prospect.status === "converted" && prospect.clientId ? (
                    <Link href={`/clients/${prospect.clientId}`} className="text-text hover:underline">
                      Abrir cliente
                    </Link>
                  ) : (
                    <>
                      <button
                        className="font-medium text-text hover:underline"
                        onClick={() => setProposalFor((v) => (v === prospect.id ? null : prospect.id))}
                        data-testid="proposal-toggle"
                      >Proposta em 5 min
                      </button>
                      {prospect.status === "new" && (
                        <button
                          className="text-text-muted hover:text-text"
                          onClick={() => setStatus(prospect, "contacted")}
                        >
                          Marcar contatado
                        </button>
                      )}
                      <button
                        className="font-medium text-text hover:underline"
                        onClick={async () => {
                          const result = await setStatus(prospect, "converted");
                          if (result.clientId) {
                            window.location.href = `/clients/${result.clientId}`;
                          }
                        }}
                      >
                        Converter em cliente </button>
                      <button
                        className="text-text-muted hover:text-negative"
                        onClick={() => setStatus(prospect, "discarded")}
                      >
                        Descartar
                      </button>
                    </>
                  )}
                </span>
              </div>
              {proposalFor === prospect.id && <ProposalPanel prospectId={prospect.id} onAccepted={load} />}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
