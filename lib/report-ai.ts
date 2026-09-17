import { generateStructured } from "./claude";
import { isAiMock } from "./ai-mock";
import { clientContext } from "./prompts";
import { getSettings } from "./settings";
import type { Client } from "./types";
import { describeMonth, type MonthlyReportData } from "./report-aggregate";
import type { MonthlyReportSummary } from "./reports-db";

const str = { type: "string" } as const;
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["executiveSummary", "highlights", "recommendations"],
  properties: {
    executiveSummary: str,
    highlights: { type: "array", items: str },
    recommendations: { type: "array", items: str },
  },
} as const;

function monthLabel(month: string, lang: "pt-BR" | "en"): string {
  const date = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1));
  return date.toLocaleDateString(lang === "en" ? "en-US" : "pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

// Fixture determinística: escrita a partir dos números reais do mês, para o
// relatório nunca sair em branco (sem chave / AI_MOCK). Marcada como demo.
export function mockReportSummary(
  client: Pick<Client, "name" | "language">,
  data: MonthlyReportData
): MonthlyReportSummary {
  const en = client.language === "en";
  const label = monthLabel(data.month, en ? "en" : "pt-BR");
  const s = data.shipped;
  const p = data.posts;
  if (en) {
    return {
      demo: true,
      executiveSummary: `In ${label}, ${client.name} received ${s.total} deliverable${s.total === 1 ? "" : "s"} (${s.approved} approved, ${s.pending} awaiting approval). ${p.published} post${p.published === 1 ? "" : "s"} went live and ${p.scheduled} are scheduled. ${data.sales.hasData ? `Tracked sales reached ${data.sales.currency} ${Math.round(data.sales.revenue)}.` : "No sales were tracked this month."}`,
      highlights: [
        `${s.total} deliverables shipped, ${s.approved} approved by the client`,
        `${p.published} posts published, ${p.scheduled} scheduled${p.byChannel[0] ? ` (${p.byChannel[0].channel} leads)` : ""}`,
        `${data.generations.count} AI deliverables generated for the account`,
      ],
      recommendations: [
        s.pending > 0
          ? `Close the ${s.pending} pending approval${s.pending === 1 ? "" : "s"} in the first week to keep production flowing`
          : "Send the next batch of pieces for approval early in the month",
        p.scheduled + p.published < 8
          ? "Fill the content calendar to at least 2 posts per week"
          : "Keep the posting rhythm and test one new format",
        data.metrics.hasData
          ? "Compare paid-media conversions with tracked sales to decide where to scale spend"
          : "Connect GA4 or Meta Ads so the next report shows real reach and conversion",
      ],
    };
  }
  return {
    demo: true,
    executiveSummary: `Em ${label}, a conta ${client.name} recebeu ${s.total} entrega${s.total === 1 ? "" : "s"} (${s.approved} aprovada${s.approved === 1 ? "" : "s"}, ${s.pending} aguardando aprovação). ${p.published} post${p.published === 1 ? "" : "s"} foram ao ar e ${p.scheduled} estão agendados. ${data.sales.hasData ? `As vendas registradas somaram ${data.sales.currency} ${Math.round(data.sales.revenue)}.` : "Nenhuma venda foi registrada neste mês."}`,
    highlights: [
      `${s.total} entregas feitas, ${s.approved} aprovadas pelo cliente`,
      `${p.published} posts publicados e ${p.scheduled} agendados${p.byChannel[0] ? ` (${p.byChannel[0].channel} na frente)` : ""}`,
      `${data.generations.count} entregáveis de IA gerados para a conta`,
    ],
    recommendations: [
      s.pending > 0
        ? `Fechar as ${s.pending} aprovações pendentes na primeira semana para não travar a produção`
        : "Mandar o próximo lote de peças para aprovação logo no começo do mês",
      p.scheduled + p.published < 8
        ? "Preencher o calendário com pelo menos 2 posts por semana"
        : "Manter o ritmo de publicação e testar um formato novo",
      data.metrics.hasData
        ? "Cruzar as conversões de mídia paga com as vendas registradas para decidir onde escalar a verba"
        : "Conectar GA4 ou Meta Ads para o próximo relatório mostrar alcance e conversão reais",
    ],
  };
}

export async function generateReportSummary(
  client: Client,
  data: MonthlyReportData
): Promise<MonthlyReportSummary> {
  if (isAiMock({ orNoKey: true })) return mockReportSummary(client, data);
  const language = client.language === "en" ? "English (US)" : "Brazilian Portuguese";
  const settings = getSettings();
  const result = await generateStructured<MonthlyReportSummary>({
    tier: "standard",
    maxTokens: 3000,
    system: `You write the monthly client report of a marketing agency${settings.agencyName ? ` (${settings.agencyName})` : ""}. The reader is the client's owner: business language, no agency jargon, no filler. Use ONLY the numbers given; never invent results. Write in ${language}.${settings.houseStyle ? ` House style: ${settings.houseStyle}` : ""}
Return: executiveSummary (one paragraph, 3-5 sentences, honest about what moved and what did not), highlights (3-5 short bullets with the concrete numbers), recommendations (3-5 specific actions for NEXT month, each starting with a verb, tied to the data).`,
    prompt: `${clientContext(client)}

<numeros_do_mes>
${describeMonth(data)}
</numeros_do_mes>

Write the report for ${monthLabel(data.month, client.language === "en" ? "en" : "pt-BR")}.`,
    schema: SCHEMA as unknown as Record<string, unknown>,
  });
  return { ...result, demo: false };
}
