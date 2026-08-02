"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import {
  FULL_KIT_SEQUENCE,
  GENERATION_LABELS,
  type Client,
  type Generation,
  type GenerationType,
} from "@/lib/types";
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
import ClientForm from "./ClientForm";
import GeneratorTab from "./GeneratorTab";
import LandingPreview from "./LandingPreview";
import ProjectsTab from "./ProjectsTab";
import {
  CampaignPlanView,
  ClientReportView,
  MarketPulseView,
  PostBatchView,
  RoiProjectionView,
  SocialCalendarView,
  StrategyAnalysisView,
  VisualIdentityView,
} from "./renderers";
import { Button, Card, ErrorBox, Spinner, Tag } from "./ui";

type TabKey = "briefing" | "projects" | GenerationType;

function nextMonthLabel(): string {
  const date = new Date();
  date.setMonth(date.getMonth() + 1);
  return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

type KitStep = { type: GenerationType; status: "pending" | "running" | "done" | "error" };

export default function Workspace({
  client,
  onClientUpdated,
}: {
  client: Client;
  onClientUpdated: (client: Client) => void;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("briefing");
  const [initialProjectId, setInitialProjectId] = useState<string | undefined>();

  // Deep-link vindo do portal do profissional: /clients/[id]?project=...
  useEffect(() => {
    const projectId = new URLSearchParams(window.location.search).get("project");
    if (projectId) {
      setInitialProjectId(projectId);
      setTab("projects");
    }
  }, []);
  // Remonta as abas de geração após o kit completo, para recarregar o histórico
  const [kitVersion, setKitVersion] = useState(0);
  const [kitSteps, setKitSteps] = useState<KitStep[] | null>(null);
  const [kitError, setKitError] = useState("");

  const kitRunning = kitSteps?.some((s) => s.status === "running") ?? false;

  async function runFullKit() {
    setKitError("");
    const steps: KitStep[] = FULL_KIT_SEQUENCE.map((type) => ({
      type,
      status: "pending",
    }));
    setKitSteps([...steps]);
    for (const step of steps) {
      step.status = "running";
      setKitSteps([...steps]);
      try {
        await api<Generation>("/api/generate", {
          method: "POST",
          body: JSON.stringify({ clientId: client.id, type: step.type, params: {} }),
        });
        step.status = "done";
      } catch (err) {
        step.status = "error";
        setKitSteps([...steps]);
        setKitError(
          `Falha em "${GENERATION_LABELS[step.type]}": ${
            err instanceof Error ? err.message : "erro"
          }. Os itens concluídos foram salvos.`
        );
        break;
      }
      setKitSteps([...steps]);
    }
    setKitVersion((v) => v + 1);
  }

  async function deleteClient() {
    if (!confirm(`Excluir o cliente "${client.name}" e todas as gerações?`)) return;
    await api(`/api/clients/${client.id}`, { method: "DELETE" });
    router.push("/");
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: "briefing", label: "Briefing" },
    { key: "strategy_analysis", label: "Estratégia" },
    { key: "market_pulse", label: "Radar" },
    { key: "campaign_plan", label: "Campanha" },
    { key: "roi_projection", label: "ROI & Roadmap" },
    { key: "social_calendar", label: "Social" },
    { key: "post_batch", label: "Posts" },
    { key: "visual_identity", label: "Identidade" },
    { key: "landing_page", label: "Landing pages" },
    { key: "projects", label: "Demandas" },
    { key: "client_report", label: "Relatório" },
  ];

  const monthDefault = nextMonthLabel();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">
            {client.name}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {client.industry && <Tag>{client.industry}</Tag>}
            <Tag>{client.language === "en" ? "English" : "Português"}</Tag>
            {client.channels.map((channel) => (
              <Tag key={channel}>{channel}</Tag>
            ))}
          </div>
        </div>
        <Button onClick={runFullKit} disabled={kitRunning}>
          {kitRunning ? "Gerando kit..." : "✦ Gerar kit completo"}
        </Button>
      </div>

      {kitSteps && (
        <Card>
          <p className="mb-3 text-sm text-muted">
            Kit completo: a partir do briefing, a plataforma gera estratégia, campanha,
            ROI, identidade, social e landing page em sequência — cada etapa aproveita a
            anterior.
          </p>
          <div className="flex flex-wrap gap-2">
            {kitSteps.map((step) => (
              <span
                key={step.type}
                className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs ${
                  step.status === "done"
                    ? "border-accent/50 bg-accent/10 text-accent"
                    : step.status === "running"
                      ? "border-edge bg-surface-2 text-foreground"
                      : step.status === "error"
                        ? "border-red-900/60 bg-red-950/40 text-red-300"
                        : "border-edge bg-surface-2 text-muted"
                }`}
              >
                {step.status === "done" && "✓"}
                {step.status === "running" && (
                  <span className="size-3 animate-spin rounded-full border-2 border-edge border-t-accent" />
                )}
                {step.status === "error" && "✕"}
                {GENERATION_LABELS[step.type]}
              </span>
            ))}
          </div>
          {kitRunning && (
            <p className="mt-3">
              <Spinner label="Isso leva alguns minutos — a IA pesquisa, planeja e produz cada entregável." />
            </p>
          )}
          {kitError && (
            <div className="mt-3">
              <ErrorBox message={kitError} />
            </div>
          )}
        </Card>
      )}

      <nav className="flex gap-1 overflow-x-auto border-b border-edge pb-px">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`whitespace-nowrap rounded-t-md px-3.5 py-2 text-sm transition-colors ${
              tab === key
                ? "border border-b-0 border-edge bg-surface font-medium text-accent"
                : "text-muted hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "briefing" && (
        <div className="space-y-6">
          <ClientForm initial={client} onSaved={onClientUpdated} />
          <Card className="flex items-center justify-between">
            <p className="text-sm text-muted">
              Excluir este cliente remove também todo o histórico de gerações.
            </p>
            <Button variant="danger" onClick={deleteClient}>
              Excluir cliente
            </Button>
          </Card>
        </div>
      )}

      {tab === "strategy_analysis" && (
        <GeneratorTab
          key={`strategy-${kitVersion}`}
          clientId={client.id}
          type="strategy_analysis"
          description="Deep dive estratégico com pesquisa real na web: tendências atuais do segmento, personas de target buyers, análise de concorrentes, apostas priorizadas e metas SMART. Os demais entregáveis usam a versão mais recente desta análise como base."
          fields={[
            {
              name: "focus",
              label: "Foco especial (opcional)",
              kind: "text",
              placeholder: "Ex.: expansão para o interior, lançamento de delivery...",
            },
          ]}
          generateLabel="Gerar análise estratégica"
          loadingHint="Pesquisando o mercado na web e montando a análise (2-4 min)..."
          render={(g) => <StrategyAnalysisView data={JSON.parse(g.content) as StrategyAnalysis} />}
        />
      )}

      {tab === "market_pulse" && (
        <GeneratorTab
          key={`pulse-${kitVersion}`}
          clientId={client.id}
          type="market_pulse"
          description="Radar recorrente da conta: pesquisa na web o que mudou nos últimos dias no mercado do cliente (notícias, concorrentes, plataformas, trends) e recomenda ajustes na estratégia vigente, com nível de urgência. Rode diariamente ou sempre que precisar de um pulso atualizado."
          fields={[]}
          generateLabel="Rodar radar agora"
          loadingHint="Varrendo notícias e tendências recentes (2-3 min)..."
          render={(g) => <MarketPulseView data={JSON.parse(g.content) as MarketPulse} />}
        />
      )}

      {tab === "campaign_plan" && (
        <GeneratorTab
          key={`campaign-${kitVersion}`}
          clientId={client.id}
          type="campaign_plan"
          description="Plano de campanha mensal completo: tema criativo, objetivos com KPIs, cronograma semana a semana, estratégia por canal e distribuição de verba."
          fields={[
            {
              name: "month",
              label: "Mês da campanha",
              kind: "text",
              defaultValue: monthDefault,
            },
            {
              name: "focus",
              label: "Foco especial (opcional)",
              kind: "text",
              placeholder: "Ex.: Black Friday, lançamento de produto...",
            },
          ]}
          generateLabel="Gerar plano de campanha"
          render={(g) => <CampaignPlanView data={JSON.parse(g.content) as CampaignPlan} />}
        />
      )}

      {tab === "roi_projection" && (
        <GeneratorTab
          key={`roi-${kitVersion}`}
          clientId={client.id}
          type="roi_projection"
          description="Projeção de ROI com premissas explícitas: investimento detalhado, métricas antes → depois, cálculo de retorno e payback, e roadmap por fases para apresentar ao cliente."
          fields={[
            {
              name: "timeframe",
              label: "Horizonte",
              kind: "select",
              options: ["3 meses", "6 meses", "12 meses"],
              defaultValue: "6 meses",
            },
            {
              name: "baseline",
              label: "Métricas atuais (opcional)",
              kind: "text",
              placeholder: "Ex.: 40 leads/mês, conversão 2%, ticket R$ 300",
            },
          ]}
          generateLabel="Gerar ROI & roadmap"
          render={(g) => <RoiProjectionView data={JSON.parse(g.content) as RoiProjection} />}
        />
      )}

      {tab === "social_calendar" && (
        <GeneratorTab
          key={`social-${kitVersion}`}
          clientId={client.id}
          type="social_calendar"
          description="Calendário de conteúdo do mês com legendas prontas para publicar, hashtags, direção de arte para o designer e CTA — distribuído entre os canais ativos do cliente."
          fields={[
            {
              name: "month",
              label: "Mês",
              kind: "text",
              defaultValue: monthDefault,
            },
            {
              name: "postsPerWeek",
              label: "Posts por semana",
              kind: "select",
              options: ["2", "3", "4", "5"],
              defaultValue: "3",
            },
          ]}
          generateLabel="Gerar calendário"
          render={(g) => <SocialCalendarView data={JSON.parse(g.content) as SocialCalendar} />}
        />
      )}

      {tab === "post_batch" && (
        <GeneratorTab
          key={`posts-${kitVersion}`}
          clientId={client.id}
          type="post_batch"
          description="Variações de post sobre um tema específico, cada uma com um ângulo criativo diferente — pronto para escolher, ajustar e publicar."
          fields={[
            {
              name: "topic",
              label: "Tema do post",
              kind: "text",
              placeholder: "Ex.: promoção de inverno, novo serviço...",
            },
            {
              name: "channel",
              label: "Canal",
              kind: "select",
              options: ["Instagram", "Facebook", "TikTok", "LinkedIn", "YouTube"],
              defaultValue: "Instagram",
            },
            {
              name: "quantity",
              label: "Variações",
              kind: "select",
              options: ["3", "5", "8"],
              defaultValue: "3",
            },
          ]}
          generateLabel="Gerar posts"
          render={(g) => <PostBatchView data={JSON.parse(g.content) as PostBatch} />}
        />
      )}

      {tab === "visual_identity" && (
        <GeneratorTab
          key={`identity-${kitVersion}`}
          clientId={client.id}
          type="visual_identity"
          description="Proposta de identidade visual e verbal: essência da marca, slogans, conceitos de logo em SVG, paleta com hex, tipografia e guia de tom de voz."
          fields={[
            {
              name: "direction",
              label: "Direcionamento (opcional)",
              kind: "text",
              placeholder: "Ex.: minimalista e premium, vibrante e jovem...",
            },
          ]}
          generateLabel="Gerar identidade"
          render={(g) => <VisualIdentityView data={JSON.parse(g.content) as VisualIdentity} />}
        />
      )}

      {tab === "projects" && (
        <ProjectsTab client={client} initialProjectId={initialProjectId} />
      )}

      {tab === "client_report" && (
        <GeneratorTab
          key={`report-${kitVersion}`}
          clientId={client.id}
          type="client_report"
          description="Relatório executivo automatizado: a IA consolida os dados reais da conta (entregáveis gerados, demandas com profissionais, notas de qualidade, reuniões) em um relatório pronto para enviar — na visão certa para cada público."
          fields={[
            {
              name: "period",
              label: "Período",
              kind: "text",
              defaultValue: "o último mês",
            },
            {
              name: "audienceRole",
              label: "Público do relatório",
              kind: "select",
              options: ["agency", "client", "professional"],
              defaultValue: "client",
            },
          ]}
          generateLabel="Gerar relatório"
          render={(g) => <ClientReportView data={JSON.parse(g.content) as ClientReport} />}
        />
      )}

      {tab === "landing_page" && (
        <GeneratorTab
          key={`landing-${kitVersion}`}
          clientId={client.id}
          type="landing_page"
          description="Landing page responsiva completa (HTML único, mobile-first, com formulário e SEO), pronta para preview, download e publicação."
          fields={[
            {
              name: "objective",
              label: "Objetivo",
              kind: "select",
              options: [
                "gerar leads",
                "vender um produto",
                "divulgar um evento",
                "capturar inscrições",
              ],
              defaultValue: "gerar leads",
            },
            {
              name: "offer",
              label: "Oferta / produto em destaque",
              kind: "text",
              placeholder: "Ex.: consultoria gratuita, curso online...",
            },
            {
              name: "cta",
              label: "CTA principal",
              kind: "text",
              placeholder: "Ex.: Quero minha avaliação gratuita",
            },
            {
              name: "style",
              label: "Direção visual (opcional)",
              kind: "text",
              placeholder: "Ex.: escuro e sofisticado, clean e colorido...",
            },
          ]}
          generateLabel="Gerar landing page"
          loadingHint="Escrevendo e montando a página (2-4 min)..."
          render={(g) => <LandingPreview generation={g} />}
        />
      )}
    </div>
  );
}
