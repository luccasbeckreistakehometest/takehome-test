"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { Project } from "@/lib/marketplace-types";
import type { DemandSuggestions } from "@/lib/marketplace-schemas";
import type { Client } from "@/lib/types";
import type { Professional } from "@/lib/marketplace-types";
import type { IdeaBatch } from "@/lib/marketplace-db";
import type { IdeasResult } from "@/lib/marketplace-schemas";
import { Button, Card, ErrorBox, Label, SectionTitle, Select, Spinner, Tag } from "@/components/ui";
// (ações por ideia: campanha, demanda com brief da IA, estudo de mercado)

type Audience = "agency" | "client" | "professional";

const AUDIENCE_LABELS: Record<Audience, string> = {
  agency: "Para a agência",
  client: "Para um cliente",
  professional: "Para um profissional",
};

function IdeasContent() {
  const router = useRouter();
  const [creatingDemand, setCreatingDemand] = useState<number | null>(null);
  const [audience, setAudience] = useState<Audience>("agency");
  const [targetId, setTargetId] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [batches, setBatches] = useState<IdeaBatch[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Client[]>("/api/clients").then(setClients);
    api<Professional[]>("/api/professionals").then(setProfessionals);
    const params = new URLSearchParams(window.location.search);
    const qAudience = params.get("audience");
    if (qAudience === "client" || qAudience === "professional" || qAudience === "agency") {
      setAudience(qAudience);
    }
    setTargetId(params.get("targetId") ?? "");
  }, []);

  const effectiveTarget = audience === "agency" ? "" : targetId;

  const loadHistory = useCallback(() => {
    api<IdeaBatch[]>(
      `/api/ideas?audience=${audience}${effectiveTarget ? `&targetId=${effectiveTarget}` : ""}`
    ).then(setBatches);
  }, [audience, effectiveTarget]);

  useEffect(loadHistory, [loadHistory]);

  async function generate() {
    setGenerating(true);
    setError("");
    try {
      await api<IdeaBatch>("/api/ideas", {
        method: "POST",
        body: JSON.stringify({ audience, targetId: effectiveTarget || null }),
      });
      loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gerar ideias");
    } finally {
      setGenerating(false);
    }
  }

  const latest = batches[0];
  const ideas: IdeasResult | null = latest ? (JSON.parse(latest.content) as IdeasResult) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="d3">
          Motor de ideias
        </h1>
        <p className="t3 measure-lede mt-2 text-text-muted">
          Propostas proativas para todas as pontas — agência, clientes e
          profissionais — fundamentadas nas tendências mais recentes do mercado
          (pesquisa real na web) e conectadas a quem já está na plataforma.
        </p>
      </div>

      <Card className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label>Para quem</Label>
            <Select
              value={audience}
              onChange={(e) => {
                setAudience(e.target.value as Audience);
                setTargetId("");
              }}
            >
              {Object.entries(AUDIENCE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          {audience !== "agency" && (
            <div>
              <Label>{audience === "client" ? "Cliente" : "Profissional"}</Label>
              <Select value={targetId} onChange={(e) => setTargetId(e.target.value)}>
                <option value="">Selecione...</option>
                {(audience === "client" ? clients : professionals).map((entity) => (
                  <option key={entity.id} value={entity.id}>
                    {entity.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={generate}
            disabled={generating || (audience !== "agency" && !targetId)}
          >
            {generating ? "Gerando..." : "Gerar ideias com base nas trends de hoje"}
          </Button>
          {generating && (
            <Spinner label="Pesquisando tendências recentes e cruzando com a plataforma (2-4 min)..." />
          )}
        </div>
        {error && <ErrorBox message={error} />}
      </Card>

      {ideas && (
        <div className="space-y-4">
          <Card>
            <SectionTitle>
              Rodada de {new Date(latest.createdAt).toLocaleString("pt-BR")}
            </SectionTitle>
            <p className="t3 text-text-muted">{ideas.summary}</p>
          </Card>
          {ideas.ideas.map((idea, i) => {
            // Resolve o cliente-alvo da ideia para dar ação (ideia → campanha/demanda)
            const targetClient =
              audience === "client"
                ? clients.find((c) => c.id === targetId)
                : clients.find((c) => c.name === idea.linkedTo);
            const focusText = `${idea.title} — ${idea.description}`;
            return (
              <Card key={i} className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold">{idea.title}</p>
                  <div className="flex gap-1.5">
                    {idea.linkedTo && <Tag>↔ {idea.linkedTo}</Tag>}
                    <Tag>{idea.priority}</Tag>
                  </div>
                </div>
                <p className="t3 text-text-muted">{idea.description}</p>
                <p className="t3 text-text-muted">
                  <span className="font-semibold text-text/80">Tendência que sustenta: </span>
                  {idea.trendBasis}
                </p>
                <p className="t3">
                  <span className="font-semibold text-text">Próximo passo: </span>
                  <span className="text-text-muted">{idea.action}</span>
                </p>
                {targetClient && (
                  <div className="flex flex-wrap gap-2 border-t border-edge pt-2">
                    <Button
                      variant="ghost"
                      className="!px-2.5 !py-1 t5"
                      onClick={() =>
                        router.push(
                          `/clients/${targetClient.id}?tab=campaign_plan&focus=${encodeURIComponent(focusText)}`
                        )
                      }
                    >Gerar campanha com esta ideia
                    </Button>
                    <Button
                      variant="ghost"
                      className="!px-2.5 !py-1 t5"
                      disabled={creatingDemand === i}
                      onClick={async () => {
                        setCreatingDemand(i);
                        try {
                          const suggestion = await api<DemandSuggestions>(
                            "/api/projects/suggest",
                            {
                              method: "POST",
                              body: JSON.stringify({
                                clientId: targetClient.id,
                                idea: focusText,
                              }),
                            }
                          );
                          const demand = suggestion.demands[0];
                          if (!demand) return;
                          const project = await api<Project>("/api/projects", {
                            method: "POST",
                            body: JSON.stringify({
                              clientId: targetClient.id,
                              ...demand,
                            }),
                          });
                          router.push(
                            `/clients/${targetClient.id}?project=${project.id}`
                          );
                        } finally {
                          setCreatingDemand(null);
                        }
                      }}
                    >
                      {creatingDemand === i
                        ? "IA escrevendo o brief..."
                        : "Criar demanda desta ideia (IA escreve o brief)"}
                    </Button>
                    <Button
                      variant="ghost"
                      className="!px-2.5 !py-1 t5"
                      onClick={() =>
                        router.push(
                          `/clients/${targetClient.id}?tab=strategy_analysis`
                        )
                      }
                    >Estudo de mercado da conta
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function IdeasPage() {
  return (
    <Suspense>
      <IdeasContent />
    </Suspense>
  );
}
