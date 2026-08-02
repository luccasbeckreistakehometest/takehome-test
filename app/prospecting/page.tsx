"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { PROSPECT_STATUS_LABELS, type Prospect } from "@/lib/marketplace-types";
import { Button, Card, ErrorBox, Input, Label, Spinner, Tag } from "@/components/ui";

export default function ProspectingPage() {
  const [prospects, setProspects] = useState<Prospect[] | null>(null);
  const [form, setForm] = useState({ niche: "", region: "", notes: "" });
  const [searching, setSearching] = useState(false);
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");

  const load = () => api<Prospect[]>("/api/prospects").then(setProspects);
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
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">
          Prospecção de clientes
        </h1>
        <p className="mt-1 text-sm text-muted">
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
        <div className="flex items-center gap-3">
          <Button onClick={discover} disabled={searching || !form.niche || !form.region}>
            {searching ? "Pesquisando..." : "🔎 Descobrir potenciais clientes"}
          </Button>
          {searching && (
            <Spinner label="Varrendo a web em busca de empresas reais do nicho (2-4 min)..." />
          )}
        </div>
        {error && <ErrorBox message={error} />}
        {summary && <p className="text-sm text-muted">{summary}</p>}
      </Card>

      {!prospects ? (
        <Spinner label="Carregando prospects..." />
      ) : prospects.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">
          Nenhum prospect ainda — rode uma busca acima.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {prospects.map((prospect) => (
            <Card key={prospect.id} className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{prospect.name}</p>
                  <p className="text-xs text-muted">
                    {prospect.segment} · {prospect.location}
                  </p>
                </div>
                <Tag>{PROSPECT_STATUS_LABELS[prospect.status]}</Tag>
              </div>
              <p className="text-sm text-muted">
                <span className="font-semibold text-foreground/80">Por que é fit: </span>
                {prospect.whyFit}
              </p>
              <p className="text-sm text-muted">
                <span className="font-semibold text-foreground/80">Maturidade: </span>
                {prospect.marketingMaturity}
              </p>
              <p className="text-sm text-muted">
                <span className="font-semibold text-accent">Abordagem: </span>
                {prospect.suggestedApproach}
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                {prospect.website && (
                  <a
                    href={prospect.website.startsWith("http") ? prospect.website : `https://${prospect.website}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent hover:underline"
                  >
                    site ↗
                  </a>
                )}
                {prospect.instagram && <span className="text-muted">{prospect.instagram}</span>}
                <span className="ml-auto flex gap-2">
                  {prospect.status === "converted" && prospect.clientId ? (
                    <Link href={`/clients/${prospect.clientId}`} className="text-accent hover:underline">
                      Abrir cliente →
                    </Link>
                  ) : (
                    <>
                      {prospect.status === "new" && (
                        <button
                          className="text-muted hover:text-foreground"
                          onClick={() => setStatus(prospect, "contacted")}
                        >
                          Marcar contatado
                        </button>
                      )}
                      <button
                        className="font-medium text-accent hover:underline"
                        onClick={async () => {
                          const result = await setStatus(prospect, "converted");
                          if (result.clientId) {
                            window.location.href = `/clients/${result.clientId}`;
                          }
                        }}
                      >
                        Converter em cliente ✦
                      </button>
                      <button
                        className="text-muted hover:text-red-400"
                        onClick={() => setStatus(prospect, "discarded")}
                      >
                        Descartar
                      </button>
                    </>
                  )}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
