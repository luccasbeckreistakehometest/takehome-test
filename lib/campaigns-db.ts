import { randomUUID } from "crypto";
import { db, tenantColumn } from "./db";
import { createScheduledPost, deleteScheduledPost, listClientScheduledPosts, updateScheduledPost, type ScheduledPost } from "./marketplace-db";
import { scheduleCampaign, type CampaignInput, type CampaignPlan } from "./campaign-rules";

// Campanha de 30 dias: o plano gerado + os posts inseridos como rascunho no
// calendário, com uma tela de revisão para aceitar (agendar) ou pular
// (remover) cada um.

export type Campaign = {
  id: string;
  clientId: string;
  goal: string;
  channels: string[];
  startDate: string;
  days: number;
  postsPerWeek: number;
  theme: string;
  summary: string;
  weeks: CampaignPlan["weeks"];
  status: "review" | "done";
  demo: boolean;
  createdAt: string;
};

db.exec(`
  CREATE TABLE IF NOT EXISTS campaigns (
    id TEXT PRIMARY KEY,
    clientId TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    goal TEXT NOT NULL DEFAULT '',
    channels TEXT NOT NULL DEFAULT '[]',
    startDate TEXT NOT NULL,
    days INTEGER NOT NULL DEFAULT 30,
    postsPerWeek INTEGER NOT NULL DEFAULT 3,
    theme TEXT NOT NULL DEFAULT '',
    summary TEXT NOT NULL DEFAULT '',
    weeks TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'review',
    demo INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_campaigns_client ON campaigns(clientId, createdAt);
`);
tenantColumn("campaigns");

type Row = Omit<Campaign, "channels" | "weeks" | "demo"> & { channels: string; weeks: string; demo: number };
const toCampaign = (row: Row): Campaign => ({
  ...row,
  channels: JSON.parse(row.channels),
  weeks: JSON.parse(row.weeks),
  status: row.status === "done" ? "done" : "review",
  demo: row.demo === 1,
});

// Materializa o plano: encaixa nos buracos do calendário do cliente e insere
// cada post como rascunho ligado à campanha.
export function createCampaignFromPlan(input: { clientId: string; input: CampaignInput; plan: CampaignPlan; demo: boolean }): { campaign: Campaign; posts: ScheduledPost[] } {
  const existing = listClientScheduledPosts(input.clientId).map((p) => ({ id: p.id, scheduledFor: p.scheduledFor, status: p.status, channel: p.channel }));
  const slots = scheduleCampaign({ plan: input.plan, startDate: input.input.startDate, days: input.input.days, existing });
  const campaign: Campaign = {
    id: randomUUID(),
    clientId: input.clientId,
    goal: input.input.goal,
    channels: input.input.channels,
    startDate: input.input.startDate,
    days: input.input.days,
    postsPerWeek: input.input.postsPerWeek,
    theme: input.plan.theme,
    summary: input.plan.summary,
    weeks: input.plan.weeks,
    status: "review",
    demo: input.demo,
    createdAt: new Date().toISOString(),
  };
  const posts: ScheduledPost[] = [];
  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO campaigns (id, agencyId, clientId, goal, channels, startDate, days, postsPerWeek, theme, summary, weeks, status, demo, createdAt)
       VALUES (@id, (SELECT agencyId FROM clients WHERE id = @clientId), @clientId, @goal, @channels, @startDate, @days, @postsPerWeek, @theme, @summary, @weeks, @status, @demo, @createdAt)`
    ).run({ ...campaign, channels: JSON.stringify(campaign.channels), weeks: JSON.stringify(campaign.weeks), demo: campaign.demo ? 1 : 0 });
    for (const slot of slots) {
      posts.push(
        createScheduledPost({
          clientId: input.clientId,
          title: slot.title,
          channel: slot.channel,
          caption: `${slot.caption}${slot.cta ? `\n\n${slot.cta}` : ""}`,
          hashtags: slot.hashtags,
          scheduledFor: slot.scheduledFor,
          status: "draft",
          campaignId: campaign.id,
          format: slot.format,
          hookType: slot.hookType,
          imageBrief: `${slot.hook ? `Gancho: ${slot.hook}\n` : ""}${slot.imageBrief}`,
        })
      );
    }
  });
  tx();
  return { campaign, posts };
}

export function getCampaign(id: string): Campaign | null {
  const row = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(id) as Row | undefined;
  return row ? toCampaign(row) : null;
}

export type CampaignSummary = Campaign & { total: number; drafts: number; scheduled: number; published: number };

export function listCampaigns(clientId: string): CampaignSummary[] {
  const rows = db.prepare("SELECT * FROM campaigns WHERE clientId = ? ORDER BY createdAt DESC").all(clientId) as Row[];
  return rows.map((row) => ({ ...toCampaign(row), ...campaignCounts(row.id) }));
}

function campaignCounts(campaignId: string): { total: number; drafts: number; scheduled: number; published: number } {
  const rows = db.prepare("SELECT status, COUNT(*) AS c FROM scheduled_posts WHERE campaignId = ? GROUP BY status").all(campaignId) as { status: string; c: number }[];
  const by = Object.fromEntries(rows.map((r) => [r.status, r.c]));
  return {
    total: rows.reduce((s, r) => s + r.c, 0),
    drafts: by.draft ?? 0,
    scheduled: by.scheduled ?? 0,
    published: by.published ?? 0,
  };
}

export function campaignPosts(campaignId: string): ScheduledPost[] {
  type PostRow = Omit<ScheduledPost, "hashtags"> & { hashtags: string };
  return (db.prepare("SELECT * FROM scheduled_posts WHERE campaignId = ? ORDER BY scheduledFor ASC").all(campaignId) as PostRow[]).map((r) => ({
    ...r,
    hashtags: JSON.parse(r.hashtags),
  }));
}

export function campaignReview(campaignId: string): { campaign: CampaignSummary; posts: ScheduledPost[] } | null {
  const campaign = getCampaign(campaignId);
  if (!campaign) return null;
  return { campaign: { ...campaign, ...campaignCounts(campaignId) }, posts: campaignPosts(campaignId) };
}

function refreshStatus(campaignId: string): void {
  const counts = campaignCounts(campaignId);
  db.prepare("UPDATE campaigns SET status = ? WHERE id = ?").run(counts.drafts === 0 ? "done" : "review", campaignId);
}

// Aceitar = rascunho vira agendado; pular = o rascunho sai do calendário.
export function decideCampaignPost(campaignId: string, postId: string, action: "accept" | "skip"): boolean {
  const post = campaignPosts(campaignId).find((p) => p.id === postId);
  if (!post) return false;
  if (action === "accept") {
    if (post.status === "draft") updateScheduledPost(post.id, { status: "scheduled" });
  } else {
    deleteScheduledPost(post.id);
  }
  refreshStatus(campaignId);
  return true;
}

export function acceptAllCampaignPosts(campaignId: string): number {
  let n = 0;
  for (const post of campaignPosts(campaignId)) {
    if (post.status === "draft") {
      updateScheduledPost(post.id, { status: "scheduled" });
      n++;
    }
  }
  refreshStatus(campaignId);
  return n;
}
