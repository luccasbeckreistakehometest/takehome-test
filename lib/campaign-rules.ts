// Regras PURAS da campanha de 30 dias: janela de dias, encaixe dos posts nos
// buracos do calendário (sem colidir com o que já existe), hora típica por
// canal, saneamento da entrada e a fixture do AI_MOCK. Sem banco, sem IA.

import { addDays, dateKey, type CalendarPostLike } from "./calendar-utils";

export type CampaignPostDraft = {
  dayOffset: number; // 0..days-1, relativo ao início
  channel: string;
  format: string;
  title: string;
  hookType: string; // dor, prova social, bastidores, dado, pergunta, tutorial, oferta
  hook: string;
  caption: string;
  cta: string;
  imageBrief: string;
  hashtags: string[];
};

export type CampaignPlan = {
  theme: string;
  summary: string;
  weeks: { week: number; theme: string; goal: string }[];
  posts: CampaignPostDraft[];
};

export type CampaignInput = {
  goal: string;
  channels: string[];
  startDate: string; // YYYY-MM-DD
  days: number; // 7..60
  postsPerWeek: number; // 1..7
};

export const HOOK_TYPES = ["dor", "prova social", "bastidores", "dado", "pergunta", "tutorial", "oferta"] as const;

const FORMATS: Record<string, string[]> = {
  Instagram: ["Carrossel", "Reels", "Feed", "Stories"],
  Facebook: ["Feed", "Vídeo", "Carrossel"],
  TikTok: ["Vídeo curto"],
  LinkedIn: ["Texto", "Carrossel", "Vídeo"],
  YouTube: ["Shorts", "Vídeo"],
  WhatsApp: ["Mensagem", "Status"],
  "E-mail": ["Newsletter"],
  "Blog/SEO": ["Artigo"],
};

// Hora típica de melhor alcance por canal (local do cliente).
export function bestHour(channel: string): number {
  const c = channel.toLowerCase();
  if (c.includes("linkedin")) return 9;
  if (c.includes("tiktok")) return 19;
  if (c.includes("youtube")) return 17;
  if (c.includes("whatsapp")) return 10;
  if (c.includes("mail")) return 8;
  if (c.includes("blog")) return 9;
  if (c.includes("facebook")) return 12;
  return 11; // Instagram e demais
}

export function formatsFor(channel: string): string[] {
  return FORMATS[channel] ?? ["Post"];
}

export function campaignWindow(startDate: string, days: number): string[] {
  return Array.from({ length: days }, (_, i) => addDays(startDate, i));
}

export function sanitizeCampaignInput(input: Partial<CampaignInput>, fallbackChannels: string[], today: string): CampaignInput {
  const clampInt = (v: unknown, min: number, max: number, fb: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fb;
  };
  const channels = Array.from(new Set((Array.isArray(input.channels) ? input.channels : []).map((c) => String(c).trim()).filter(Boolean))).slice(0, 6);
  const start = typeof input.startDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.startDate) ? input.startDate : addDays(today, 1);
  return {
    goal: String(input.goal ?? "").trim().slice(0, 600),
    channels: channels.length ? channels : fallbackChannels.length ? fallbackChannels.slice(0, 3) : ["Instagram"],
    startDate: start,
    days: clampInt(input.days, 7, 60, 30),
    postsPerWeek: clampInt(input.postsPerWeek, 1, 7, 3),
  };
}

export type ScheduledSlot = CampaignPostDraft & { scheduledFor: string; day: string };

const pad = (n: number) => String(n).padStart(2, "0");

