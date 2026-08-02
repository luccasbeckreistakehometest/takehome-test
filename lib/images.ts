// Geração de imagens por TEXTO (text-to-image), com provedores gratuitos que
// geram VÁRIAS imagens — para conceitos, moodboards e demos.
//
// IMPORTANTE — diferença dos dois usos de imagem no produto:
//  • Conceito (aqui): texto → imagem. Ótimo para gerar muitas variações de
//    ideia sem custo. Não "cola" um produto/modelo real na cena.
//  • Mockup fiel (rota /mockup, Gemini): imagem+imagem → compõe a foto real
//    do produto/modelo enviada. Isso exige Gemini/provedor pago; nenhum free
//    text-to-image faz composição fiel de fotos reais.
//
// Provedores:
//  • pollinations — SEM chave, ilimitado o suficiente para testar/mostrar.
//    Cada seed diferente gera uma imagem diferente do mesmo prompt.
//  • together — Together AI, modelo FLUX.1-schnell-Free (grátis, alta
//    qualidade). Requer TOGETHER_API_KEY salva em Configurações.

export type ImageProvider = "pollinations" | "together";

export type GeneratedImage = { base64: string; mime: string };

async function fromPollinations(
  prompt: string,
  seed: number
): Promise<GeneratedImage> {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(
    prompt
  )}?width=1024&height=1024&seed=${seed}&nologo=true&model=flux`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Pollinations ${res.status}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  const mime = res.headers.get("content-type") || "image/jpeg";
  return { base64: buffer.toString("base64"), mime };
}

async function fromTogether(
  prompt: string,
  apiKey: string,
  seed: number
): Promise<GeneratedImage> {
  const res = await fetch("https://api.together.xyz/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "black-forest-labs/FLUX.1-schnell-Free",
      prompt,
      width: 1024,
      height: 1024,
      steps: 4,
      n: 1,
      seed,
      response_format: "b64_json",
    }),
  });
  const payload = await res.json();
  if (!res.ok) {
    throw new Error(
      `Together ${res.status}: ${payload?.error?.message ?? "erro"}`
    );
  }
  const b64 = payload?.data?.[0]?.b64_json as string | undefined;
  if (!b64) throw new Error("Together não retornou imagem");
  return { base64: b64, mime: "image/jpeg" };
}

// Gera `count` variações do mesmo prompt (seeds diferentes). Falhas
// individuais são ignoradas — retorna o que conseguiu gerar.
export async function generateConceptImages(options: {
  prompt: string;
  count: number;
  provider: ImageProvider;
  togetherApiKey?: string;
}): Promise<GeneratedImage[]> {
  const { prompt, provider } = options;
  const count = Math.max(1, Math.min(options.count, 6));
  const seeds = Array.from({ length: count }, (_, i) => 1000 + i * 7919);

  if (provider === "together") {
    if (!options.togetherApiKey) {
      throw new Error(
        "Configure a Together API Key em Configurações (together.ai → free FLUX)."
      );
    }
    // Together grátis costuma limitar concorrência: geramos em série.
    const out: GeneratedImage[] = [];
    for (const seed of seeds) {
      try {
        out.push(await fromTogether(prompt, options.togetherApiKey, seed));
      } catch {
        // pula falha individual (rate-limit momentâneo)
      }
    }
    if (out.length === 0) {
      throw new Error(
        "Together não gerou imagens — limite atingido. Tente Pollinations."
      );
    }
    return out;
  }

  // Pollinations: paraleliza, sem chave
  const results = await Promise.allSettled(
    seeds.map((seed) => fromPollinations(prompt, seed))
  );
  const out = results
    .filter((r): r is PromiseFulfilledResult<GeneratedImage> => r.status === "fulfilled")
    .map((r) => r.value);
  if (out.length === 0) {
    throw new Error("Nenhuma imagem gerada — tente novamente em instantes.");
  }
  return out;
}
