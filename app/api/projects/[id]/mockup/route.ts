import { NextResponse } from "next/server";
import { generateStructured } from "@/lib/claude";
import { getClient } from "@/lib/db";
import { createDeliverable, getProject, listDeliverables } from "@/lib/marketplace-db";
import { getSettings } from "@/lib/settings";
import { readUpload, saveUpload } from "@/lib/uploads";

export const maxDuration = 300;

type Context = { params: Promise<{ id: string }> };

// Mockup fotorrealista via Google AI (Gemini image): compõe as fotos de
// referência reais (modelo + peça + cenário) na cena descrita pelo brief.
// Requer a chave do Google AI Studio salva em Configurações.
export async function POST(_request: Request, { params }: Context) {
  const { id } = await params;
  const googleKey = getSettings().googleAiApiKey;
  if (!googleKey) {
    return NextResponse.json(
      {
        error:
          "Configure a chave do Google AI em Configurações → Chaves de API (crie em aistudio.google.com → Get API key; começa com AIza).",
      },
      { status: 400 }
    );
  }
  const project = getProject(id);
  const client = project ? getClient(project.clientId) : null;
  if (!project || !client) {
    return NextResponse.json({ error: "Demanda não encontrada" }, { status: 404 });
  }
  const references = listDeliverables(id)
    .filter((d) => d.kind === "reference" && d.mime.startsWith("image/"))
    .slice(0, 3);
  if (references.length === 0) {
    return NextResponse.json(
      { error: "Envie ao menos uma foto de referência (modelo/produto) primeiro." },
      { status: 400 }
    );
  }

  const images = references.flatMap((reference) => {
    const data = readUpload(reference.id, reference.mime);
    if (!data) return [];
    return [
      {
        base64: data.toString("base64"),
        mediaType: reference.mime as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
        label: reference.meaning || reference.title,
        mime: reference.mime,
      },
    ];
  });

  // Etapa 1 — a Claude ANALISA as imagens de referência (o que é a peça,
  // como é a modelo, cores, caimento, cenário) e escreve o prompt exato de
  // geração; a imagem final sai fiel ao que foi enviado.
  let imagePrompt = `Photorealistic marketing mockup faithfully composing the reference photos (the model from the reference wearing exactly the product piece from the reference). Production brief: ${project.brief || project.title}. Brand: ${client.name}. Keep faces, bodies and products faithful to the reference photos. Single high-quality campaign-framing image.`;
  try {
    const analysis = await generateStructured<{ imagePrompt: string }>({
      system:
        "Você é diretor(a) de arte. Analise as imagens de referência e escreva, em inglês, um prompt de geração de imagem extremamente específico e fiel a elas.",
      prompt: `Analise as imagens de referência (cada uma rotulada com seu papel) e o brief abaixo, e escreva UM prompt de geração de imagem (em inglês, campo "imagePrompt") para compor o mockup fotorrealista final. Descreva com precisão o que você VÊ nas referências: a peça (tipo, cor exata, tecido, recortes, detalhes), a modelo (aparência, cabelo, tom de pele, pose desejada), o cenário e a luz — e como devem ser combinados conforme o brief. Instrua a manter a peça e a modelo fiéis às fotos.

Brief da produção: ${project.brief || project.title}
Marca: ${client.name} (${client.industry || "n/d"})`,
      schema: {
        type: "object",
        properties: { imagePrompt: { type: "string" } },
        required: ["imagePrompt"],
        additionalProperties: false,
      },
      tier: "standard",
      maxTokens: 4000,
      images: images.map(({ base64, mediaType, label }) => ({ base64, mediaType, label })),
    });
    if (analysis.imagePrompt?.trim()) imagePrompt = analysis.imagePrompt.trim();
  } catch {
    // análise falhou: segue com o prompt padrão
  }

  // Etapa 2 — Gemini compõe a imagem com as referências + prompt analisado
  const parts: Record<string, unknown>[] = [];
  for (const image of images) {
    parts.push({ text: `Reference (${image.label}):` });
    parts.push({ inline_data: { mime_type: image.mime, data: image.base64 } });
  }
  parts.push({ text: imagePrompt });

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${encodeURIComponent(googleKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts }] }),
      }
    );
    const payload = await response.json();
    if (!response.ok) {
      return NextResponse.json(
        {
          error: `Google AI: ${payload?.error?.message ?? `erro ${response.status}`}`,
        },
        { status: 502 }
      );
    }
    type Part = {
      inline_data?: { mime_type?: string; data?: string };
      inlineData?: { mimeType?: string; data?: string };
    };
    const outParts: Part[] = payload?.candidates?.[0]?.content?.parts ?? [];
    const imagePart = outParts.find((part) => part.inline_data?.data || part.inlineData?.data);
    const base64 = imagePart?.inline_data?.data ?? imagePart?.inlineData?.data;
    const mime =
      imagePart?.inline_data?.mime_type ?? imagePart?.inlineData?.mimeType ?? "image/png";
    if (!base64) {
      return NextResponse.json(
        { error: "O Google AI não retornou imagem — tente novamente." },
        { status: 502 }
      );
    }
    const deliverable = createDeliverable({
      projectId: id,
      title: `Mockup IA — ${project.title.slice(0, 50)}`,
      mime: mime.startsWith("image/") ? mime : "image/png",
      kind: "reference",
      meaning: "Mockup IA",
    });
    saveUpload(deliverable.id, deliverable.mime, Buffer.from(base64, "base64"));
    return NextResponse.json(deliverable, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Falha ao chamar o Google AI. Verifique a chave e tente de novo." },
      { status: 502 }
    );
  }
}
