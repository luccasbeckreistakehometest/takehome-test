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

// Tema claro para impressão/PDF — sobrescreve os tokens do tema escuro
const PRINT_THEME: Record<string, string> = {
  "--background": "#ffffff",
  "--surface": "#ffffff",
  "--surface-2": "#f4f5f7",
  "--edge": "#d9dce2",
  "--foreground": "#16181d",
  "--muted": "#4b5058",
  "--accent": "#3f6212",
  "--accent-ink": "#ffffff",
};

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
    return <p className="py-24 text-center text-muted">Documento não encontrado.</p>;
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
          return <pre className="whitespace-pre-wrap text-sm">{generation.content}</pre>;
      }
    } catch {
      return <pre className="whitespace-pre-wrap text-sm">{generation.content}</pre>;
    }
  })();

  return (
    <div style={PRINT_THEME as React.CSSProperties} className="rounded-xl bg-background p-6 text-foreground">
      <button
        onClick={() => window.print()}
        className="fixed bottom-6 right-6 z-50 rounded-full bg-[#3f6212] px-5 py-3 font-medium text-white shadow-lg transition-opacity hover:opacity-90 print:hidden"
      >Salvar como PDF
      </button>
      <div className="mb-6 border-b-2 border-foreground pb-4">
        <p className="text-xs font-bold uppercase tracking-widest text-[#3f6212]">
          {agencyName}
        </p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold">
          {generation.title}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {client.name} · {GENERATION_LABELS[generation.type]} ·{" "}
          {new Date(generation.createdAt).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>
      {content}
    </div>
  );
}
