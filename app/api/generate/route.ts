import { NextResponse } from "next/server";
import { GenerationError, generateHtml, generateStructured } from "@/lib/claude";
import { createGeneration, getClient, listGenerations } from "@/lib/db";
import { createJob, finishJob, getPlatformSnapshot, logActivity } from "@/lib/marketplace-db";
import { buildGenerationSpec } from "@/lib/prompts";
import { generateSchema } from "@/lib/validation";
import { chargeUsage } from "@/lib/billing-db";

// Gerações com pesquisa web e landing pages podem levar alguns minutos
export const maxDuration = 300;

export async function POST(request: Request) {
  const parsed = generateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
  }

  const { clientId, type, params } = parsed.data;
  const client = getClient(clientId);
  if (!client) {
    return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }

  // Metering de IA: cobra coins da conta do cliente. Só bloqueia se o
  // enforcement estiver ligado (default OFF) — senão apenas registra o uso.
  const charge = chargeUsage({ accountType: "client", accountId: clientId, action: type });
  if (!charge.ok) {
    return NextResponse.json(
      { error: charge.reason ?? "Sem créditos de IA. Assine um plano ou compre coins." },
      { status: 402 }
    );
  }

  // A análise estratégica mais recente alimenta os demais entregáveis,
  // então as recomendações evoluem junto com o mercado.
  const latestStrategy = listGenerations(clientId, "strategy_analysis")[0];
  // O relatório executivo é automatizado: recebe o snapshot real da conta
  // (entregáveis, demandas, notas de qualidade, reuniões) como fonte de dados.
  if (type === "client_report") {
    params.platformData = getPlatformSnapshot(clientId);
  }
  const spec = buildGenerationSpec(type, client, params, {
    strategy: latestStrategy?.content.slice(0, 8000),
  });

  const job = createJob({ kind: type, label: `${spec.title} — ${client.name}`, clientId });
  try {
    const content =
      type === "landing_page"
        ? await generateHtml(spec)
        : JSON.stringify(
            await generateStructured({
              ...spec,
              schema: spec.schema!,
            })
          );

    const generation = createGeneration({
      clientId,
      type,
      title: spec.title,
      params,
      content,
    });
    logActivity({
      audience: "client",
      clientId,
      text: `✨ Novo entregável na sua conta: ${spec.title}`,
      href: `/portal/client/${clientId}`,
    });
    finishJob(job.id, "done");
    return NextResponse.json(generation, { status: 201 });
  } catch (error) {
    const message =
      error instanceof GenerationError ? error.message : "Erro inesperado ao gerar conteúdo.";
    finishJob(job.id, "error", message);
    if (error instanceof GenerationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
