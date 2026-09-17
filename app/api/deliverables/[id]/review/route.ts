import { NextResponse } from "next/server";
import { generateStructured } from "@/lib/claude";
import { getClient, listGenerations } from "@/lib/db";
import {
  createArtReview,
  listAnnotations,
  listArtReviews,
} from "@/lib/marketplace-db";
import { artReviewSchema, type ArtReviewContent } from "@/lib/marketplace-schemas";
import { clientContext } from "@/lib/prompts";
import { readUpload, type AllowedImageMime } from "@/lib/uploads";
import { aiErrorResponse, beginAi } from "@/lib/metering";
import { guardDeliverable, isDenied } from "@/lib/guard";

export const maxDuration = 300;

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guardDeliverable(id, "view");
  if (isDenied(auth)) return auth;
  return NextResponse.json(listArtReviews(id));
}

// Análise de qualidade da arte/foto por IA: nota 0-100 fundamentada em
// critérios profissionais, avaliando a peça individualmente E no contexto
// da campanha/briefing do cliente.
export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guardDeliverable(id, "workspace");
  if (isDenied(auth)) return auth;
  const { deliverable, project } = auth;
  const client = getClient(project.clientId);
  if (!client) {
    return NextResponse.json({ error: "Demanda/cliente não encontrado" }, { status: 404 });
  }
  const image = readUpload(deliverable.id, deliverable.mime);
  if (!image) {
    return NextResponse.json({ error: "Arquivo da entrega indisponível" }, { status: 404 });
  }

  const latestCampaign = listGenerations(project.clientId, "campaign_plan")[0];
  const latestIdentity = listGenerations(project.clientId, "visual_identity")[0];
  const annotations = listAnnotations(id);

  const ticket = await beginAi(request, auth.session, "art_review");
  if (isDenied(ticket)) return ticket;
  try {
    return await ticket.run(async () => {
    const content = await generateStructured<ArtReviewContent>({
      system:
        "Você é diretor(a) de criação sênior de uma agência, com olhar técnico de fotografia e design e foco em performance de marketing. Avalie com rigor profissional e notas realistas — 90+ é raro e reservado para trabalho excepcional. Responda em português do Brasil.",
      prompt: `${clientContext(client)}

<demanda>
Título: ${project.title}
Brief: ${project.brief || "n/d"}
</demanda>
${latestCampaign ? `\n<campanha_vigente>\n${latestCampaign.content.slice(0, 3000)}\n</campanha_vigente>` : ""}${latestIdentity ? `\n<identidade_visual>\n${latestIdentity.content.slice(0, 2500)}\n</identidade_visual>` : ""}${
        annotations.length
          ? `\n<revisoes_da_equipe>\n${annotations.map((a) => `- (${a.resolved ? "resolvida" : "aberta"}) ${a.comment}`).join("\n")}\n</revisoes_da_equipe>`
          : ""
      }

Analise a imagem entregue ("${deliverable.title}") para esta demanda.

Requisitos:
- Nota geral 0-100 ("overallScore") fundamentada nos critérios — não seja complacente.
- Critérios individuais (cada um 0-100 com comentário): composição/enquadramento, qualidade técnica (luz, foco, resolução ou acabamento de design), alinhamento com o briefing da demanda, consistência com a marca/identidade, e potencial de performance no marketing (parar o scroll, comunicar a mensagem, gerar ação).
- "campaignFit": nota e comentário sobre o encaixe da peça DENTRO da campanha/contexto do cliente (não apenas a qualidade isolada).
- Pontos fortes, melhorias objetivas e, se nota < 80, notas de revisão acionáveis para o profissional corrigir ("revisionNotes"; vazio se não houver).
- Veredito em uma frase.`,
      schema: artReviewSchema,
      maxTokens: 16000,
      images: [
        {
          base64: image.toString("base64"),
          mediaType: deliverable.mime as AllowedImageMime,
        },
      ],
    });

    const review = createArtReview({
      deliverableId: id,
      score: content.overallScore,
      content: JSON.stringify(content),
    });
    return NextResponse.json(review, { status: 201 });
    });
  } catch (error) {
    ticket.refund();
    return aiErrorResponse(error);
  }
}
