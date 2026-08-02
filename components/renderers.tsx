"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { Project } from "@/lib/marketplace-types";
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
import { Card, CopyButton, SectionTitle, Tag } from "./ui";

function Item({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-edge bg-surface-2 p-4">
      <p className="mb-1 text-sm font-semibold">{title}</p>
      <div className="text-sm text-muted">{children}</div>
    </div>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1 pl-5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

// Converte um post gerado por IA em demanda de produção para um profissional
function CreateDemandButton({
  clientId,
  title,
  brief,
  skillsNeeded,
}: {
  clientId: string;
  title: string;
  brief: string;
  skillsNeeded: string[];
}) {
  const [state, setState] = useState<"idle" | "creating" | "done">("idle");
  if (state === "done") {
    return <span className="text-xs text-accent">✓ Demanda criada (aba Demandas)</span>;
  }
  return (
    <button
      disabled={state === "creating"}
      onClick={async () => {
        setState("creating");
        try {
          await api<Project>("/api/projects", {
            method: "POST",
            body: JSON.stringify({
              clientId,
              title,
              brief,
              skillsNeeded,
              location: "",
              budget: "",
              deadline: "",
            }),
          });
          setState("done");
        } catch {
          setState("idle");
        }
      }}
      className="rounded border border-edge bg-surface-2 px-2 py-0.5 text-xs text-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
    >
      {state === "creating" ? "Criando..." : "→ Criar demanda de produção"}
    </button>
  );
}

function postSkills(format: string, channel: string): string[] {
  const text = `${format} ${channel}`.toLowerCase();
  if (/foto|photo/.test(text)) return ["Fotografia de produto"];
  if (/reel|v[íi]deo|video|stories|tiktok/.test(text)) return ["Vídeo/Reels", "Edição/Retoque"];
  return ["Social media design"];
}

// Ações que encadeiam os entregáveis: análise → campanha → posts → demanda
export type StrategyActions = {
  onCampaign: (focus: string) => void;
  onDemand: (idea: string) => Promise<void>;
  onPosts: (topic: string) => void;
  onSocial?: () => void;
};

function ActionButton({
  label,
  onClick,
  busyLabel,
}: {
  label: string;
  onClick: () => void | Promise<void>;
  busyLabel?: string;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await onClick();
        } finally {
          setBusy(false);
        }
      }}
      className="rounded border border-edge bg-background px-2 py-1 text-xs text-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
    >
      {busy ? (busyLabel ?? "...") : label}
    </button>
  );
}

