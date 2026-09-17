import { NextResponse } from "next/server";
import { getSession } from "./session";
import type { SessionPayload } from "./auth-shared";
import { clientAgencyId, getGeneration } from "./db";
import {
  getApplication,
  getClientAsset,
  getDeliverable,
  getProfessional,
  getProject,
  getProspect,
  professionalWorkedWith,
} from "./marketplace-db";
import {
  adminScope,
  HOUSE_AGENCY_ID,
  NO_AGENCY,
  inScope,
  professionalEditableBy,
  professionalVisibleTo,
  scopeForSession,
  type TenantScope,
} from "./tenancy-rules";

export type Role = SessionPayload["role"];

// Guarda de papel para as rotas de API. O middleware barra (por padrão)
// cliente e profissional fora das rotas dos portais; aqui a rota declara QUEM
// pode chamar e checa a posse do recurso.
//
// Multi-tenant: quando a rota passa `clientId`, a marca precisa ser da
// agência da sessão (agência de outro tenant recebe 404 — nem a existência
// vaza). `agencyId` faz o mesmo para recursos sem cliente (prospect, contato,
// reunião...). Admin passa sempre.
//
// Uso:
//   const auth = await guard(["agency", "admin"]);
//   if (isDenied(auth)) return auth;
export async function guard(
  roles: Role[],
  opts: {
    clientId?: string | null;
    professionalId?: string | null;
    selfServe?: boolean;
    agencyId?: string | null;
  } = {}
): Promise<SessionPayload | NextResponse> {
  const session = await getSession();
  if (!session) return unauthorized();
  // Senha provisória (vista por quem criou o login): nada além de Minha conta
  // até a troca (as rotas de conta não usam guard).
  if (session.mustChangePassword) return mustChangePassword();
  if (!roles.includes(session.role)) return forbidden();
  if (session.role === "client") {
    if (opts.clientId !== undefined && session.refId !== opts.clientId) return forbidden();
    if (opts.selfServe && !session.selfServe) return forbidden();
  }
  if (session.role === "professional" && opts.professionalId !== undefined && session.refId !== opts.professionalId) {
    return forbidden();
  }
  const scope = scopeForSession(session);
  if (opts.clientId !== undefined) {
    if (!opts.clientId) return notFound("Cliente não encontrado");
    const owner = clientAgencyId(opts.clientId);
    if (owner === null && session.role !== "admin") return notFound("Cliente não encontrado");
    if (owner !== null && !inScope(scope, owner)) return notFound("Cliente não encontrado");
  }
  if (opts.agencyId !== undefined && !inScope(scope, opts.agencyId)) return notFound();
  return session;
}

// Escopo de leitura da sessão. Admin = todas as agências, ou a do filtro
// ?agency= quando a rota recebe o request (painel do admin).
export function tenantOf(session: SessionPayload, request?: Request): TenantScope {
  if (session.role === "admin" && request) return adminScope(new URL(request.url).searchParams.get("agency"));
  return scopeForSession(session);
}

// Agência em nome de quem a sessão age (configurações, criação). Admin age na
// agência do filtro ?agency= (ou na da casa).
export function actingAgencyId(session: SessionPayload, request?: Request): string {
  if (session.role === "admin") {
    const wanted = request ? (new URL(request.url).searchParams.get("agency") ?? "").trim() : "";
    return wanted || HOUSE_AGENCY_ID;
  }
  return session.agencyId ?? NO_AGENCY;
}

// Agência que recebe o que a sessão cria. Admin cria na agência pedida (ou
// na da casa); os demais, sempre na própria.
export function writeAgencyId(session: SessionPayload, requested?: string | null): string | null {
  if (session.role === "admin") return requested || null;
  return session.agencyId ?? null;
}

export function isDenied<T>(auth: T | NextResponse): auth is NextResponse {
  return auth instanceof NextResponse;
}

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
}

export const MUST_CHANGE_PASSWORD = "Troque a senha provisória em Minha conta para continuar.";
export function mustChangePassword(): NextResponse {
  return NextResponse.json({ error: MUST_CHANGE_PASSWORD, code: "must_change_password" }, { status: 403 });
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
  // Só agência/admin — e a marca precisa ser da agência da sessão.
  if (access === "agency") return guard(["agency", "admin"], { clientId });
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

// Prospect: só a agência dona (ou o admin).
export async function guardProspect(prospectId: string) {
  const prospect = getProspect(prospectId);
  if (!prospect) return notFound("Prospect não encontrado");
  const auth = await guard(["agency", "admin"], { agencyId: prospect.agencyId });
  return isDenied(auth) ? auth : { session: auth, prospect };
}

// Perfil do profissional: ele mesmo, o admin, ou uma agência que o enxerga
// (os dela, os do marketplace aberto e os que já trabalharam/se candidataram
// em demandas dela). `edit` = só a agência dona (ou ele mesmo/admin).
export async function guardProfessional(professionalId: string, access: "view" | "edit" = "view") {
  const professional = getProfessional(professionalId);
  if (!professional) return notFound("Profissional não encontrado");
  const auth = await guard(["agency", "admin", "professional"], { professionalId });
  if (isDenied(auth) || auth.role !== "agency") return auth;
  const scope = scopeForSession(auth);
  const allowed =
    access === "edit"
      ? professionalEditableBy(scope, professional)
      : professionalVisibleTo(scope, professional, professionalWorkedWith(professionalId, auth.agencyId ?? ""));
  return allowed ? auth : notFound("Profissional não encontrado");
}

export function clientExists(clientId: string): boolean {
  return clientAgencyId(clientId) !== null;
}

// A marca age em nome próprio: o "autor" vem da sessão, nunca do corpo.
export function actorRole(session: SessionPayload): "agency" | "client" | "professional" {
  if (session.role === "client") return "client";
  if (session.role === "professional") return "professional";
  return "agency";
}
