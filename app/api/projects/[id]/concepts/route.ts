import { NextResponse } from "next/server";
import { generateStructured } from "@/lib/claude";
import { getClient } from "@/lib/db";
import { createDeliverable, getProject, listDeliverables } from "@/lib/marketplace-db";
import { getSettings } from "@/lib/settings";
import { generateConceptImages } from "@/lib/images";
import { readUpload, saveUpload } from "@/lib/uploads";

export const maxDuration = 300;

type Context = { params: Promise<{ id: string }> };

// Gera VÁRIAS imagens-conceito (text-to-image) para a demanda usando um
// provedor gratuito (Pollinations sem chave, ou Together FLUX free). Ótimo
// para testar direções visuais e mostrar ao cliente. Para mockup fiel de
// produto/modelo reais, use a rota /mockup (Gemini).
export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  const project = getProject(id);
  const client = project ? getClient(project.clientId) : null;
  if (!project || !client) {
    return NextResponse.json({ error: "Demanda não encontrada" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const count = Math.max(1, Math.min(Number(body?.count) || 4, 6));
  const settings = getSettings();

  // Referências REAIS enviadas (modelo, produto, cenário) — exclui as próprias
  // imagens que a IA gerou antes para não realimentar o ciclo.
  const references = listDeliverables(id)
    .filter(
      (d) =>
        d.kind === "reference" &&
        d.mime.startsWith("image/") &&
        d.meaning !== "Conceito IA" &&
        d.meaning !== "Mockup IA"
    )
    .slice(0, 4);
  const refImages = references.flatMap((reference) => {
    const data = readUpload(reference.id, reference.mime);
    if (!data) return [];
    return [
      {
        base64: data.toString("base64"),
        mediaType: reference.mime as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
        label: reference.meaning || reference.title,
      },
    ];
  });

  // Claude escreve UM prompt de imagem forte (em inglês). Se houver referências
  // enviadas, ele as ANALISA por visão e descreve produto/modelo/cenário com
  // fidelidade — assim os conceitos saem parecidos com o que foi enviado,
  // mesmo que o provedor grátis (text-to-image) não cole a foto literal.
  let imagePrompt = `${project.title}. ${project.brief}. Brand ${client.name}, ${client.industry}. Professional marketing photography, high quality.`;
  try {
    const enhanced = await generateStructured<{ imagePrompt: string }>({
      system:
        "Você é diretor(a) de arte. Escreva um prompt de geração de imagem em inglês, específico e visualmente rico (estilo, luz, composição, paleta, mood), fiel ao brief e às referências.",
      prompt: `Brief da demanda: ${project.title} — ${project.brief}\nMarca: ${client.name} (${client.industry || "n/d"})\nTom da marca: ${client.tone || "n/d"}\n${
        refImages.length
          ? `\nHá ${refImages.length} imagem(ns) de referência anexada(s) (cada uma rotulada). ANALISE-as e descreva no prompt, com fidelidade, o produto/peça (tipo, cor exata, material, detalhes) e a modelo/cenário que você VÊ, para que as imagens geradas fiquem o mais parecidas possível com as referências.`
          : ""
      }\nEscreva o campo "imagePrompt" (inglês) para gerar imagens-conceito de marketing desta demanda.`,
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["imagePrompt"],
        properties: { imagePrompt: { type: "string" } },
      },
      tier: "standard",
      maxTokens: 1500,
      images: refImages,
    });
    if (enhanced.imagePrompt?.trim()) imagePrompt = enhanced.imagePrompt.trim();
  } catch {
    // segue com o prompt base
  }

  try {
    const images = await generateConceptImages({
      prompt: imagePrompt,
      count,
      provider: settings.imageProvider,
      togetherApiKey: settings.togetherApiKey,
    });
    const saved = images.map((image, i) => {
      const deliverable = createDeliverable({
        projectId: id,
        title: `Conceito IA ${i + 1} — ${project.title.slice(0, 40)}`,
        mime: image.mime.startsWith("image/") ? image.mime : "image/jpeg",
        kind: "reference",
        meaning: "Conceito IA",
      });
      saveUpload(deliverable.id, deliverable.mime, Buffer.from(image.base64, "base64"));
      return deliverable;
    });
    return NextResponse.json(
      {
        created: saved.length,
        deliverables: saved,
        prompt: imagePrompt,
        usedReferences: refImages.length,
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao gerar conceitos." },
      { status: 502 }
    );
  }
}
