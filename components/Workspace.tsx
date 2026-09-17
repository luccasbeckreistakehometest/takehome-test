"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
  ProductRecs,
  PostBatch,
  RoiProjection,
  SocialCalendar,
  StrategyAnalysis,
  VisualIdentity,
} from "@/lib/schemas";
import type { ClientReport, DemandSuggestions } from "@/lib/marketplace-schemas";
import type { StrategyActions } from "./renderers";
import type { Project } from "@/lib/marketplace-types";
import type { AgencySettings } from "@/lib/settings";
import BrandAssets from "./BrandAssets";
import ClientDashboard from "./ClientDashboard";
import SalesIntegrations from "./SalesIntegrations";
import ClientForm from "./ClientForm";
import GeneratorTab from "./GeneratorTab";
import LandingPreview from "./LandingPreview";
import ProjectsTab from "./ProjectsTab";
import AttendantTab from "./AttendantTab";
import TimeTab from "./TimeTab";
import BrandVoiceCard from "./BrandVoiceCard";
import CampaignTab from "./CampaignTab";
import { ApprovalLinkCard } from "./ApprovalLinkPanel";
import PackageTab from "./PackageTab";
import { PackageSummaryCard } from "./PackageUsage";
import InvoicesPanel from "./InvoicesPanel";
import CarouselTab from "./CarouselTab";
import BriefingVoiceStart from "./BriefingVoiceStart";
import LinksTab from "./LinksTab";
import ClicksCard from "./ClicksCard";
import { briefingCompleteness, BRIEFING_READY_PCT } from "@/lib/activation-rules";
import {
  CampaignPlanView,
  ClientReportView,
  ProductRecsView,
  MarketPulseView,
  PostBatchView,
  RoiProjectionView,
  SocialCalendarView,
  StrategyAnalysisView,
  VisualIdentityView,
} from "./renderers";
import { Button, Card, ErrorBox, Spinner, Tag } from "./ui";
import { groupOfTab, resolveTab, visibleGroups, type TabKey } from "@/lib/workspace-tabs";

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
  // Deep-links (o workspace só renderiza no navegador, depois do fetch do
  // cliente): ?project=... (portal do profissional), ?tab=... e ?focus=...
  // (fluxo ideias → campanha).
  const [linkParams] = useState(() => new URLSearchParams(typeof window === "undefined" ? "" : window.location.search));
  const [requestedTab, setRequestedTab] = useState<string>(() =>
    linkParams.get("project") ? "projects" : (linkParams.get("tab") ?? "dashboard")
  );
  const [initialProjectId, setInitialProjectId] = useState<string | undefined>(() => linkParams.get("project") ?? undefined);
  const [landingEnabled, setLandingEnabled] = useState(false);
  // A marca autônoma não vê as abas que dependem da operação da agência.
  const [viewerRole, setViewerRole] = useState<string>("agency");
  const [campaignFocus, setCampaignFocus] = useState(() => linkParams.get("focus") ?? "");
  const viewer = { viewerRole, landingEnabled };
  // Aba efetiva: a pedida, se este visitante pode vê-la; senão o Dashboard.
  const tab: TabKey = resolveTab(requestedTab, viewer).tab;
  const groups = visibleGroups(viewer);
  const activeGroup = groupOfTab(tab);
  const setTab = (next: TabKey) => {
    setRequestedTab(next);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", next);
      url.searchParams.delete("project");
      window.history.replaceState(window.history.state, "", url.toString());
    } catch {
      // URL só espelha a aba; falhar aqui não importa
    }
  };
  const [postTopic, setPostTopic] = useState("");

  // Encadeia entregáveis: qualquer análise vira campanha, posts ou demanda
  const flowActions: StrategyActions = {
    onCampaign: (focus) => {
      setCampaignFocus(focus.slice(0, 500));
      setTab("campaign_plan");
    },
    onPosts: (topic) => {
      setPostTopic(topic.slice(0, 300));
      setTab("post_batch");
    },
    onSocial: () => setTab("social_calendar"),
    onDemand: async (ideaText) => {
      const suggestion = await api<DemandSuggestions>("/api/projects/suggest", {
        method: "POST",
        body: JSON.stringify({ clientId: client.id, idea: ideaText.slice(0, 800) }),
      });
      const demand = suggestion.demands[0];
      if (!demand) return;
      const project = await api<Project>("/api/projects", {
        method: "POST",
        body: JSON.stringify({ clientId: client.id, ...demand }),
      });
      setInitialProjectId(project.id);
      setTab("projects");
    },
  };

  useEffect(() => {
    api<AgencySettings & { viewerRole?: string }>("/api/settings").then((settings) => {
      setLandingEnabled(settings.landingPagesEnabled);
      if (settings.viewerRole) setViewerRole(settings.viewerRole);
    });
  }, []);
  // Remonta as abas de geração após o kit completo, para recarregar o histórico
  const [kitVersion, setKitVersion] = useState(0);
  const [kitSteps, setKitSteps] = useState<KitStep[] | null>(null);
  const [kitError, setKitError] = useState("");

  const kitRunning = kitSteps?.some((s) => s.status === "running") ?? false;

  async function runFullKit() {
    setKitError("");
    // Landing page fica fora do kit quando a flag está desligada (custo)
    const sequence = FULL_KIT_SEQUENCE.filter(
      (type) => landingEnabled || type !== "landing_page"
    );
    const steps: KitStep[] = sequence.map((type) => ({
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
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/clients/${client.id}/report`}
            data-testid="open-monthly-report"
            className="inline-flex items-center gap-1.5 rounded-md border border-edge bg-surface-2 px-3.5 py-2 text-sm transition-colors hover:border-accent hover:text-accent"
          >
            📊 Relatório mensal
          </Link>
          <Button onClick={runFullKit} disabled={kitRunning}>
            {kitRunning ? "Gerando kit..." : "✦ Gerar kit completo"}
          </Button>
        </div>
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

      {/* Mobile: dois selects (seção e aba) */}
      <div className="grid grid-cols-2 gap-2 sm:hidden">
        <label htmlFor="workspace-group" className="sr-only">
          Seção do workspace
        </label>
        <select
          id="workspace-group"
          data-testid="workspace-group-select"
          value={activeGroup}
          onChange={(e) => {
            const group = groups.find((g) => g.key === e.target.value);
            if (group) setTab(group.tabs[0].key);
          }}
          className="w-full rounded-md border border-edge bg-surface px-3 py-2 text-sm font-medium"
        >
          {groups.map((g) => (
            <option key={g.key} value={g.key} className="bg-surface text-foreground">
              {g.label}
            </option>
          ))}
        </select>
        <label htmlFor="workspace-tab" className="sr-only">
          Aba do workspace
        </label>
        <select
          id="workspace-tab"
          data-testid="workspace-tab-select"
          value={tab}
          onChange={(e) => setTab(e.target.value as TabKey)}
          className="w-full rounded-md border border-edge bg-surface px-3 py-2 text-sm font-medium text-accent"
        >
          {(groups.find((g) => g.key === activeGroup)?.tabs ?? []).map(({ key, label }) => (
            <option key={key} value={key} className="bg-surface text-foreground">
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Desktop: seções + abas da seção */}
      <div className="hidden space-y-2 sm:block">
        <nav aria-label="Seções do cliente" className="flex flex-wrap gap-1" data-testid="workspace-groups">
          {groups.map((g) => (
            <button
              key={g.key}
              type="button"
              data-group={g.key}
              aria-current={g.key === activeGroup ? "true" : undefined}
              onClick={() => setTab(g.tabs[0].key)}
              className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
                g.key === activeGroup
                  ? "bg-accent font-medium text-accent-ink"
                  : "border border-edge bg-surface-2 text-muted hover:text-foreground"
              }`}
            >
              {g.label}
            </button>
          ))}
        </nav>
        <nav aria-label="Abas da seção" className="flex snap-x gap-1 overflow-x-auto border-b border-edge pb-px" data-testid="workspace-tabs">
          {(groups.find((g) => g.key === activeGroup)?.tabs ?? []).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              data-tab={key}
              aria-current={tab === key ? "page" : undefined}
              onClick={() => setTab(key)}
              className={`snap-start whitespace-nowrap rounded-t-md px-3.5 py-2 text-sm transition-colors ${
                tab === key
                  ? "border border-b-0 border-edge bg-surface font-medium text-accent"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      {tab === "dashboard" && (
        <ClientDashboard
          key={`dash-${kitVersion}`}
          client={client}
          landingEnabled={landingEnabled}
          onNavigate={(next) => setTab(resolveTab(next, viewer).tab)}
          onRunKit={runFullKit}
        >
          {briefingCompleteness(client) < BRIEFING_READY_PCT && (
            <BriefingVoiceStart client={client} onSaved={onClientUpdated} onWrite={() => setTab("briefing")} />
          )}
          <ClicksCard clientId={client.id} onOpen={() => setTab("bio")} />
          {viewerRole !== "client" && (
            <div className="grid gap-4 lg:grid-cols-2">
              <PackageSummaryCard clientId={client.id} onOpen={() => setTab("package")} />
              <ApprovalLinkCard clientId={client.id} clientName={client.name} />
            </div>
          )}
        </ClientDashboard>
      )}

      {tab === "briefing" && (
        <div className="space-y-6">
          {briefingCompleteness(client) < BRIEFING_READY_PCT && (
            <BriefingVoiceStart key={`voice-${client.id}`} client={client} onSaved={onClientUpdated} onWrite={() => document.getElementById("briefing-form")?.scrollIntoView({ behavior: "smooth" })} />
          )}
          <div id="briefing-form" className="scroll-mt-20">
            <ClientForm key={`form-${client.id}-${client.description.length}-${client.audience.length}`} initial={client} onSaved={onClientUpdated} />
          </div>
          <BrandVoiceCard clientId={client.id} />
          <BrandAssets clientId={client.id} />
          {viewerRole === "client" ? (
            <Card>
              <p className="text-sm text-muted">
                Para apagar a sua marca e todos os dados dela, use <Link href="/conta" className="text-accent hover:underline">Minha conta → Excluir minha conta</Link>.
              </p>
            </Card>
          ) : (
            <Card className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted">
                Excluir este cliente remove também todo o histórico de gerações.
              </p>
              <Button variant="danger" onClick={deleteClient}>
                Excluir cliente
              </Button>
            </Card>
          )}
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
          render={(g) => (
            <StrategyAnalysisView
              data={JSON.parse(g.content) as StrategyAnalysis}
              actions={flowActions}
            />
          )}
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
          render={(g) => (
            <MarketPulseView data={JSON.parse(g.content) as MarketPulse} actions={flowActions} />
          )}
        />
      )}

      {tab === "campaign_plan" && (
        <GeneratorTab
          key={`campaign-${kitVersion}-${campaignFocus}`}
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
              defaultValue: campaignFocus,
            },
          ]}
          generateLabel="Gerar plano de campanha"
          render={(g) => (
            <CampaignPlanView data={JSON.parse(g.content) as CampaignPlan} actions={flowActions} />
          )}
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
          render={(g) => (
            <RoiProjectionView
              data={JSON.parse(g.content) as RoiProjection}
              generationId={g.id}
              initialActuals={g.actuals}
              actions={flowActions}
            />
          )}
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
          render={(g) => (
            <SocialCalendarView
              data={JSON.parse(g.content) as SocialCalendar}
              clientId={client.id}
              generationId={g.id}
            />
          )}
        />
      )}

      {tab === "post_batch" && (
        <GeneratorTab
          key={`posts-${kitVersion}-${postTopic}`}
          clientId={client.id}
          type="post_batch"
          description="Variações de post sobre um tema específico, cada uma com um ângulo criativo diferente — pronto para escolher, ajustar e publicar."
          fields={[
            {
              name: "topic",
              label: "Tema do post",
              kind: "text",
              placeholder: "Ex.: promoção de inverno, novo serviço...",
              defaultValue: postTopic,
            },
            {
              name: "channel",
              label: "Canal",
              kind: "select",
              options: ["Instagram", "Facebook", "TikTok", "LinkedIn", "YouTube"],
              defaultValue: "Instagram",
            },
            {
              name: "format",
              label: "Formato",
              kind: "select",
              options: ["Feed", "Stories", "Reels", "Carrossel"],
              defaultValue: "Feed",
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
          render={(g) => (
            <PostBatchView
              data={JSON.parse(g.content) as PostBatch}
              clientId={client.id}
              generationId={g.id}
            />
          )}
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

      {tab === "product_recs" && (
        <GeneratorTab
          key={`offers-${kitVersion}`}
          clientId={client.id}
          type="product_recs"
          description="A IA cruza o que o cliente TEM (recursos e capacidade produtiva do briefing) com as tendências do mercado do país dele e recomenda o que produzir/ofertar — adaptado ao tipo de negócio: produtos fabricáveis para indústria, áreas a enfatizar para serviços, mix para varejo."
          fields={[]}
          generateLabel="Gerar oportunidades"
          loadingHint="Pesquisando tendências e cruzando com a capacidade do cliente (2-3 min)..."
          render={(g) => (
            <ProductRecsView data={JSON.parse(g.content) as ProductRecs} actions={flowActions} />
          )}
        />
      )}

      {tab === "projects" && (
        <ProjectsTab client={client} initialProjectId={initialProjectId} />
      )}

      {tab === "sales" && <SalesIntegrations clientId={client.id} />}

      {tab === "attendant" && <AttendantTab client={client} />}

      {tab === "time" && <TimeTab client={client} />}

      {tab === "package" && <PackageTab clientId={client.id} />}

      {tab === "invoices" && <InvoicesPanel clientId={client.id} />}

      {tab === "carousels" && <CarouselTab client={client} />}

      {tab === "bio" && <LinksTab client={client} />}

      {tab === "campaign30" && <CampaignTab client={client} />}

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
          render={(g) => (
            <ClientReportView data={JSON.parse(g.content) as ClientReport} actions={flowActions} />
          )}
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
