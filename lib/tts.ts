import { createHash } from "crypto";
import fs from "fs";
import path from "path";

// A voz que fala com o usuário é de IA, nunca a do navegador. ElevenLabs
// (multilingual, pt-BR natural) é a preferida; OpenAI TTS é a alternativa.
// Sem provedor configurado o app fica em silêncio e mostra o texto — de
// propósito, não cai no speechSynthesis robótico.
// Cada frase é cacheada em disco (provedor, idioma, texto): a abertura é igual
// para todo mundo e seria cobrada a cada sessão.
const CACHE_DIR = path.join(process.env.DATA_DIR ?? path.join(process.cwd(), "data"), "tts");
const ELEVEN_DEFAULT_VOICE = "EXAVITQu4vr4xnSDxMaL";

export type TtsProvider = "elevenlabs" | "openai" | null;

export function ttsProvider(): TtsProvider {
  if (process.env.AI_MOCK === "1") return null;
  if (process.env.ELEVENLABS_API_KEY) return "elevenlabs";
  if (process.env.OPENAI_API_KEY) return "openai";
  return null;
}

export async function synthesise(text: string, lang: "pt" | "en"): Promise<Buffer | null> {
  const provider = ttsProvider();
  if (!provider) return null;
  const key = createHash("sha1").update(`${provider}|${lang}|${text}`).digest("hex");
  const file = path.join(CACHE_DIR, `${key}.mp3`);
  if (fs.existsSync(file)) return fs.readFileSync(file);
  const res = provider === "elevenlabs"
    ? await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID ?? ELEVEN_DEFAULT_VOICE}?output_format=mp3_44100_128`, {
        method: "POST",
        headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY!, "Content-Type": "application/json", Accept: "audio/mpeg" },
        body: JSON.stringify({ text, model_id: "eleven_multilingual_v2", voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.2 } }),
      })
    : await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: process.env.OPENAI_TTS_MODEL ?? "gpt-4o-mini-tts", voice: lang === "pt" ? "nova" : "alloy", input: text, response_format: "mp3" }),
      });
  if (!res.ok) throw new Error(`TTS ${provider} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(file, buf);
  return buf;
}
