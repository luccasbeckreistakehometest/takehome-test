import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { pickModel } from "@/lib/claude";
import { getClient, listClients } from "@/lib/db";
import {
  createMeeting,
  createProject,
  createScheduledPost,
  listProfessionals,
  listProjects,
  logActivity,
} from "@/lib/marketplace-db";
import { getSettings } from "@/lib/settings";

export const maxDuration = 300;

// Assistente que executa: fala em linguagem natural e AGE na plataforma
// (cria demandas, agenda reuniões e posts) via tool use da Claude.
const TOOLS: Anthropic.Tool[] = [
  {
    name: "get_context",
    description:
      "Lista clientes (com id), profissionais e demandas atuais da plataforma. Chame antes de agir para obter os ids corretos.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "create_demand",
    description:
      "Cria uma demanda de produção para um cliente. Chame get_context antes para obter o clientId correto.",
    input_schema: {
      type: "object",
      properties: {
        clientId: { type: "string" },
        title: { type: "string" },
        brief: { type: "string" },
        budget: { type: "string" },
        deadline: { type: "string" },
        mode: { type: "string", enum: ["marketplace", "internal"] },
      },
      required: ["clientId", "title", "brief"],
      additionalProperties: false,
    },
  },
  {
    name: "schedule_meeting",
    description:
      "Agenda uma reunião. scheduledAt no formato YYYY-MM-DDTHH:mm. clientId opcional (reunião geral sem).",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        scheduledAt: { type: "string" },
        clientId: { type: "string" },
        notes: { type: "string" },
      },
      required: ["title", "scheduledAt"],
      additionalProperties: false,
    },
  },
  {
    name: "schedule_post",
    description:
      "Agenda um post na fila de publicação de um cliente. scheduledFor no formato YYYY-MM-DDTHH:mm.",
    input_schema: {
      type: "object",
      properties: {
        clientId: { type: "string" },
        title: { type: "string" },
        channel: { type: "string" },
        caption: { type: "string" },
        scheduledFor: { type: "string" },
      },
      required: ["clientId", "title", "channel", "caption", "scheduledFor"],
      additionalProperties: false,
    },
  },
];

function runTool(name: string, input: Record<string, string>): string {
  switch (name) {
    case "get_context": {
      const clients = listClients().map((c) => ({ id: c.id, name: c.name, industry: c.industry }));
      const professionals = listProfessionals().map((p) => ({ id: p.id, name: p.name, role: p.role }));
      const projects = listProjects({}).map((p) => ({ id: p.id, clientId: p.clientId, title: p.title, status: p.status }));
      return JSON.stringify({ clients, professionals, projects, today: new Date().toISOString().slice(0, 16) });
    }
    case "create_demand": {
      if (!getClient(input.clientId)) return JSON.stringify({ error: "clientId inexistente — chame get_context" });
      const project = createProject({
        clientId: input.clientId,
        title: input.title,
        brief: input.brief,
        skillsNeeded: [],
        location: "",
        budget: input.budget ?? "",
        deadline: input.deadline ?? "",
        mode: input.mode === "internal" ? "internal" : "marketplace",
      });
      logActivity({ audience: "agency", clientId: input.clientId, projectId: project.id, text: `🤖 Assistente criou a demanda "${project.title}"`, href: `/clients/${input.clientId}?project=${project.id}` });
      return JSON.stringify({ ok: true, projectId: project.id, href: `/clients/${input.clientId}?project=${project.id}` });
    }
    case "schedule_meeting": {
      const meeting = createMeeting({
        clientId: input.clientId || null,
        projectId: null,
        title: input.title,
        scheduledAt: input.scheduledAt,
        link: "",
        notes: input.notes ?? "",
        reasoning: "Agendada pelo assistente",
      });
      return JSON.stringify({ ok: true, meetingId: meeting.id });
    }
    case "schedule_post": {
      if (!getClient(input.clientId)) return JSON.stringify({ error: "clientId inexistente — chame get_context" });
      const post = createScheduledPost({
        clientId: input.clientId,
        title: input.title,
        channel: input.channel,
        caption: input.caption,
        hashtags: [],
        scheduledFor: input.scheduledFor,
      });
      return JSON.stringify({ ok: true, postId: post.id });
    }
    default:
      return JSON.stringify({ error: "tool desconhecida" });
  }
}

export async function POST(request: Request) {
  const parsed = z
    .object({
      messages: z.array(
        z.object({ role: z.enum(["user", "assistant"]), content: z.string() })
      ),
    })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
  }

  const key = getSettings().anthropicApiKey;
  const client = key ? new Anthropic({ apiKey: key }) : new Anthropic();
  let messages: Anthropic.MessageParam[] = parsed.data.messages;
  const actions: string[] = [];

  try {
    for (let i = 0; i < 6; i++) {
      const response = await client.messages.create({
        model: pickModel("standard"),
        max_tokens: 4000,
        system:
          "Você é o assistente operacional de uma plataforma de agência de marketing. Você EXECUTA ações via tools (criar demandas, agendar reuniões e posts) e responde em português do Brasil, direto e humano. Sempre chame get_context antes de usar ids. Datas relativas ('sábado', 'amanhã'): calcule a partir do campo today do contexto. Ao final, resuma o que fez com links quando houver.",
        tools: TOOLS,
        messages,
      });
      if (response.stop_reason !== "tool_use") {
        const text = response.content
          .filter((block): block is Anthropic.TextBlock => block.type === "text")
          .map((block) => block.text)
          .join("");
        return NextResponse.json({ reply: text, actions });
      }
      messages = [...messages, { role: "assistant", content: response.content }];
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type !== "tool_use") continue;
        const output = runTool(block.name, block.input as Record<string, string>);
        if (block.name !== "get_context") actions.push(block.name);
        results.push({ type: "tool_result", tool_use_id: block.id, content: output });
      }
      messages = [...messages, { role: "user", content: results }];
    }
    return NextResponse.json({ reply: "Cheguei ao limite de passos — tente dividir o pedido.", actions });
  } catch {
    return NextResponse.json({ error: "Erro no assistente. Verifique a chave da API." }, { status: 500 });
  }
}
