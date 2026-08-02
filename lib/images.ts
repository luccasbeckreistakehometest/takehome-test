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

export type ImageProvider = "huggingface" | "together" | "pollinations";

export type GeneratedImage = { base64: string; mime: string };

// Reforço de qualidade aplicado a todo prompt de conceito — empurra o modelo
// para foto comercial limpa e clara (o default costuma sair escuro/ruidoso).
const QUALITY_SUFFIX =
  ", professional commercial photography, sharp focus, high detail, natural realistic lighting, clean composition, 8k, high quality, correct anatomy";

function withQuality(prompt: string): string {
  return prompt.includes("commercial photography") ? prompt : prompt + QUALITY_SUFFIX;
}

async function fromPollinations(
  prompt: string,
  seed: number
): Promise<GeneratedImage> {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(
    withQuality(prompt)
  )}?width=1024&height=1024&seed=${seed}&nologo=true&model=flux`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Pollinations ${res.status}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  const mime = res.headers.get("content-type") || "image/jpeg";
  return { base64: buffer.toString("base64"), mime };
}

// Hugging Face Inference — FLUX.1-dev: a MELHOR qualidade no free tier
// (anatomia e nitidez superiores ao schnell). Requer token gratuito do HF.
// Pode responder 503 no cold start do modelo — tratamos com espera + retry.
async function fromHuggingFace(
  prompt: string,
  apiKey: string,
  seed: number
): Promise<GeneratedImage> {
  const call = () =>
    fetch(
      "https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-dev",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "image/png",
        },
        body: JSON.stringify({
          inputs: withQuality(prompt),
          parameters: { seed, width: 1024, height: 1024 },
        }),
      }
    );
  let res = await call();
  if (res.status === 503) {
    // modelo carregando: espera e tenta de novo uma vez
    await new Promise((r) => setTimeout(r, 8000));
    res = await call();
  }
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`HuggingFace ${res.status}: ${detail.slice(0, 160)}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  const mime = res.headers.get("content-type") || "image/png";
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
      prompt: withQuality(prompt),
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
  hfApiKey?: string;
}): Promise<GeneratedImage[]> {
  const { prompt, provider } = options;
  const count = Math.max(1, Math.min(options.count, 6));
  const seeds = Array.from({ length: count }, (_, i) => 1000 + i * 7919);

  if (provider === "huggingface") {
    if (!options.hfApiKey) {
      throw new Error(
        "Configure a Hugging Face API Key em Configurações (huggingface.co → Settings → Access Tokens, grátis)."
      );
    }
    // FLUX.1-dev no HF free é serial e pode ter cold start — geramos em série.
    const out: GeneratedImage[] = [];
    for (const seed of seeds) {
      try {
        out.push(await fromHuggingFace(prompt, options.hfApiKey, seed));
      } catch {
        // pula falha individual
      }
    }
    if (out.length === 0) {
      throw new Error(
        "Hugging Face não gerou imagens (cold start/limite). Tente de novo em 1 min ou use Together/Pollinations."
      );
    }
    return out;
  }

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
