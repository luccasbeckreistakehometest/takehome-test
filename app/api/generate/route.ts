import { NextResponse } from "next/server";
import { GenerationError, generateHtml, generateStructured } from "@/lib/claude";
import { createGeneration, getClient, listGenerations } from "@/lib/db";
import { getPlatformSnapshot } from "@/lib/marketplace-db";
import { buildGenerationSpec } from "@/lib/prompts";
import { generateSchema } from "@/lib/validation";

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
    return NextResponse.json(generation, { status: 201 });
  } catch (error) {
    if (error instanceof GenerationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: "Erro inesperado ao gerar conteúdo." },
      { status: 500 }
    );
  }
}
