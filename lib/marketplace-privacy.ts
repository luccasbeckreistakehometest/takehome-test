// Regras PURAS do que cada papel vê do marketplace (sem banco).
//
// - Oportunidade aberta (demanda de qualquer agência vista por um freelancer):
//   só o necessário para decidir a candidatura. Nunca o ranking da IA
//   (matchResult), o sketch, a marca ou quem está escalado.
// - Perfil de profissional visto por uma agência que NÃO é a dona dele:
//   contato (e-mail, telefone) só depois de uma candidatura ou escala numa
//   demanda dessa agência; custo/hora (hourlyCost) nunca — é dado interno de
//   quem cadastrou.
import type { Professional, Project } from "./marketplace-types";

export type Opportunity = Pick<
  Project,
  "id" | "title" | "brief" | "skillsNeeded" | "location" | "budget" | "deadline" | "status" | "mode" | "createdAt"
> & { agencyName: string };

export function toOpportunity(project: Project, agencyName = ""): Opportunity {
  return {
    id: project.id,
    title: project.title,
    brief: project.brief,
    skillsNeeded: project.skillsNeeded,
    location: project.location,
    budget: project.budget,
    deadline: project.deadline,
    status: project.status,
    mode: project.mode,
    createdAt: project.createdAt,
    agencyName,
  };
}

// Demanda em que o profissional está escalado: tudo, menos o ranking da IA
// (que fala dos outros candidatos).
export function assignedProjectForProfessional(project: Project): Project {
  return { ...project, matchResult: "" };
}

export type ProfessionalViewer = { role: string; agencyId?: string | null; refId?: string | null };

export function professionalForViewer<T extends Professional>(
  professional: T,
  viewer: ProfessionalViewer,
  workedWithViewerAgency: boolean
): T {
  if (viewer.role === "admin") return professional;
  if (viewer.role === "professional" && viewer.refId === professional.id) return professional;
  const ownAgency =
    viewer.role === "agency" && professional.agencyId !== null && professional.agencyId === (viewer.agencyId ?? undefined);
  if (ownAgency) return professional;
  const copy: T & { hourlyCost?: unknown } = { ...professional };
  delete copy.hourlyCost;
  if (!workedWithViewerAgency) {
    copy.email = "";
    copy.phone = "";
  }
  return copy;
}
