import { NextResponse } from "next/server";
import { GenerationError, generateStructured } from "@/lib/claude";
import { listClients, listGenerations } from "@/lib/db";
import {
  getProfessional,
  listAllMeetings,
  listProjects,
} from "@/lib/marketplace-db";
import { meetingRecsSchema, type MeetingRecs } from "@/lib/marketplace-schemas";

export const maxDuration = 300;

// Agenda inteligente: a IA olha o estado real de todas as contas e demandas
// e recomenda as reuniões da semana — cada uma com o porquê (reasoning).
export async function POST() {
  const clients = listClients();
  if (clients.length === 0) {
    return NextResponse.json({ error: "Nenhum cliente cadastrado ainda." }, { status: 400 });
  }

  const lines: string[] = [];
  for (const client of clients) {
    const generations = listGenerations(client.id).slice(0, 6);
    const projects = listProjects({ clientId: client.id });
    lines.push(`Cliente "${client.name}" (clientId: ${client.id}, segmento: ${client.industry || "n/d"}):`);
    lines.push(
      `  Últimos entregáveis: ${generations.map((g) => `${g.type} em ${g.createdAt.slice(0, 10)}`).join("; ") || "nenhum"}`
    );
    for (const project of projects) {
      const professional = project.professionalId
        ? getProfessional(project.professionalId)?.name
        : null;
      lines.push(
        `  Demanda "${project.title}" (projectId: ${project.id}): status ${project.status}, pagamento ${project.escrow}, profissional ${professional ?? "não vinculado"}, prazo ${project.deadline || "n/d"}`
      );
    }
  }
  const existing = listAllMeetings()
    .filter((meeting) => new Date(meeting.scheduledAt) > new Date())
    .map((meeting) => `- ${meeting.scheduledAt} · ${meeting.title} (${meeting.clientName ?? "geral"})`)
    .join("\n");

  try {
    const result = await generateStructured<MeetingRecs>({
      system:
        "Você é o gerente de contas sênior de uma agência de marketing. Você decide quais reuniões realmente valem ser feitas — poucas, com objetivo claro. Escreva como um profissional humano, direto. Responda em português do Brasil.",
      prompt: `Hoje é ${new Date().toISOString().slice(0, 10)}.

<estado_da_agencia>
${lines.join("\n")}
</estado_da_agencia>

<reunioes_ja_agendadas>
${existing || "nenhuma"}
</reunioes_ja_agendadas>

Recomende as reuniões que a agência deveria agendar para os próximos 7 dias úteis — no máximo 5, apenas as que têm motivo real (ex.: demanda parada aguardando aprovação, kit gerado e nunca apresentado ao cliente, prazo estourando, profissional sem alinhamento, conta sem contato há tempo). Não duplique reuniões já agendadas.

Para cada uma: clientId EXATO da lista; projectId EXATO se for sobre uma demanda específica (senão string vazia); título objetivo; "suggestedAt" no formato YYYY-MM-DDTHH:mm em horário comercial; participantes (quem precisa estar); e o reasoning — o motivo concreto, citando o dado que a justifica.`,
      schema: meetingRecsSchema,
      tier: "standard",
      maxTokens: 8000,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof GenerationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Erro ao recomendar reuniões." }, { status: 500 });
  }
}
