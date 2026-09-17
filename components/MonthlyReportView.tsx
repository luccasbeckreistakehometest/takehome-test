"use client";

import type { MonthlyReportData } from "@/lib/report-aggregate";
import type { MonthlyReportSummary } from "@/lib/reports-db";
import { fmtCurrency, fmtNum, type UiLang } from "@/lib/i18n";
import { Card, SectionTitle, Tag } from "./ui";
import { LearningsSummary } from "./LearningsCard";

// Renderização do relatório mensal — a mesma nas três telas (agência, portal
// do cliente e impressão). Só os rótulos são do chrome (traduzidos pelo
// dicionário); o resumo da IA já vem no idioma do cliente.

export function monthTitle(month: string, lang: UiLang): string {
  const date = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1));
  const label = date.toLocaleDateString(lang === "en" ? "en-US" : "pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

const APPROVAL_LABEL: Record<string, string> = {
  approved: "Aprovada",
  pending: "Aguardando aprovação",
  changes_requested: "Ajustes pedidos",
};

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-lg border border-edge bg-surface-2 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export default function MonthlyReportView({
  data,
  summary,
  lang,
}: {
  data: MonthlyReportData;
  summary: MonthlyReportSummary | null;
  lang: UiLang;
}) {
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(lang === "en" ? "en-US" : "pt-BR", { day: "2-digit", month: "short" });
  return (
    <div className="space-y-6" data-testid="monthly-report">
      {summary ? (
        <Card className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SectionTitle>Resumo executivo</SectionTitle>
            {summary.demo && <Tag>exemplo — sem chave de IA</Tag>}
          </div>
          <p className="text-sm leading-relaxed" data-testid="report-summary">{summary.executiveSummary}</p>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted">Destaques do mês</p>
              <ul className="space-y-1 text-sm">
                {summary.highlights.map((h, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-accent">✓</span>
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted">Recomendações para o próximo mês</p>
              <ul className="space-y-1 text-sm">
                {summary.recommendations.map((r, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-accent">→</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      ) : (
        <Card>
          <p className="text-sm text-muted">O resumo executivo da IA ainda não foi gerado para este mês.</p>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Entregas no mês" value={data.shipped.total} />
        <Stat label="Aprovadas pelo cliente" value={data.shipped.approved} />
        <Stat label="Posts publicados" value={data.posts.published} />
        <Stat label="Posts agendados" value={data.posts.scheduled} />
      </div>

      <Card>
        <SectionTitle>O que foi entregue</SectionTitle>
        {data.shipped.items.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma entrega registrada neste mês.</p>
        ) : (
          <div className="space-y-1.5">
            {data.shipped.items.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-edge bg-surface-2 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{item.title}</p>
                  <p className="text-xs text-muted">
                    {item.projectTitle}
                    {item.projectTitle && " · "}
                    <span>{fmtDate(item.createdAt)}</span>
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {item.annotations > 0 && (
                    <Tag>
                      <span>{item.annotations}</span> <span>anotações</span>
                    </Tag>
                  )}
                  <Tag>{APPROVAL_LABEL[item.approvalStatus]}</Tag>
                  {item.approvedAt && <span className="text-xs text-muted">{fmtDate(item.approvedAt)}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle>Conteúdo nas redes</SectionTitle>
          {data.posts.byChannel.length === 0 ? (
            <p className="text-sm text-muted">Nenhum post agendado ou publicado neste mês.</p>
          ) : (
            <div className="space-y-1.5 text-sm">
              {data.posts.byChannel.map((c) => (
                <div key={c.channel} className="flex items-center justify-between rounded-md border border-edge bg-surface-2 px-3 py-1.5">
                  <span>{c.channel}</span>
                  <span className="font-medium">{c.count}</span>
                </div>
              ))}
              {data.posts.drafts > 0 && (
                <p className="text-xs text-muted">
                  <span>{data.posts.drafts}</span> <span>rascunhos aguardando data</span>
                </p>
              )}
            </div>
          )}
        </Card>

        <Card>
          <SectionTitle>Resultados</SectionTitle>
          <div className="space-y-3 text-sm">
            {data.metrics.hasData ? (
              <div className="grid grid-cols-2 gap-2">
                <Stat label="Investimento em mídia" value={fmtCurrency(data.metrics.spend, "BRL", lang)} hint={data.metrics.platforms.join(", ")} />
                <Stat label="Impressões" value={fmtNum(Math.round(data.metrics.impressions), lang)} />
                <Stat label="Cliques" value={fmtNum(Math.round(data.metrics.clicks), lang)} />
                <Stat label="Conversões" value={fmtNum(Math.round(data.metrics.conversions), lang)} />
              </div>
            ) : (
              <p className="text-muted">Sem métricas de mídia conectadas neste mês.</p>
            )}
            {data.sales.hasData ? (
              <div className="grid grid-cols-2 gap-2">
                <Stat label="Vendas registradas" value={fmtCurrency(data.sales.revenue, data.sales.currency, lang)} />
                <Stat label="Unidades / negócios" value={fmtNum(Math.round(data.sales.units), lang)} />
              </div>
            ) : (
              <p className="text-muted">Sem vendas registradas neste mês.</p>
            )}
          </div>
        </Card>
      </div>

      {data.learnings && (
        <Card data-testid="report-learnings">
          <SectionTitle>O que funcionou no mês</SectionTitle>
          <LearningsSummary learnings={data.learnings} reading={data.learningsReading ?? null} lang={lang} compact />
        </Card>
      )}

      {data.satisfaction && (
        <Card data-testid="report-satisfaction">
          <SectionTitle>Satisfação do cliente</SectionTitle>
          {data.satisfaction.hasData ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat label="Respostas no mês" value={data.satisfaction.responses} hint={`😀 ${data.satisfaction.happy} · 😐 ${data.satisfaction.neutral} · 😞 ${data.satisfaction.sad}`} />
                <Stat label="Média (1 a 3)" value={data.satisfaction.avg ?? "—"} />
                <Stat label="NPS do trimestre" value={data.satisfaction.nps.score ?? "—"} hint={data.satisfaction.nps.responses ? `${data.satisfaction.nps.responses} resposta(s)` : undefined} />
                <Stat label="Promotores" value={data.satisfaction.nps.promoters} hint={`${data.satisfaction.nps.detractors} detratores`} />
              </div>
              {data.satisfaction.comments.length > 0 && (
                <ul className="space-y-1 text-sm text-muted">
                  {data.satisfaction.comments.map((c, i) => (
                    <li key={i}>“{c}”</li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted">Sem respostas de satisfação neste mês.</p>
          )}
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle>Demandas</SectionTitle>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Abertas no mês" value={data.projects.created} />
            <Stat label="Concluídas" value={data.projects.completed} />
            <Stat label="Em andamento" value={data.projects.active} />
          </div>
        </Card>
        <Card>
          <SectionTitle>Revisões e estratégia</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Anotações de revisão" value={data.annotations.total} hint={`${data.annotations.resolved} ✓`} />
            <Stat label="Entregáveis de IA" value={data.generations.count} />
          </div>
          {data.generations.items.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs text-muted">
              {data.generations.items.slice(0, 6).map((g, i) => (
                <li key={i}>· {g.title}</li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
