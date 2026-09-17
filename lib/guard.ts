import { NextResponse } from "next/server";
import { getSession } from "./session";
import type { SessionPayload } from "./auth-shared";
import { getClient, getGeneration } from "./db";
import {
  getApplication,
  getClientAsset,
  getDeliverable,
  getProfessional,
  getProject,
} from "./marketplace-db";

export type Role = SessionPayload["role"];

// Guarda de papel para as rotas de API. O middleware barra (por padrão)
// cliente e profissional fora das rotas dos portais; aqui a rota declara QUEM
// pode chamar e checa a posse do recurso.
//
// Uso:
//   const auth = await guard(["agency", "admin"]);
//   if (isDenied(auth)) return auth;
export async function guard(
  roles: Role[],
  opts: { clientId?: string | null; professionalId?: string | null; selfServe?: boolean } = {}
): Promise<SessionPayload | NextResponse> {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!roles.includes(session.role)) return forbidden();
  if (session.role === "client") {
    if (opts.clientId !== undefined && session.refId !== opts.clientId) return forbidden();
    if (opts.selfServe && !session.selfServe) return forbidden();
  }
  if (session.role === "professional" && opts.professionalId !== undefined && session.refId !== opts.professionalId) {
    return forbidden();
  }
  return session;
}

export function isDenied<T>(auth: T | NextResponse): auth is NextResponse {
  return auth instanceof NextResponse;
}

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
}

export function forbidden(): NextResponse {
  return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
}

export function notFound(message = "Não encontrado"): NextResponse {
  return NextResponse.json({ error: message }, { status: 404 });
}

// Só a agência (e o admin da plataforma).
export function agencyOnly(): Promise<SessionPayload | NextResponse> {
  return guard(["agency", "admin"]);
}

// Níveis de acesso de uma marca aos dados dela:
//  - "view":      ler (portal gerenciado ou workspace próprio)
//  - "portal":    agir pelo portal (aprovar, comentar, pedir, avaliar)
//  - "workspace": operar o workspace (IA, edição) — só marca autônoma
//  - "agency":    só agência/admin
export type ClientAccess = "view" | "portal" | "workspace" | "agency";

export async function guardClient(
  clientId: string | null | undefined,
  access: ClientAccess
): Promise<SessionPayload | NextResponse> {
  if (!clientId) return notFound("Cliente não encontrado");
  if (access === "agency") return agencyOnly();
  return guard(["agency", "admin", "client"], {
    clientId,
    selfServe: access === "workspace",
  });
}

// Recursos ligados a um cliente: resolve o dono antes de checar.
export async function guardProject(projectId: string, access: ClientAccess) {
  const project = getProject(projectId);
  if (!project) return notFound("Demanda não encontrada");
  const auth = await guardClient(project.clientId, access);
  return isDenied(auth) ? auth : { session: auth, project };
}

export async function guardDeliverable(deliverableId: string, access: ClientAccess) {
  const deliverable = getDeliverable(deliverableId);
  if (!deliverable) return notFound("Entrega não encontrada");
  const project = getProject(deliverable.projectId);
  if (!project) return notFound("Entrega não encontrada");
  const auth = await guardClient(project.clientId, access);
  return isDenied(auth) ? auth : { session: auth, deliverable, project };
}

export async function guardGeneration(generationId: string, access: ClientAccess) {
  const generation = getGeneration(generationId);
  if (!generation) return notFound("Geração não encontrada");
  const auth = await guardClient(generation.clientId, access);
  return isDenied(auth) ? auth : { session: auth, generation };
}

export async function guardClientAsset(assetId: string, access: ClientAccess) {
  const asset = getClientAsset(assetId);
  if (!asset) return notFound("Arquivo não encontrado");
  const auth = await guardClient(asset.clientId, access);
  return isDenied(auth) ? auth : { session: auth, asset };
}

export async function guardApplication(applicationId: string, access: ClientAccess) {
  const application = getApplication(applicationId);
  if (!application) return notFound("Candidatura não encontrada");
  const project = getProject(application.projectId);
  if (!project) return notFound("Candidatura não encontrada");
  const auth = await guardClient(project.clientId, access);
  return isDenied(auth) ? auth : { session: auth, application, project };
}

// Perfil do profissional: ele mesmo ou a agência/admin.
export async function guardProfessional(professionalId: string) {
  if (!getProfessional(professionalId)) return notFound("Profissional não encontrado");
  return guard(["agency", "admin", "professional"], { professionalId });
}

export function clientExists(clientId: string): boolean {
  return Boolean(getClient(clientId));
}

// A marca age em nome próprio: o "autor" vem da sessão, nunca do corpo.
export function actorRole(session: SessionPayload): "agency" | "client" | "professional" {
  if (session.role === "client") return "client";
  if (session.role === "professional") return "professional";
  return "agency";
}
