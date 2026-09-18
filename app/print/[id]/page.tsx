"use client";

import { use, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Client, Generation } from "@/lib/types";
import { GENERATION_LABELS } from "@/lib/types";
import type { AgencySettings } from "@/lib/settings";
import type {
  CampaignPlan,
  MarketPulse,
  PostBatch,
  RoiProjection,
  SocialCalendar,
  StrategyAnalysis,
  VisualIdentity,
} from "@/lib/schemas";
import type { ClientReport } from "@/lib/marketplace-schemas";
import {
  CampaignPlanView,
  ClientReportView,
  MarketPulseView,
  PostBatchView,
  RoiProjectionView,
  SocialCalendarView,
  StrategyAnalysisView,
  VisualIdentityView,
} from "@/components/renderers";
import { Spinner } from "@/components/ui";

// O mapa de hex do tema claro saiu daqui: `.doc` (globals.css §10) já
// redeclara os papéis, então a peça é papel nos dois temas e no papel.

export default function PrintGenerationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [generation, setGeneration] = useState<Generation | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [agencyName, setAgencyName] = useState("");
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    api<AgencySettings>("/api/settings").then((s) => setAgencyName(s.agencyName));
    api<Generation>(`/api/generations/${id}`)
      .then((g) => {
        if (g.type === "landing_page") {
          // Landing page: o próprio HTML é o documento
          window.location.replace(`/api/generations/${g.id}/html`);
          return;
        }
        setGeneration(g);
        api<Client>(`/api/clients/${g.clientId}`).then(setClient);
      })
      .catch(() => setNotFound(true));
  }, [id]);

  if (notFound) {
    return <p className="py-24 text-center text-text-muted">Documento não encontrado.</p>;
  }
  if (!generation || !client) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner label="Preparando documento..." />
      </div>
    );
  }

  const content = (() => {
    try {
      const data = JSON.parse(generation.content);
      switch (generation.type) {
        case "strategy_analysis":
          return <StrategyAnalysisView data={data as StrategyAnalysis} />;
        case "market_pulse":
          return <MarketPulseView data={data as MarketPulse} />;
        case "campaign_plan":
          return <CampaignPlanView data={data as CampaignPlan} />;
        case "roi_projection":
          return <RoiProjectionView data={data as RoiProjection} />;
        case "social_calendar":
          return <SocialCalendarView data={data as SocialCalendar} />;
        case "post_batch":
          return <PostBatchView data={data as PostBatch} />;
        case "visual_identity":
          return <VisualIdentityView data={data as VisualIdentity} />;
        case "client_report":
          return <ClientReportView data={data as ClientReport} />;
        default:
          return <pre className="whitespace-pre-wrap t3">{generation.content}</pre>;
      }
    } catch {
      return <pre className="whitespace-pre-wrap t3">{generation.content}</pre>;
    }
  })();

  return (
    // Mesma anatomia do relatório: capa com régua da marca, mancha de 160mm e
    // folha de impressão de verdade.
    <article className="doc my-8 px-8 py-10 sm:px-12">
      <button
        onClick={() => window.print()}
        className="no-print fixed bottom-6 right-6 z-50 h-10 rounded-sm bg-brand-solid px-4 font-medium text-brand-ink shadow-e1 transition-[filter] hover:brightness-95"
      >
        Salvar como PDF
      </button>
      <header className="doc-cover">
        <div className="doc-rule" />
        <p className="t6 mt-4 text-n-500">{agencyName}</p>
        <h1 className="d2 mt-3" style={{ ["--soft" as string]: 20 }}>
          {generation.title}
        </h1>
        <p className="t1 mt-2 text-n-700">
          {client.name} · {GENERATION_LABELS[generation.type]}
        </p>
        <p className="t5 tnum mt-6 text-n-500">
          {new Date(generation.createdAt).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          })}
        </p>
      </header>
      <div className="mt-10">{content}</div>
    </article>
  );
}
