// Regras PURAS da "aprovação que dispara ação": dado o que o cliente aprovou,
// decide o que acontece — sem banco, sem rede. O executor (approvals-db)
// só materializa o plano. Tudo aqui é testado em isolamento.

export type ApprovalRules = {
  autoPostDraft: boolean; // peça social aprovada → rascunho de post no calendário
  notifyWhatsapp: boolean; // avisar a agência por WhatsApp (fila) quando houver canal
  notifyPhone: string; // número da agência (DDI+DDD+número, só dígitos)
  postDelayDays: number; // sugerir a publicação N dias depois da aprovação
  postHour: number; // hora sugerida (0-23)
};

export const DEFAULT_APPROVAL_RULES: ApprovalRules = {
  autoPostDraft: true,
  notifyWhatsapp: true,
  notifyPhone: "",
  postDelayDays: 2,
  postHour: 10,
};

export type ApprovalActor = "client" | "agency";
export type ApprovalDecision = "approved" | "changes_requested";

export type PlannedAction =
  | { type: "post_draft"; channel: string; scheduledFor: string; title: string; caption: string }
  | { type: "whatsapp"; to: string; body: string }
  | { type: "activity"; reason: "whatsapp_off" | "no_phone" | "not_connected" | "agency_actor" };

const SOCIAL_WORDS = [
  "post", "feed", "reels", "reel", "story", "stories", "carrossel", "carousel",
  "instagram", "tiktok", "linkedin", "facebook", "social", "conteúdo", "conteudo",
  "legenda", "caption", "youtube", "shorts",
];
const SOCIAL_SKILLS = ["social media design", "vídeo/reels", "video/reels", "motion design"];
const SOCIAL_CHANNELS = ["Instagram", "Facebook", "TikTok", "LinkedIn", "YouTube"];

function normalize(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Peça social = imagem/vídeo cuja demanda ou título fala de redes sociais.
export function isSocialPiece(
  deliverable: { title: string; mime: string },
  project: { title: string; brief: string; skillsNeeded: string[] }
): boolean {
  if (!/^(image|video)\//.test(deliverable.mime)) return false;
  if (project.skillsNeeded.some((s) => SOCIAL_SKILLS.includes(normalize(s)))) return true;
  const haystack = normalize(`${deliverable.title} ${project.title} ${project.brief}`);
  const words = haystack.split(/[^a-z0-9]+/);
  return SOCIAL_WORDS.some((w) => words.includes(normalize(w)));
}

// Canal do rascunho: o que o texto citar; senão o primeiro canal social do
// briefing; senão Instagram.
export function guessChannel(
  texts: string[],
  clientChannels: string[]
): string {
  const haystack = normalize(texts.join(" "));
  if (/\btiktok\b/.test(haystack)) return "TikTok";
  if (/\blinkedin\b/.test(haystack)) return "LinkedIn";
  if (/\bfacebook\b/.test(haystack)) return "Facebook";
  if (/\byoutube\b|\bshorts\b/.test(haystack)) return "YouTube";
  if (/\binstagram\b|\breels?\b|\bstor(y|ies)\b|\bfeed\b|\bcarrossel\b/.test(haystack)) return "Instagram";
  const fromBriefing = clientChannels.find((c) => SOCIAL_CHANNELS.includes(c));
  return fromBriefing ?? "Instagram";
}

// Sugestão de data: N dias depois, na hora configurada, no formato do input
// datetime-local usado pelo resto do app ("YYYY-MM-DDTHH:mm", hora local).
export function nextPostSlot(now: Date, delayDays: number, hour: number): string {
  const date = new Date(now.getTime());
  date.setDate(date.getDate() + Math.max(0, Math.round(delayDays)));
  date.setHours(Math.min(23, Math.max(0, Math.round(hour))), 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:00`;
}

export function whatsappBody(input: {
  clientName: string;
  deliverableTitle: string;
  projectTitle: string;
  postDraft: boolean;
  link: string;
}): string {
  return (
    `✅ ${input.clientName} aprovou "${input.deliverableTitle}" (${input.projectTitle}).` +
    (input.postDraft ? " Já deixei um rascunho de post no calendário." : "") +
    `\nAbrir: ${input.link}`
  );
}

export function planApprovalActions(input: {
  deliverable: { title: string; mime: string };
  project: { title: string; brief: string; skillsNeeded: string[] };
  client: { name: string; channels: string[] };
  rules: ApprovalRules;
  actor: ApprovalActor;
  whatsappConnected: boolean;
  link: string;
  now?: Date;
}): PlannedAction[] {
  const actions: PlannedAction[] = [];
  const social = input.rules.autoPostDraft && isSocialPiece(input.deliverable, input.project);
  if (social) {
    const channel = guessChannel(
      [input.deliverable.title, input.project.title, input.project.brief],
      input.client.channels
    );
    actions.push({
      type: "post_draft",
      channel,
      scheduledFor: nextPostSlot(input.now ?? new Date(), input.rules.postDelayDays, input.rules.postHour),
      title: input.deliverable.title,
      caption: input.project.brief.trim().slice(0, 400),
    });
  }
  if (input.actor !== "client") {
    actions.push({ type: "activity", reason: "agency_actor" });
    return actions;
  }
  const phone = input.rules.notifyPhone.replace(/\D/g, "");
  if (!input.rules.notifyWhatsapp) actions.push({ type: "activity", reason: "whatsapp_off" });
  else if (!phone) actions.push({ type: "activity", reason: "no_phone" });
  else if (!input.whatsappConnected) actions.push({ type: "activity", reason: "not_connected" });
  else {
    actions.push({
      type: "whatsapp",
      to: phone,
      body: whatsappBody({
        clientName: input.client.name,
        deliverableTitle: input.deliverable.title,
        projectTitle: input.project.title,
        postDraft: social,
        link: input.link,
      }),
    });
  }
  return actions;
}

export function sanitizeApprovalRules(input: Partial<ApprovalRules>): ApprovalRules {
  const delay = Number(input.postDelayDays);
  const hour = Number(input.postHour);
  return {
    autoPostDraft: input.autoPostDraft !== false,
    notifyWhatsapp: input.notifyWhatsapp !== false,
    notifyPhone: String(input.notifyPhone ?? "").replace(/\D/g, "").slice(0, 15),
    postDelayDays: Number.isFinite(delay) ? Math.min(30, Math.max(0, Math.round(delay))) : DEFAULT_APPROVAL_RULES.postDelayDays,
    postHour: Number.isFinite(hour) ? Math.min(23, Math.max(0, Math.round(hour))) : DEFAULT_APPROVAL_RULES.postHour,
  };
}
