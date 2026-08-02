import { NextResponse } from "next/server";
import { GenerationError, generateStructured } from "@/lib/claude";
import { getClient, listGenerations } from "@/lib/db";
import { getProject, listDeliverables, updateProject } from "@/lib/marketplace-db";
import { sketchSchema, type SketchResult } from "@/lib/marketplace-schemas";
import { clientContext } from "@/lib/prompts";
import { readUpload, type AllowedImageMime } from "@/lib/uploads";

export const maxDuration = 300;

type Context = { params: Promise<{ id: string }> };

// Sketch de referência por IA: um rafe visual (SVG) da composição esperada.
// Quando a demanda tem fotos de referência (modelo, produto, equipe...), a IA
// as analisa e desenha o sketch EM CIMA delas — pose real, forma real da peça,
// cena real — e recomenda quais referências ainda faltam.
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

  // Fotos de referência anexadas à demanda (máx. 4, mais recentes primeiro)
  const references = listDeliverables(id)
    .filter(
      (deliverable) =>
        deliverable.kind === "reference" && deliverable.mime.startsWith("image/")
    )
    .slice(0, 4);
  const images = references.flatMap((reference) => {
    const data = readUpload(reference.id, reference.mime);
    if (!data) return [];
    return [
      {
        base64: data.toString("base64"),
        mediaType: reference.mime as AllowedImageMime,
        label: `referência "${reference.meaning || reference.title}"`,
      },
    ];
  });

  const referenceInstructions = images.length
    ? `Você recebeu ${images.length} foto(s) de referência, cada uma identificada pelo seu significado (modelo, produto/peça, equipe, local...). O sketch DEVE ser construído a partir delas:
- Analise cada foto: pose e físico da modelo, forma/caimento/detalhes da peça, composição da equipe, características do local.
- Desenhe as figuras do sketch reproduzindo o que está nas fotos (a silhueta da modelo na pose desejada VESTINDO a peça da foto de produto; a equipe posicionada na cena; etc.) — em traço de rafe, mas fiel às referências.
- Rotule cada elemento no SVG com o significado da referência correspondente (ex.: "modelo (ref. 1)", "peça (ref. 2)").
- No campo "neededReferences": liste apenas o que AINDA faltaria para um sketch mais fiel (vazio se as referências bastam).`
    : `Nenhuma foto de referência foi enviada ainda. Desenhe o sketch com figuras genéricas E, no campo "neededReferences", liste objetivamente quais fotos a agência deve subir na seção Referências da demanda para o próximo sketch sair fiel (ex.: "foto da peça em fundo neutro, frente e costas", "foto da modelo de corpo inteiro", "foto do local/quadra"). Seja específico para ESTA demanda.`;

  try {
    const result = await generateStructured<SketchResult>({
      system:
        "Você é diretor(a) de arte sênior de uma agência. Você desenha rafes/sketches de composição que comunicam exatamente o que o profissional deve produzir — enquadramento, hierarquia, posição dos elementos — sem pretensão de arte final. Quando há fotos de referência, seu sketch é fiel a elas. Responda em português do Brasil.",
      prompt: `${clientContext(client)}
${identity ? `\n<identidade_visual>\n${identity.content.slice(0, 2500)}\n</identidade_visual>` : ""}

<demanda>
Título: ${project.title}
Brief: ${project.brief || "n/d"}
Skills: ${project.skillsNeeded.join(", ") || "n/d"}
</demanda>

${referenceInstructions}

Crie o sketch de referência desta demanda como um SVG (viewBox="0 0 800 1000", formato retrato 4:5 de post; use paisagem 0 0 1000 750 se o brief pedir horizontal).

Regras do sketch:
- É um RAFE de direção de arte: formas e silhuetas limpas — não arte final, mas fiel às referências quando existirem.
- Marque as áreas principais: figuras/produto (silhuetas com contorno), zona de headline/texto (retângulos com <text> indicando o conteúdo), logo, CTA, respiro.
- Use as cores da identidade do cliente como base do esquema, com contorno cinza para elementos estruturais.
- Adicione anotações curtas em <text> (estilo nota de diretor de arte: "luz natural da esquerda", "peça em destaque, 60% do quadro"...) apontando para as áreas com linhas finas.
- SVG autocontido e válido: sem imagens externas, sem scripts; fontes genéricas (sans-serif).
- No campo "rationale", explique em 1 parágrafo as escolhas de composição para o profissional, citando as referências usadas.`,
      schema: sketchSchema,
      maxTokens: 16000,
      images,
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
