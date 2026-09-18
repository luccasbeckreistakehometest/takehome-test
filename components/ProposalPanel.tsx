"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useUiLang } from "@/lib/i18n";
import type { Proposal } from "@/lib/proposals-db";
import type { ProposalState } from "@/lib/proposal-rules";
import { Button, CopyButton, ErrorBox, Label, Select, Spinner, Tag, Textarea } from "./ui";

type Listed = Proposal & { state: ProposalState };

const STATE_LABEL: Record<ProposalState, string> = { open: "Aberta", accepted: "Aceita", expired: "Expirada" };
const STATUS_LABEL: Record<string, string> = { sent: "Enviada", viewed: "Vista pelo prospect", accepted: "Aceita", expired: "Expirada" };

// Painel por prospect: gera a proposta pública em 1 clique e lista as já
// enviadas com estado (aberta / vista / aceita / expirada) e link para copiar.
export default function ProposalPanel({ prospectId, onAccepted }: { prospectId: string; onAccepted?: () => void }) {
  const lang = useUiLang();
  const [proposals, setProposals] = useState<Listed[] | null>(null);
  const [services, setServices] = useState("");
  const [days, setDays] = useState("14");
  const [proposalLang, setProposalLang] = useState<"pt-BR" | "en">("pt-BR");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [origin, setOrigin] = useState("");

  const load = useCallback(() => {
    api<{ proposals: Listed[] }>(`/api/prospects/${prospectId}/proposal`).then((r) => setProposals(r.proposals)).catch(() => setProposals([]));
  }, [prospectId]);

  useEffect(() => {
    load();
    setTimeout(() => setOrigin(window.location.origin), 0);
  }, [load]);

  async function generate() {
    setGenerating(true);
    setError("");
    try {
      await api(`/api/prospects/${prospectId}/proposal`, {
        method: "POST",
        body: JSON.stringify({ services, expiresInDays: Number(days), lang: proposalLang }),
      });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao gerar a proposta");
    } finally {
      setGenerating(false);
    }
  }

  const fmt = (iso: string) => new Date(iso).toLocaleDateString(lang === "en" ? "en-US" : "pt-BR", { day: "2-digit", month: "short" });

  return (
    <div className="space-y-3 rounded-lg border border-accent/30 bg-accent/5 p-3" data-testid="proposal-panel">
      <div>
        <Label>Sua oferta e preços (opcional — a IA usa exatamente o que você escrever)</Label>
        <Textarea
          value={services}
          onChange={(e) => setServices(e.target.value)}
          placeholder="Ex.: gestão de Instagram R$ 1.500/mês; tráfego pago a partir de R$ 2.000/mês; ensaio de fotos R$ 900"
          data-testid="proposal-services"
        />
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <Label>Validade</Label>
          <Select value={days} onChange={(e) => setDays(e.target.value)}>
            <option value="7">7 dias</option>
            <option value="14">14 dias</option>
            <option value="30">30 dias</option>
          </Select>
        </div>
        <div>
          <Label>Idioma</Label>
          <Select value={proposalLang} onChange={(e) => setProposalLang(e.target.value as "pt-BR" | "en")}>
            <option value="pt-BR">Português</option>
            <option value="en">English</option>
          </Select>
        </div>
        <Button onClick={generate} disabled={generating} data-testid="proposal-generate">
          {generating ? "Escrevendo a proposta..." : "Gerar proposta pública"}
        </Button>
      </div>
      {generating && <Spinner label="A IA está montando a página: pitch, escopo, pacotes e cronograma (~1 min)..." />}
      {error && <ErrorBox message={error} />}
      {proposals === null ? null : proposals.length === 0 ? (
        <p className="text-xs text-muted">Nenhuma proposta enviada ainda.</p>
      ) : (
        <div className="space-y-1.5">
          {proposals.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-edge bg-surface px-3 py-2 text-sm" data-testid="proposal-row" data-state={p.state}>
              <div className="min-w-0">
                <p className="truncate font-medium">{p.content.headline}</p>
                <p className="text-xs text-muted">
                  <span>{fmt(p.createdAt)}</span> · <span>{STATUS_LABEL[p.status] ?? p.status}</span>
                  {p.acceptedPackage && (
                    <>
                      {" "}
                      · <span>pacote</span> {p.acceptedPackage}
                    </>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <Tag>{STATE_LABEL[p.state]}</Tag>
                <a href={`/proposta/${p.token}`} target="_blank" rel="noreferrer" className="rounded border border-edge bg-surface-2 px-2 py-0.5 text-xs text-muted hover:border-accent hover:text-accent" data-testid="proposal-open">
                  Abrir ↗
                </a>
                <CopyButton text={`${origin}/proposta/${p.token}`} label="Copiar link" />
                {p.state === "accepted" && p.clientId && (
                  <a href={`/clients/${p.clientId}`} className="text-xs text-accent hover:underline" onClick={onAccepted}>
                    Abrir cliente →
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