// Encaixa cada post na janela: dia pedido pela IA, ou o próximo dia livre
// quando já existe post do mesmo canal naquele dia (do calendário ou desta
// mesma campanha) ou o dia já tem 2 posts. Nunca antes do início; se acabar
// a janela, volta a procurar do início. Ordem dos posts preservada.
export function scheduleCampaign(input: {
  plan: CampaignPlan;
  startDate: string;
  days: number;
  existing: (CalendarPostLike & { channel: string })[];
  maxPerDay?: number;
}): ScheduledSlot[] {
  const maxPerDay = input.maxPerDay ?? 2;
  const window = campaignWindow(input.startDate, input.days);
  const perDay = new Map<string, number>();
  const channelDay = new Set<string>();
  for (const post of input.existing) {
    if (post.status === "canceled") continue;
    const day = dateKey(post.scheduledFor);
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
    channelDay.add(`${day}|${post.channel.toLowerCase()}`);
  }
  const free = (day: string, channel: string) => (perDay.get(day) ?? 0) < maxPerDay && !channelDay.has(`${day}|${channel.toLowerCase()}`);
  const out: ScheduledSlot[] = [];
  for (const post of input.plan.posts) {
    const wanted = Math.min(input.days - 1, Math.max(0, Math.round(post.dayOffset)));
    let day: string | null = null;
    for (let step = 0; step < input.days; step++) {
      const candidate = window[(wanted + step) % input.days];
      if (free(candidate, post.channel)) {
        day = candidate;
        break;
      }
    }
    if (!day) day = window[wanted]; // janela lotada: fica no dia pedido mesmo assim
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
    channelDay.add(`${day}|${post.channel.toLowerCase()}`);
    out.push({ ...post, day, scheduledFor: `${day}T${pad(bestHour(post.channel))}:00` });
  }
  return out.sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
}

// ---------- Fixture (AI_MOCK=1) ----------

export function mockCampaignPlan(input: CampaignInput & { clientName: string; lang: "pt-BR" | "en" }): CampaignPlan {
  const en = input.lang === "en";
  const total = Math.max(1, Math.round((input.days / 7) * input.postsPerWeek));
  const weeksCount = Math.ceil(input.days / 7);
  const themes = en
    ? ["Why we exist", "Proof it works", "Behind the counter", "Your turn"]
    : ["Por que existimos", "Prova de que funciona", "Por trás do balcão", "Sua vez"];
  const weeks = Array.from({ length: weeksCount }, (_, i) => ({
    week: i + 1,
    theme: themes[i % themes.length],
    goal: en ? `Week ${i + 1}: move the audience one step towards "${input.goal || "the goal"}".` : `Semana ${i + 1}: levar o público um passo mais perto de "${input.goal || "o objetivo"}".`,
  }));
  const posts: CampaignPostDraft[] = [];
  for (let i = 0; i < total; i++) {
    const channel = input.channels[i % input.channels.length];
    const formats = formatsFor(channel);
    const format = formats[Math.floor(i / input.channels.length) % formats.length];
    const hookType = HOOK_TYPES[i % HOOK_TYPES.length];
    const week = Math.min(weeksCount, Math.floor(((i * input.days) / total) / 7) + 1);
    posts.push({
      dayOffset: Math.min(input.days - 1, Math.round((i * input.days) / total)),
      channel,
      format,
      title: en ? `${weeks[week - 1].theme} · ${hookType} (${channel})` : `${weeks[week - 1].theme} · ${hookType} (${channel})`,
      hookType,
      hook: en ? `Post ${i + 1}: a ${hookType} hook for ${input.clientName}. [demo]` : `Post ${i + 1}: gancho de ${hookType} para ${input.clientName}. [demo]`,
      caption: en
        ? `${input.clientName} — ${weeks[week - 1].theme}. This is where the ${hookType} angle meets the goal "${input.goal || "grow"}". Tell us what you think in the comments. [demo]`
        : `${input.clientName} — ${weeks[week - 1].theme}. Aqui o ângulo de ${hookType} encontra o objetivo "${input.goal || "crescer"}". Conta pra gente nos comentários. [demo]`,
      cta: en ? "Message us on WhatsApp" : "Chame a gente no WhatsApp",
      imageBrief: en ? `${format} for ${channel}: real photo of the team/product, natural light, brand colours, short headline on the image.` : `${format} para ${channel}: foto real da equipe/produto, luz natural, cores da marca, título curto na imagem.`,
      hashtags: [`#${input.clientName.replace(/[^\p{L}\p{N}]/gu, "").toLowerCase() || "marca"}`, en ? "#smallbusiness" : "#negociolocal", `#${channel.replace(/[^\p{L}\p{N}]/gu, "").toLowerCase()}`],
    });
  }
  return {
    theme: en ? `30 days of ${input.clientName}: ${input.goal || "growth"}` : `30 dias de ${input.clientName}: ${input.goal || "crescimento"}`,
    summary: en
      ? `${total} posts across ${input.channels.join(", ")} in ${weeksCount} weekly themes, each week moving the audience towards the goal. [demo]`
      : `${total} posts em ${input.channels.join(", ")} em ${weeksCount} temas semanais, cada semana levando o público mais perto do objetivo. [demo]`,
    weeks,
    posts,
  };
}
