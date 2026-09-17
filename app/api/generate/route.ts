import { NextResponse } from "next/server";
import { GenerationError, generateHtml, generateStructured } from "@/lib/claude";
import { createGeneration, getClient, listGenerations } from "@/lib/db";
import { createJob, finishJob, getPlatformSnapshot, logActivity } from "@/lib/marketplace-db";
import { buildGenerationSpec } from "@/lib/prompts";
import { generateSchema } from "@/lib/validation";
import { getSettings } from "@/lib/settings";
import { guardClient, isDenied } from "@/lib/guard";
import { aiErrorResponse, beginAi } from "@/lib/metering";

// Gerações com pesquisa web e landing pages podem levar alguns minutos
export const maxDuration = 300;

// Gera um entregável do kit. Quem paga: a agência (pelos clientes que atende)
// ou a marca autônoma. Cobra antes, estorna se a geração falhar.
export async function POST(request: Request) {
  const parsed = generateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
  }

  const { clientId, type, params } = parsed.data;
  const auth = await guardClient(clientId, "workspace");
  if (isDenied(auth)) return auth;
  const client = getClient(clientId);
  if (!client) {
    return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }
  if (type === "landing_page" && !getSettings().landingPagesEnabled) {
    return NextResponse.json({ error: "Landing pages estão desativadas nesta plataforma." }, { status: 403 });
  }

  const ticket = await beginAi(request, auth, type, { agencyId: client.agencyId });
  if (isDenied(ticket)) return ticket;

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

  const job = createJob({ kind: type, label: `${spec.title} — ${client.name}`, clientId, agencyId: client.agencyId });
  try {
    const content = await ticket.run(async () =>
      type === "landing_page"
        ? await generateHtml(spec)
        : JSON.stringify(await generateStructured({ ...spec, schema: spec.schema! }))
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
    ticket.refund();
    finishJob(job.id, "error", error instanceof GenerationError ? error.message : "erro");
    return aiErrorResponse(error);
  }
}
