import { NextResponse } from "next/server";
import { z } from "zod";
import { GenerationError, generateStructured } from "@/lib/claude";
import { createJob, createProspect, createProspectSearch, finishJob, latestProspectSearch, listProspects } from "@/lib/marketplace-db";
import { prospectingSchema, type ProspectingResult } from "@/lib/marketplace-schemas";
import { aiErrorResponse, beginAi } from "@/lib/metering";
import { agencyOnly, isDenied } from "@/lib/guard";

export const maxDuration = 300;

const searchSchema = z.object({
  niche: z.string().trim().min(1, "Informe o nicho").max(200),
  region: z.string().trim().min(1, "Informe a região").max(200),
  notes: z.string().trim().max(2000).default(""),
});

export async function GET() {
  const auth = await agencyOnly();
  if (isDenied(auth)) return auth;
  return NextResponse.json({
    prospects: listProspects(),
    lastSearch: latestProspectSearch(),
  });
}

// Prospecção ativa: a IA pesquisa na web negócios reais do nicho/região que
// são potenciais clientes da agência — mesmo sem cadastro na plataforma.
export async function POST(request: Request) {
  const auth = await agencyOnly();
  if (isDenied(auth)) return auth;
  const parsed = searchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
      { status: 400 }
    );
  }
  const { niche, region, notes } = parsed.data;
  const ticket = await beginAi(request, auth, "prospecting");
  if (isDenied(ticket)) return ticket;
  const job = createJob({ kind: "prospecting", label: `Prospecção: ${niche} — ${region}` });
  try {
    return await ticket.run(async () => {
    const result = await generateStructured<ProspectingResult>({
      system:
        "Você é o head de novos negócios de uma agência de marketing. Você encontra empresas REAIS pesquisando na web e qualifica cada lead com critério. Nunca invente empresas: liste apenas negócios que você encontrou na pesquisa, com os dados que conseguiu confirmar (deixe campos vazios quando não encontrar). Responda em português do Brasil.",
      prompt: `Pesquise na web e encontre 5 a 10 potenciais clientes para a agência no nicho "${niche}" na região "${region}".${notes ? `\nCritérios extras da agência: ${notes}` : ""}

Para cada empresa encontrada:
- Nome, segmento e localização.
- Site e Instagram (apenas se encontrados na pesquisa; caso contrário deixe vazio).
- Por que é um bom fit para uma agência de marketing (sinais reais: presença digital fraca, concorrência forte, crescimento, reclamações sobre marketing...).
- Maturidade de marketing (ex.: "sem presença digital", "só Instagram irregular", "investe em ads sem estratégia").
- Abordagem de venda sugerida, personalizada para o contexto da empresa.

Priorize empresas com maior probabilidade de fechar: dor visível + capacidade de investir.`,
      schema: prospectingSchema,
      useWebSearch: true,
      webSearchMaxUses: 10,
      tier: "standard",
      maxTokens: 24000,
    });

    const searchQuery = `${niche} — ${region}`;
    const saved = result.prospects.map((prospect) =>
      createProspect({ ...prospect, searchQuery })
    );
    // Resumo persistente: sobrevive a refresh e explica buscas vazias
    createProspectSearch({
      query: searchQuery,
      summary: result.summary,
      resultCount: saved.length,
    });
    finishJob(job.id, "done");
    return NextResponse.json({ summary: result.summary, prospects: saved }, { status: 201 });
    });
  } catch (error) {
    ticket.refund();
    finishJob(job.id, "error", error instanceof GenerationError ? error.message : "erro");
    return aiErrorResponse(error);
  }
}
