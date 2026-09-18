"use client";

import type { MonthlyReportData } from "@/lib/report-aggregate";
import type { MonthlyReportSummary } from "@/lib/reports-db";
import { fmtCurrency, fmtNum, type UiLang } from "@/lib/i18n";
import { Dash } from "./ui";
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

/**
 * Anatomia de documento (§10): seção numerada, figura numerada com legenda e
 * fonte, número em figura tabular, medida de leitura de 62ch. A mesma peça
 * serve a tela e o papel — nada aqui é `display:none` na impressão.
 */
function DocSection({
  n,
  title,
  children,
  testId,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <section className="doc-figure mt-10 border-t border-edge pt-4" data-testid={testId}>
      <div className="flex items-baseline gap-3">
        <span className="idx t5 w-8 shrink-0">{String(n).padStart(2, "0")}</span>
        <h2 className="d4">{title}</h2>
      </div>
      <div className="mt-3 sm:pl-11">{children}</div>
    </section>
  );
}

/** Tabela de chaves e números: rótulo à esquerda, figura tabular à direita. */
function Figures({ rows }: { rows: { label: string; value: React.ReactNode; hint?: string }[] }) {
  return (
    <dl className="doc-kpi border-t border-rule">
      {rows.map((row) => (
        <div key={row.label} className="flex items-baseline justify-between gap-4 border-b border-rule py-2">
          <dt className="t4 min-w-0 text-text-muted">
            {row.label}
            {row.hint && <span className="t5 ml-2 text-text-faint">{row.hint}</span>}
          </dt>
          <dd className="n3 shrink-0">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Nota de rodapé da figura: de onde veio o número.
 *
 * (A tabela de entregas usa largura em porcentagem, não `min-width` + rolagem:
 * uma tabela que rola de lado não existe no papel.)
 */
function Source({ children }: { children: React.ReactNode }) {
  return <p className="t5 measure-prose mt-2 text-text-faint">{children}</p>;
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
    new Date(iso).toLocaleDateString(lang === "en" ? "en-US" : "pt-BR", {
      day: "2-digit",
      month: "short",
    });
  const num = (v: number) => fmtNum(v, lang);

  // Sumário: só entram as seções que existem neste mês. Um índice que promete
  // uma seção vazia é pior do que não ter índice.
  const toc: string[] = ["Resumo executivo", "O mês em números", "O que foi entregue", "Conteúdo nas redes", "Resultados"];
  if (data.learnings) toc.push("O que funcionou no mês");
  if (data.topLinks && data.topLinks.length > 0) toc.push("Links mais clicados");
  if (data.aiRadar) toc.push("Radar de IA");
  if (data.satisfaction) toc.push("Satisfação do cliente");
  toc.push("Demandas e revisões");
  const at = (title: string) => toc.indexOf(title) + 1;

  return (
    <div data-testid="monthly-report">
      {/* Sumário, em coluna de leitura */}
      <nav aria-label="Sumário" className="prose-doc border-t border-edge pt-3">
        <p className="t6 text-text-muted">Neste relatório</p>
        <ol className="mt-2">
          {toc.map((title, i) => (
            <li key={title} className="flex items-baseline gap-3 border-b border-rule py-1.5">
              <span className="idx t5 w-8 shrink-0">{String(i + 1).padStart(2, "0")}</span>
              <span className="t4">{title}</span>
            </li>
          ))}
        </ol>
      </nav>

      <DocSection n={at("Resumo executivo")} title="Resumo executivo">
        {summary ? (
          <>
            {summary.demo && <p className="t6 mb-2 text-caution">exemplo — sem chave de IA</p>}
            <p className="t1 prose-doc" data-testid="report-summary">
              {summary.executiveSummary}
            </p>
            <div className="mt-6 grid gap-8 md:grid-cols-2">
              <div>
                <p className="t6 border-b border-rule pb-1 text-text-muted">Destaques do mês</p>
                <ul>
                  {summary.highlights.map((h, i) => (
                    <li key={i} className="t3 measure-prose border-b border-rule py-2">
                      {h}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="t6 border-b border-rule pb-1 text-text-muted">Recomendações para o próximo mês</p>
                <ul>
                  {summary.recommendations.map((r, i) => (
                    <li key={i} className="t3 measure-prose border-b border-rule py-2">
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        ) : (
          <p className="t2 prose-doc text-text-muted">
            O resumo executivo da IA ainda não foi gerado para este mês.
          </p>
        )}
      </DocSection>

      <DocSection n={at("O mês em números")} title="O mês em números">
        <Figures
          rows={[
            { label: "Entregas no mês", value: num(data.shipped.total) },
            { label: "Aprovadas pelo cliente", value: num(data.shipped.approved) },
            { label: "Posts publicados", value: num(data.posts.published) },
            { label: "Posts agendados", value: num(data.posts.scheduled) },
          ]}
        />
        <Source>
          Contagem das entregas registradas na plataforma e dos posts do calendário do período.
        </Source>
      </DocSection>

      <DocSection n={at("O que foi entregue")} title="O que foi entregue">
        {data.shipped.items.length === 0 ? (
          <p className="t3 text-text-muted">Nenhuma entrega registrada neste mês.</p>
        ) : (
          <div>
            <table className="doc-table w-full table-fixed border-collapse text-left">
              <colgroup>
                <col className="w-1/2" />
                <col className="w-[30%]" />
                <col className="w-[20%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-edge">
                  <th className="t6 pb-2 text-text-muted">Entrega</th>
                  <th className="t6 pb-2 text-text-muted">Situação</th>
                  <th className="t6 pb-2 text-right text-text-muted">Data</th>
                </tr>
              </thead>
              <tbody>
                {data.shipped.items.map((item) => (
                  <tr key={item.id} className="border-b border-rule align-baseline">
                    <td className="py-2">
                      <span className="t3 block font-medium">{item.title}</span>
                      {item.projectTitle && (
                        <span className="t5 block text-text-muted">{item.projectTitle}</span>
                      )}
                    </td>
                    <td className="t4 py-2 text-text-muted">
                      {APPROVAL_LABEL[item.approvalStatus]}
                      {item.annotations > 0 && (
                        <span className="t5 block text-text-faint">{item.annotations} anotações</span>
                      )}
                    </td>
                    <td className="t4 tnum py-2 text-right text-text-muted">
                      {fmtDate(item.approvedAt ?? item.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DocSection>

      <DocSection n={at("Conteúdo nas redes")} title="Conteúdo nas redes">
        {data.posts.byChannel.length === 0 ? (
          <p className="t3 text-text-muted">Nenhum post agendado ou publicado neste mês.</p>
        ) : (
          <Figures
            rows={data.posts.byChannel.map((c) => ({ label: c.channel, value: num(c.count) }))}
          />
        )}
        {data.posts.drafts > 0 && <Source>{num(data.posts.drafts)} rascunhos aguardando data.</Source>}
      </DocSection>

      <DocSection n={at("Resultados")} title="Resultados">
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <p className="t6 mb-1 text-text-muted">Mídia</p>
            {data.metrics.hasData ? (
              <>
                <Figures
                  rows={[
                    { label: "Investimento", value: fmtCurrency(data.metrics.spend, "BRL", lang) },
                    { label: "Impressões", value: num(Math.round(data.metrics.impressions)) },
                    { label: "Cliques", value: num(Math.round(data.metrics.clicks)) },
                    { label: "Conversões", value: num(Math.round(data.metrics.conversions)) },
                  ]}
                />
                <Source>Fonte: {data.metrics.platforms.join(", ")}.</Source>
              </>
            ) : (
              <p className="t3 text-text-muted">
                Sem métricas de mídia conectadas neste mês. <Dash />
              </p>
            )}
          </div>
          <div>
            <p className="t6 mb-1 text-text-muted">Vendas</p>
            {data.sales.hasData ? (
              <Figures
                rows={[
                  {
                    label: "Vendas registradas",
                    value: fmtCurrency(data.sales.revenue, data.sales.currency, lang),
                  },
                  { label: "Unidades / negócios", value: num(Math.round(data.sales.units)) },
                ]}
              />
            ) : (
              <p className="t3 text-text-muted">
                Sem vendas registradas neste mês. <Dash />
              </p>
            )}
          </div>
        </div>
      </DocSection>

      {data.learnings && (
        <DocSection n={at("O que funcionou no mês")} title="O que funcionou no mês" testId="report-learnings">
          <LearningsSummary
            learnings={data.learnings}
            reading={data.learningsReading ?? null}
            lang={lang}
            compact
          />
        </DocSection>
      )}

      {data.topLinks && data.topLinks.length > 0 && (
        <DocSection n={at("Links mais clicados")} title="Links mais clicados" testId="report-links">
          <Figures
            rows={data.topLinks.map((link) => ({ label: link.label, value: num(link.clicks) }))}
          />
          <Source>Cliques nos links rastreáveis da marca (sem robôs, sem cookies).</Source>
        </DocSection>
      )}

      {data.aiRadar && (
        <DocSection n={at("Radar de IA")} title="Radar de IA" testId="report-ai-radar">
          <Figures
            rows={[
              { label: "Participação da marca", value: `${num(data.aiRadar.shareOfVoice)}%` },
              {
                label: "Respostas que citam a marca",
                value: `${data.aiRadar.answersWithClient}/${data.aiRadar.questions}`,
              },
            ]}
          />
          <ol className="mt-4">
            {data.aiRadar.actions.map((a, i) => (
              <li key={a} className="flex items-baseline gap-3 border-b border-rule py-2">
                <span className="idx t5 w-6 shrink-0">{String(i + 1).padStart(2, "0")}</span>
                <span className="t3 measure-prose">{a}</span>
              </li>
            ))}
          </ol>
          <p className="t5 measure-prose mt-2 text-text-faint" data-testid="report-ai-radar-disclaimer">
            {data.aiRadar.disclaimer}
          </p>
        </DocSection>
      )}

      {data.satisfaction && (
        <DocSection n={at("Satisfação do cliente")} title="Satisfação do cliente" testId="report-satisfaction">
          {data.satisfaction.hasData ? (
            <>
              <Figures
                rows={[
                  {
                    label: "Respostas no mês",
                    value: num(data.satisfaction.responses),
                    hint: `${data.satisfaction.happy} · ${data.satisfaction.neutral} · ${data.satisfaction.sad}`,
                  },
                  { label: "Média (1 a 3)", value: data.satisfaction.avg ?? <Dash /> },
                  { label: "NPS do trimestre", value: data.satisfaction.nps.score ?? <Dash /> },
                  {
                    label: "Promotores",
                    value: num(data.satisfaction.nps.promoters),
                    hint: `${data.satisfaction.nps.detractors} detratores`,
                  },
                ]}
              />
              {data.satisfaction.comments.length > 0 && (
                <ul className="mt-4">
                  {data.satisfaction.comments.map((c, i) => (
                    <li key={i} className="d-quote t2 prose-doc border-b border-rule py-2 text-text-muted">
                      “{c}”
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className="t3 text-text-muted">
              Sem respostas de satisfação neste mês. <Dash />
            </p>
          )}
        </DocSection>
      )}

      <DocSection n={at("Demandas e revisões")} title="Demandas e revisões">
        <div className="grid gap-8 md:grid-cols-2">
          <Figures
            rows={[
              { label: "Abertas no mês", value: num(data.projects.created) },
              { label: "Concluídas", value: num(data.projects.completed) },
              { label: "Em andamento", value: num(data.projects.active) },
            ]}
          />
          <div>
            <Figures
              rows={[
                {
                  label: "Anotações de revisão",
                  value: num(data.annotations.total),
                  hint: `${data.annotations.resolved} resolvidas`,
                },
                { label: "Entregáveis de IA", value: num(data.generations.count) },
              ]}
            />
            {data.generations.items.length > 0 && (
              <ul className="mt-3">
                {data.generations.items.slice(0, 6).map((g, i) => (
                  <li key={i} className="t5 border-b border-rule py-1 text-text-muted">
                    {g.title}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </DocSection>
    </div>
  );
}