export function StrategyAnalysisView({
  data,
  actions,
}: {
  data: StrategyAnalysis;
  actions?: StrategyActions;
}) {
  const [creatingDemand, setCreatingDemand] = useState<number | null>(null);
  return (
    <div className="space-y-6">
      <Card>
        <SectionTitle>Sumário executivo</SectionTitle>
        <p className="text-sm leading-relaxed text-muted">{data.executiveSummary}</p>
      </Card>
      <Card>
        <SectionTitle>Tendências de mercado (pesquisa real)</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          {data.marketTrends.map((t, i) => (
            <Item key={i} title={t.trend}>
              <p>{t.implication}</p>
              <p className="mt-2 text-xs opacity-70">Fonte: {t.source}</p>
            </Item>
          ))}
        </div>
      </Card>
      <Card>
        <SectionTitle>Target buyers — deep dive</SectionTitle>
        <div className="grid gap-3 lg:grid-cols-2">
          {data.targetBuyers.map((b, i) => (
            <div key={i} className="rounded-lg border border-edge bg-surface-2 p-4">
              <p className="font-semibold">{b.persona}</p>
              <p className="mt-1 text-sm text-muted">{b.profile}</p>
              <div className="mt-3 grid gap-3 text-sm text-muted sm:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase text-foreground/70">Dores</p>
                  <List items={b.pains} />
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase text-foreground/70">Desejos</p>
                  <List items={b.desires} />
                </div>
              </div>
              <p className="mt-3 text-sm text-muted">
                <span className="font-semibold text-foreground/80">Gatilhos: </span>
                {b.buyingTriggers}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {b.channels.map((c, j) => (
                  <Tag key={j}>{c}</Tag>
                ))}
              </div>
              {actions && (
                <button
                  onClick={() =>
                    actions.onPosts(`conteúdo para a persona "${b.persona}": ${b.profile}`)
                  }
                  className="mt-2 rounded border border-edge bg-background px-2 py-1 text-xs text-muted transition-colors hover:border-accent hover:text-accent"
                >
                  ✍️ Gerar posts para esta persona
                </button>
              )}
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <SectionTitle>Concorrentes</SectionTitle>
        <div className="grid gap-3 lg:grid-cols-2">
          {data.competitors.map((c, i) => (
            <div key={i} className="rounded-lg border border-edge bg-surface-2 p-4 text-sm">
              <p className="font-semibold">{c.name}</p>
              <p className="mt-1 text-muted">{c.positioning}</p>
              <div className="mt-3 grid gap-3 text-muted sm:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase text-emerald-400/80">Forças</p>
                  <List items={c.strengths} />
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase text-red-400/80">Fraquezas</p>
                  <List items={c.weaknesses} />
                </div>
              </div>
              <p className="mt-3 text-muted">
                <span className="font-semibold text-accent">Oportunidade: </span>
                {c.opportunity}
              </p>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <SectionTitle>Best fits — onde apostar agora</SectionTitle>
        <div className="space-y-2">
          {data.bestFits.map((f, i) => (
            <div key={i} className="flex items-start gap-3 rounded-lg border border-edge bg-surface-2 p-3 text-sm">
              <Tag>{f.priority}</Tag>
              <div className="flex-1">
                <p className="font-medium">{f.recommendation}</p>
                <p className="text-muted">{f.why}</p>
                {actions && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      onClick={() => actions.onCampaign(`${f.recommendation} — ${f.why}`)}
                      className="rounded border border-edge bg-background px-2 py-1 text-xs text-muted transition-colors hover:border-accent hover:text-accent"
                    >
                      🎯 Gerar campanha desta aposta
                    </button>
                    <button
                      disabled={creatingDemand === i}
                      onClick={async () => {
                        setCreatingDemand(i);
                        try {
                          await actions.onDemand(`${f.recommendation} — ${f.why}`);
                        } finally {
                          setCreatingDemand(null);
                        }
                      }}
                      className="rounded border border-edge bg-background px-2 py-1 text-xs text-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
                    >
                      {creatingDemand === i
                        ? "IA escrevendo o brief..."
                        : "📋 Criar demanda desta aposta"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <SectionTitle>Metas</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-muted">
              <tr>
                <th className="py-2 pr-4">Meta</th>
                <th className="py-2 pr-4">Métrica</th>
                <th className="py-2 pr-4">Alvo</th>
                <th className="py-2">Prazo</th>
              </tr>
            </thead>
            <tbody>
              {data.goals.map((g, i) => (
                <tr key={i} className="border-t border-edge">
                  <td className="py-2 pr-4">{g.goal}</td>
                  <td className="py-2 pr-4 text-muted">{g.metric}</td>
                  <td className="py-2 pr-4 font-medium text-accent">{g.target}</td>
                  <td className="py-2 text-muted">{g.deadline}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export function MarketPulseView({
  data,
  actions,
}: {
  data: MarketPulse;
  actions?: StrategyActions;
}) {
  return (
    <div className="space-y-6">
      <Card>
        <SectionTitle>Momento do mercado</SectionTitle>
        <p className="text-sm leading-relaxed text-muted">{data.summary}</p>
      </Card>
      <Card>
        <SectionTitle>Destaques recentes</SectionTitle>
        <div className="space-y-2">
          {data.headlines.map((h, i) => (
            <Item key={i} title={h.headline}>
              <p>{h.whatChanged}</p>
              <p className="mt-1">
                <span className="text-accent">Por que importa: </span>
                {h.relevance}
              </p>
              <p className="mt-2 text-xs opacity-70">Fonte: {h.source}</p>
            </Item>
          ))}
        </div>
      </Card>
      <Card>
        <SectionTitle>Mudanças de tendência</SectionTitle>
        <div className="space-y-2">
          {data.trendShifts.map((t, i) => (
            <div key={i} className="flex items-start gap-3 rounded-lg border border-edge bg-surface-2 p-3 text-sm">
              <Tag>{t.direction}</Tag>
              <div>
                <p className="font-medium">{t.trend}</p>
                <p className="text-muted">{t.action}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <SectionTitle>Ajustes recomendados</SectionTitle>
        <div className="space-y-2">
          {data.recommendations.map((r, i) => (
            <div key={i} className="flex items-start gap-3 rounded-lg border border-edge bg-surface-2 p-3 text-sm">
              <Tag>{r.urgency}</Tag>
              <div className="flex-1">
                <p className="font-medium">{r.recommendation}</p>
                <p className="text-muted">{r.rationale}</p>
                {actions && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <ActionButton
                      label="🎯 Aplicar em campanha"
                      onClick={() => actions.onCampaign(`${r.recommendation} — ${r.rationale}`)}
                    />
                    <ActionButton
                      label="✍️ Gerar posts sobre isso"
                      onClick={() => actions.onPosts(r.recommendation)}
                    />
                    <ActionButton
                      label="📋 Criar demanda"
                      busyLabel="IA escrevendo o brief..."
                      onClick={() => actions.onDemand(`${r.recommendation} — ${r.rationale}`)}
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <SectionTitle>Watchlist</SectionTitle>
        <div className="text-sm text-muted">
          <List items={data.watchlist} />
        </div>
      </Card>
    </div>
  );
}

export function CampaignPlanView({
  data,
  actions,
}: {
  data: CampaignPlan;
  actions?: StrategyActions;
}) {
  return (
    <div className="space-y-6">
      <Card>
        <p className="font-[family-name:var(--font-display)] text-xl font-semibold">
          {data.theme}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted">{data.summary}</p>
        {actions && (
          <div className="mt-3 flex flex-wrap gap-2">
            {actions.onSocial && (
              <ActionButton
                label="📆 Gerar calendário social deste plano"
                onClick={() => actions.onSocial!()}
              />
            )}
            <ActionButton
              label="✍️ Gerar posts do tema"
              onClick={() => actions.onPosts(data.theme)}
            />
          </div>
        )}
      </Card>
      <Card>
        <SectionTitle>Objetivos & KPIs</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.objectives.map((o, i) => (
            <Item key={i} title={o.objective}>
              <p>{o.kpi}</p>
              <p className="mt-1 font-medium text-accent">{o.target}</p>
            </Item>
          ))}
        </div>
      </Card>
      <Card>
        <SectionTitle>Semana a semana</SectionTitle>
        <div className="space-y-3">
          {data.weeks.map((w) => (
            <div key={w.week} className="flex gap-4 rounded-lg border border-edge bg-surface-2 p-4">
              <div className="grid size-10 shrink-0 place-items-center rounded-md bg-accent font-[family-name:var(--font-display)] font-bold text-accent-ink">
                S{w.week}
              </div>
              <div className="flex-1 text-sm">
                <p className="font-semibold">{w.focus}</p>
                <div className="mt-1 text-muted">
                  <List items={w.actions} />
                </div>
                {actions && (
                  <div className="mt-2">
                    <ActionButton
                      label="📋 Criar demanda desta semana"
                      busyLabel="IA escrevendo o brief..."
                      onClick={() =>
                        actions.onDemand(
                          `Produção da semana ${w.week} da campanha "${data.theme}": ${w.focus}. Ações: ${w.actions.join("; ")}`
                        )
                      }
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle>Canais</SectionTitle>
          <div className="space-y-2">
            {data.channels.map((c, i) => (
              <Item key={i} title={`${c.channel} · ${c.frequency}`}>
                {c.strategy}
              </Item>
            ))}
          </div>
        </Card>
        <Card>
          <SectionTitle>Verba</SectionTitle>
          <div className="space-y-2">
            {data.budget.map((b, i) => (
              <div key={i} className="rounded-lg border border-edge bg-surface-2 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{b.item}</p>
                  <p className="font-semibold text-accent">{b.allocation}</p>
                </div>
                <p className="mt-1 text-muted">{b.rationale}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
      {(data.influencers?.length ?? 0) > 0 && (
        <Card>
          <SectionTitle>Influenciadores recomendados (perfis reais)</SectionTitle>
          <div className="grid gap-3 lg:grid-cols-2">
            {data.influencers.map((influencer, i) => (
              <div key={i} className="rounded-lg border border-edge bg-surface-2 p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">
                    {influencer.name}{" "}
                    <span className="text-muted">· {influencer.platform}</span>
                  </p>
                  <Tag>{influencer.followers}</Tag>
                </div>
                <p className="mt-1 text-muted">{influencer.whyFit}</p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                  {influencer.profileUrl && (
                    <a
                      href={influencer.profileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-accent hover:underline"
                    >
                      {influencer.handle || "ver perfil"} ↗
                    </a>
                  )}
                  {influencer.contactEmail && (
                    <span className="flex items-center gap-1 text-muted">
                      ✉ {influencer.contactEmail}
                      <CopyButton text={influencer.contactEmail} label="Copiar" />
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
      <Card>
        <SectionTitle>Riscos & pontos de atenção</SectionTitle>
        <div className="text-sm text-muted">
          <List items={data.risks} />
        </div>
      </Card>
    </div>
  );
}

export function RoiProjectionView({
  data,
  generationId,
  initialActuals,
  actions,
}: {
  data: RoiProjection;
  generationId?: string;
  initialActuals?: Record<string, string>;
  actions?: StrategyActions;
}) {
  const [actuals, setActuals] = useState<Record<string, string>>(initialActuals ?? {});
  const [savingActuals, setSavingActuals] = useState<"idle" | "saving" | "saved">("idle");
  const canEditActuals = Boolean(generationId);
  const hasActuals = Object.values(actuals).some((value) => value.trim());
  const stats = [
    { label: "Investimento total", value: data.roi.totalInvestment },
    { label: "Retorno projetado", value: data.roi.projectedReturn },
    { label: "ROI", value: data.roi.roiPercent },
    { label: "Payback", value: data.roi.paybackPeriod },
  ];
  return (
    <div className="space-y-6">
      <Card>
        <SectionTitle>Resumo</SectionTitle>
        <p className="text-sm leading-relaxed text-muted">{data.summary}</p>
      </Card>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s, i) => (
          <Card key={i} className="text-center">
            <p className="text-xs uppercase tracking-wide text-muted">{s.label}</p>
            <p className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold text-accent">
              {s.value}
            </p>
          </Card>
        ))}
      </div>
      <Card>
        <SectionTitle>Métricas — antes → projetado → real</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-muted">
              <tr>
                <th className="py-2 pr-4">Métrica</th>
                <th className="py-2 pr-4">Antes</th>
                <th className="py-2 pr-4">Projetado</th>
                <th className="py-2 pr-4">Uplift</th>
                {(canEditActuals || hasActuals) && <th className="py-2">Real</th>}
              </tr>
            </thead>
            <tbody>
              {data.metrics.map((m, i) => (
                <tr key={i} className="border-t border-edge">
                  <td className="py-2 pr-4 font-medium">{m.metric}</td>
                  <td className="py-2 pr-4 text-muted">{m.before}</td>
                  <td className="py-2 pr-4">{m.after}</td>
                  <td className="py-2 pr-4 font-semibold text-accent">{m.uplift}</td>
                  {canEditActuals ? (
                    <td className="py-1.5">
                      <input
                        value={actuals[m.metric] ?? ""}
                        onChange={(e) => {
                          setActuals((prev) => ({ ...prev, [m.metric]: e.target.value }));
                          setSavingActuals("idle");
                        }}
                        placeholder="valor real..."
                        className="w-28 rounded border border-edge bg-surface-2 px-2 py-1 text-xs outline-none focus:border-accent"
                      />
                    </td>
                  ) : (
                    hasActuals && (
                      <td className="py-2 font-semibold">{actuals[m.metric] || "—"}</td>
                    )
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {canEditActuals && (
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={async () => {
                setSavingActuals("saving");
                await api(`/api/generations/${generationId}`, {
                  method: "PATCH",
                  body: JSON.stringify({ actuals }),
                });
                setSavingActuals("saved");
              }}
              className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-ink transition-opacity hover:opacity-90"
            >
              {savingActuals === "saving" ? "Salvando..." : "Salvar valores reais"}
            </button>
            {savingActuals === "saved" && (
              <span className="text-xs text-accent">Salvos ✓ — projeção × realidade registrada</span>
            )}
          </div>
        )}
        <p className="mt-3 text-sm text-muted">{data.roi.explanation}</p>
      </Card>
      <Card>
        <SectionTitle>Roadmap</SectionTitle>
        <div className="space-y-3">
          {data.roadmap.map((r, i) => (
            <div key={i} className="rounded-lg border border-edge bg-surface-2 p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">{r.phase}</p>
                <Tag>{r.period}</Tag>
              </div>
              <div className="mt-2 text-muted">
                <List items={r.milestones} />
              </div>
              <p className="mt-2 text-muted">
                <span className="text-accent">Impacto esperado: </span>
                {r.expectedImpact}
              </p>
              {actions && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <ActionButton
                    label="🎯 Campanha desta fase"
                    onClick={() =>
                      actions.onCampaign(`Fase "${r.phase}" (${r.period}) do roadmap: ${r.milestones.join("; ")}`)
                    }
                  />
                  <ActionButton
                    label="📋 Criar demanda desta fase"
                    busyLabel="IA escrevendo o brief..."
                    onClick={() =>
                      actions.onDemand(
                        `Executar a fase "${r.phase}" (${r.period}) do roadmap: ${r.milestones.join("; ")}`
                      )
                    }
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle>Investimento mensal</SectionTitle>
          <div className="space-y-2">
            {data.investment.map((inv, i) => (
              <div key={i} className="rounded-lg border border-edge bg-surface-2 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{inv.item}</p>
                  <p className="font-semibold text-accent">{inv.monthlyCost}</p>
                </div>
                <p className="mt-1 text-muted">{inv.notes}</p>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <SectionTitle>Premissas</SectionTitle>
          <div className="text-sm text-muted">
            <List items={data.assumptions} />
          </div>
        </Card>
      </div>
    </div>
  );
}

export function SocialCalendarView({
  data,
  clientId,
  generationId,
}: {
  data: SocialCalendar;
  clientId?: string;
  generationId?: string;
}) {
  // Edição multiuser: o documento vive no estado e cada save persiste o JSON
  const [doc, setDoc] = useState<SocialCalendar>(data);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState({ caption: "", hashtags: "" });

  async function saveEdit(index: number) {
    const updated = {
      ...doc,
      posts: doc.posts.map((post, i) =>
        i === index
          ? { ...post, caption: draft.caption, hashtags: draft.hashtags.split(/\s+/).filter(Boolean) }
          : post
      ),
    };
    setDoc(updated);
    setEditingIndex(null);
    if (generationId) {
      await api(`/api/generations/${generationId}`, {
        method: "PATCH",
        body: JSON.stringify({ content: JSON.stringify(updated) }),
      });
    }
  }

  const ordered = doc.posts
    .map((post, index) => ({ post, index }))
    .sort((a, b) => a.post.day - b.post.day);

  return (
    <div className="space-y-6">
      <Card>
        <SectionTitle>Estratégia do mês</SectionTitle>
        <p className="text-sm leading-relaxed text-muted">{doc.strategySummary}</p>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        {ordered.map(({ post, index }) => (
          <Card key={index}>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="grid size-9 place-items-center rounded-md bg-accent font-[family-name:var(--font-display)] text-sm font-bold text-accent-ink">
                {post.day}
              </span>
              <Tag>{post.channel}</Tag>
              <Tag>{post.format}</Tag>
              <span className="ml-auto flex items-center gap-2">
                {generationId && editingIndex !== index && (
                  <button
                    className="rounded border border-edge bg-surface-2 px-2 py-0.5 text-xs text-muted transition-colors hover:border-accent hover:text-accent"
                    onClick={() => {
                      setEditingIndex(index);
                      setDraft({ caption: post.caption, hashtags: post.hashtags.join(" ") });
                    }}
                  >
                    ✏️ Editar
                  </button>
                )}
                <CopyButton text={`${post.caption}\n\n${post.hashtags.join(" ")}`} label="Copiar legenda" />
              </span>
            </div>
            <p className="font-semibold">{post.title}</p>
            {editingIndex === index ? (
              <div className="mt-2 space-y-2">
                <textarea
                  value={draft.caption}
                  onChange={(e) => setDraft((d) => ({ ...d, caption: e.target.value }))}
                  className="min-h-32 w-full rounded-md border border-accent/50 bg-surface-2 p-2 text-sm outline-none"
                />
                <input
                  value={draft.hashtags}
                  onChange={(e) => setDraft((d) => ({ ...d, hashtags: e.target.value }))}
                  className="w-full rounded-md border border-edge bg-surface-2 px-2 py-1 text-xs outline-none focus:border-accent"
                  placeholder="#hashtags separadas por espaço"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => saveEdit(index)}
                    className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-accent-ink"
                  >
                    Salvar
                  </button>
                  <button
                    onClick={() => setEditingIndex(null)}
                    className="rounded-md border border-edge px-3 py-1 text-xs text-muted"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{post.caption}</p>
                <p className="mt-2 text-xs text-accent">{post.hashtags.join(" ")}</p>
              </>
            )}
            <div className="mt-3 rounded-md border border-edge bg-surface-2 p-3 text-xs text-muted">
              <p>
                <span className="font-semibold text-foreground/80">🎨 Direção de arte: </span>
                {post.artDirection}
              </p>
              <p className="mt-1">
                <span className="font-semibold text-foreground/80">CTA: </span>
                {post.cta}
              </p>
            </div>
            {clientId && (
              <div className="mt-2">
                <CreateDemandButton
                  clientId={clientId}
                  title={`Produção — ${post.title}`}
                  brief={`Produzir a arte do post "${post.title}" (${post.format}, ${post.channel}, dia ${post.day}).\n\nDireção de arte: ${post.artDirection}\n\nLegenda aprovada: ${post.caption}\n\nCTA: ${post.cta}`}
                  skillsNeeded={postSkills(post.format, post.channel)}
                />
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

export function PostBatchView({
  data,
  clientId,
  generationId,
}: {
  data: PostBatch;
  clientId?: string;
  generationId?: string;
}) {
  const [doc, setDoc] = useState<PostBatch>(data);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState({ caption: "", hashtags: "" });

  async function saveEdit(index: number) {
    const updated = {
      ...doc,
      posts: doc.posts.map((post, i) =>
        i === index
          ? { ...post, caption: draft.caption, hashtags: draft.hashtags.split(/\s+/).filter(Boolean) }
          : post
      ),
    };
    setDoc(updated);
    setEditingIndex(null);
    if (generationId) {
      await api(`/api/generations/${generationId}`, {
        method: "PATCH",
        body: JSON.stringify({ content: JSON.stringify(updated) }),
      });
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {doc.posts.map((post, index) => (
        <Card key={index}>
          <div className="mb-2 flex items-center gap-2">
            <Tag>{post.variation}</Tag>
            <Tag>{post.channel}</Tag>
            <span className="ml-auto flex items-center gap-2">
              {generationId && editingIndex !== index && (
                <button
                  className="rounded border border-edge bg-surface-2 px-2 py-0.5 text-xs text-muted transition-colors hover:border-accent hover:text-accent"
                  onClick={() => {
                    setEditingIndex(index);
                    setDraft({ caption: post.caption, hashtags: post.hashtags.join(" ") });
                  }}
                >
                  ✏️ Editar
                </button>
              )}
              <CopyButton text={`${post.caption}\n\n${post.hashtags.join(" ")}`} label="Copiar legenda" />
            </span>
          </div>
          <p className="font-semibold">{post.hook}</p>
          {editingIndex === index ? (
            <div className="mt-2 space-y-2">
              <textarea
                value={draft.caption}
                onChange={(e) => setDraft((d) => ({ ...d, caption: e.target.value }))}
                className="min-h-32 w-full rounded-md border border-accent/50 bg-surface-2 p-2 text-sm outline-none"
              />
              <input
                value={draft.hashtags}
                onChange={(e) => setDraft((d) => ({ ...d, hashtags: e.target.value }))}
                className="w-full rounded-md border border-edge bg-surface-2 px-2 py-1 text-xs outline-none focus:border-accent"
                placeholder="#hashtags separadas por espaço"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => saveEdit(index)}
                  className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-accent-ink"
                >
                  Salvar
                </button>
                <button
                  onClick={() => setEditingIndex(null)}
                  className="rounded-md border border-edge px-3 py-1 text-xs text-muted"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{post.caption}</p>
              <p className="mt-2 text-xs text-accent">{post.hashtags.join(" ")}</p>
            </>
          )}
          <div className="mt-3 rounded-md border border-edge bg-surface-2 p-3 text-xs text-muted">
            <p>
              <span className="font-semibold text-foreground/80">🎨 Direção de arte: </span>
              {post.artDirection}
            </p>
            <p className="mt-1">
              <span className="font-semibold text-foreground/80">CTA: </span>
              {post.cta}
            </p>
          </div>
          {clientId && (
            <div className="mt-2">
              <CreateDemandButton
                clientId={clientId}
                title={`Produção — ${post.hook.slice(0, 60)}`}
                brief={`Produzir a arte do post (${post.channel}, ângulo: ${post.variation}).\n\nDireção de arte: ${post.artDirection}\n\nLegenda aprovada: ${post.caption}\n\nCTA: ${post.cta}`}
                skillsNeeded={postSkills(post.variation, post.channel)}
              />
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

export function VisualIdentityView({ data }: { data: VisualIdentity }) {
  return (
    <div className="space-y-6">
      <Card>
        <SectionTitle>Essência da marca</SectionTitle>
        <p className="text-sm leading-relaxed text-muted">{data.essence}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {data.slogans.map((s, i) => (
            <Tag key={i}>“{s}”</Tag>
          ))}
        </div>
      </Card>
      {data.logoConcepts.length > 0 && (
        <Card>
          <SectionTitle>Conceitos de logo</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.logoConcepts.map((logo, i) => (
              <div key={i} className="rounded-lg border border-edge bg-surface-2 p-4">
                <div className="grid h-28 place-items-center rounded-md bg-white p-3">
                  {/* SVG via <img> com data URI: não executa scripts */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`data:image/svg+xml;utf8,${encodeURIComponent(logo.svg)}`}
                    alt={logo.name}
                    className="max-h-full max-w-full"
                  />
                </div>
                <p className="mt-3 text-sm font-semibold">{logo.name}</p>
                <p className="mt-1 text-xs text-muted">{logo.rationale}</p>
                <div className="mt-2">
                  <CopyButton text={logo.svg} label="Copiar SVG" />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
      <Card>
        <SectionTitle>Paleta</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.palette.map((color, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border border-edge bg-surface-2 p-3">
              <span
                className="size-12 shrink-0 rounded-md border border-edge"
                style={{ backgroundColor: color.hex }}
              />
              <div className="text-sm">
                <p className="font-semibold">{color.name}</p>
                <p className="font-mono text-xs text-accent">{color.hex}</p>
                <p className="text-xs text-muted">{color.usage}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <SectionTitle>Tipografia</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.typography.map((t, i) => (
            <Item key={i} title={`${t.role}: ${t.font}`}>
              <p>Alternativa: {t.alternative}</p>
              <p className="mt-1">{t.notes}</p>
            </Item>
          ))}
        </div>
      </Card>
      <Card>
        <SectionTitle>Tom de voz</SectionTitle>
        <p className="text-sm text-muted">{data.toneOfVoice.description}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-emerald-900/50 bg-emerald-950/30 p-3 text-sm">
            <p className="mb-1 text-xs font-semibold uppercase text-emerald-400">Faça</p>
            <div className="text-muted">
              <List items={data.toneOfVoice.dos} />
            </div>
          </div>
          <div className="rounded-lg border border-red-900/50 bg-red-950/30 p-3 text-sm">
            <p className="mb-1 text-xs font-semibold uppercase text-red-400">Não faça</p>
            <div className="text-muted">
              <List items={data.toneOfVoice.donts} />
            </div>
          </div>
        </div>
      </Card>
      <Card>
        <SectionTitle>Aplicações prioritárias</SectionTitle>
        <div className="text-sm text-muted">
          <List items={data.applications} />
        </div>
      </Card>
    </div>
  );
}

export function ClientReportView({
  data,
  actions,
}: {
  data: ClientReport;
  actions?: StrategyActions;
}) {
  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionTitle>Sumário executivo — {data.period}</SectionTitle>
          <CopyButton
            text={`${data.title}\n\n${data.executiveSummary}\n\nDestaques:\n${data.highlights.map((h) => `- ${h}`).join("\n")}\n\nPróximos passos:\n${data.nextSteps.map((s) => `- ${s}`).join("\n")}`}
            label="Copiar resumo"
          />
        </div>
        <p className="text-sm leading-relaxed text-muted">{data.executiveSummary}</p>
      </Card>
      <Card>
        <SectionTitle>Destaques</SectionTitle>
        <div className="text-sm text-muted">
          <List items={data.highlights} />
        </div>
      </Card>
      <Card>
        <SectionTitle>Frentes de trabalho</SectionTitle>
        <div className="space-y-2">
          {data.workstreams.map((w, i) => (
            <div key={i} className="flex items-start gap-3 rounded-lg border border-edge bg-surface-2 p-3 text-sm">
              <Tag>{w.status}</Tag>
              <div>
                <p className="font-medium">{w.area}</p>
                <p className="text-muted">{w.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <SectionTitle>Qualidade das entregas</SectionTitle>
        <p className="text-sm text-muted">{data.qualityOverview}</p>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle>Próximos passos</SectionTitle>
          <div className="space-y-2">
            {data.nextSteps.map((step, i) => (
              <div key={i} className="rounded-md border border-edge bg-surface-2 p-3 text-sm">
                <p className="text-muted">{step}</p>
                {actions && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <ActionButton label="🎯 Virar campanha" onClick={() => actions.onCampaign(step)} />
                    <ActionButton
                      label="📋 Criar demanda"
                      busyLabel="IA escrevendo o brief..."
                      onClick={() => actions.onDemand(step)}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <SectionTitle>Riscos & pendências</SectionTitle>
          <div className="text-sm text-muted">
            <List items={data.risks} />
          </div>
        </Card>
      </div>
    </div>
  );
}

export function ProductRecsView({
  data,
  actions,
}: {
  data: import("@/lib/schemas").ProductRecs;
  actions?: StrategyActions;
}) {
  return (
    <div className="space-y-6">
      <Card>
        <SectionTitle>Leitura do momento</SectionTitle>
        <p className="text-sm leading-relaxed text-muted">{data.summary}</p>
      </Card>
      <Card>
        <SectionTitle>O que produzir/ofertar com o que você tem</SectionTitle>
        <div className="space-y-3">
          {data.opportunities.map((o, i) => (
            <div key={i} className="rounded-lg border border-edge bg-surface-2 p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">{o.name}</p>
                <div className="flex gap-1.5">
                  <Tag>esforço {o.effort}</Tag>
                  <Tag>{o.potential}</Tag>
                </div>
              </div>
              <p className="mt-1 text-muted">{o.whatItIs}</p>
              <p className="mt-2 text-muted">
                <span className="font-semibold text-foreground/80">Tendência: </span>
                {o.trendBasis}
              </p>
              <p className="mt-1 text-muted">
                <span className="font-semibold text-accent">Viável porque: </span>
                {o.fitWithCapabilities}
              </p>
              <p className="mt-1 text-muted">
                <span className="font-semibold text-foreground/80">Como começar: </span>
                {o.howToStart}
              </p>
              {actions && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <ActionButton
                    label="🎯 Campanha de lançamento"
                    onClick={() => actions.onCampaign(`Lançamento: ${o.name} — ${o.whatItIs}`)}
                  />
                  <ActionButton
                    label="✍️ Posts sobre isso"
                    onClick={() => actions.onPosts(`${o.name}: ${o.whatItIs}`)}
                  />
                  <ActionButton
                    label="📋 Criar demanda"
                    busyLabel="IA escrevendo o brief..."
                    onClick={() => actions.onDemand(`Materiais de lançamento de "${o.name}": ${o.whatItIs}. Como começar: ${o.howToStart}`)}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <SectionTitle>Reposicionamento do que você já faz</SectionTitle>
        <div className="space-y-2">
          {data.repositioning.map((r, i) => (
            <div key={i} className="rounded-lg border border-edge bg-surface-2 p-3 text-sm">
              <p className="font-medium">{r.area}</p>
              <p className="text-muted">{r.recommendation}</p>
              <p className="mt-1 text-xs text-muted">
                <span className="text-accent">Por quê: </span>
                {r.why}
              </p>
              {actions && (
                <div className="mt-2">
                  <ActionButton
                    label="🎯 Enfatizar em campanha"
                    onClick={() => actions.onCampaign(`Enfatizar ${r.area}: ${r.recommendation}`)}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
