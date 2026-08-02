import { NextResponse } from "next/server";
import { GenerationError, generateStructured } from "@/lib/claude";
import { getClient, listGenerations } from "@/lib/db";
import { getProject, updateProject } from "@/lib/marketplace-db";
import { sketchSchema, type SketchResult } from "@/lib/marketplace-schemas";
import { clientContext } from "@/lib/prompts";

export const maxDuration = 300;

type Context = { params: Promise<{ id: string }> };

// Sketch de referência por IA: um rafe visual (SVG) da composição esperada,
// para a agência anexar à demanda e o profissional executar sem ambiguidade.
export async function POST(_request: Request, { params }: Context) {
  const { id } = await params;
  const project = getProject(id);
  if (!project) {
    return NextResponse.json({ error: "Demanda não encontrada" }, { status: 404 });
  }
  const client = getClient(project.clientId);
  if (!client) {
    return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }
  const identity = listGenerations(project.clientId, "visual_identity")[0];

  try {
    const result = await generateStructured<SketchResult>({
      system:
        "Você é diretor(a) de arte sênior de uma agência. Você desenha rafes/sketches de composição que comunicam exatamente o que o profissional deve produzir — enquadramento, hierarquia, posição dos elementos — sem pretensão de arte final. Responda em português do Brasil.",
      prompt: `${clientContext(client)}
${identity ? `\n<identidade_visual>\n${identity.content.slice(0, 2500)}\n</identidade_visual>` : ""}

<demanda>
Título: ${project.title}
Brief: ${project.brief || "n/d"}
Skills: ${project.skillsNeeded.join(", ") || "n/d"}
</demanda>

Crie o sketch de referência desta demanda como um SVG (viewBox="0 0 800 1000", formato retrato 4:5 de post; use paisagem 0 0 1000 750 se o brief pedir horizontal).

Regras do sketch:
- É um RAFE de direção de arte: formas simples, wireframe da composição — não arte final.
- Marque as áreas principais: onde fica o produto/pessoa (forma com contorno), zona de headline/texto (retângulos com <text> indicando o conteúdo), logo, CTA, respiro.
- Use as cores da identidade do cliente como base do esquema (fundos e destaques), com contorno cinza para elementos estruturais.
- Adicione anotações curtas em <text> (estilo nota de diretor de arte: "luz natural vindo da esquerda", "produto ocupa 60% do quadro"...) apontando para as áreas com linhas finas.
- SVG autocontido e válido: sem imagens externas, sem scripts; fontes genéricas (sans-serif).
- No campo "rationale", explique em 1 parágrafo as escolhas de composição para o profissional.`,
      schema: sketchSchema,
      maxTokens: 16000,
    });

    updateProject(id, { sketch: JSON.stringify(result) });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof GenerationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Erro ao gerar o sketch." }, { status: 500 });
  }
}
