import { NextResponse } from "next/server";
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

  const parts: Record<string, unknown>[] = [];
  for (const reference of references) {
    const data = readUpload(reference.id, reference.mime);
    if (!data) continue;
    parts.push({ text: `Referência (${reference.meaning || reference.title}):` });
    parts.push({
      inline_data: { mime_type: reference.mime, data: data.toString("base64") },
    });
  }
  parts.push({
    text: `Crie um mockup fotorrealista para esta produção de marketing, compondo fielmente as referências enviadas (ex.: a modelo da referência vestindo exatamente a peça da referência de produto, no cenário indicado). Brief da produção: ${project.brief || project.title}. Marca: ${client.name} (${client.industry || "n/d"}). Mantenha rostos, corpos e produtos fiéis às fotos de referência. Imagem única, alta qualidade, enquadramento de campanha.`,
  });

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
