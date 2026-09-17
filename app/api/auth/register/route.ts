import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createUser,
  EmailTakenError,
  emailInUse,
  homeForUser,
  isValidEmail,
  normalizeEmail,
  passwordProblem,
  setUserAgency,
  type BrandSource,
} from "@/lib/auth";
import { createAgency, deleteAgencyWorkspace, setAgencyOwner } from "@/lib/agencies";
import { HOUSE_AGENCY_ID } from "@/lib/tenancy-rules";
import { createClient, deleteClient } from "@/lib/db";
import { createProfessional, deleteProfessional } from "@/lib/marketplace-db";
import { consumeInvite, getInvite } from "@/lib/invites-db";
import { startAccount } from "@/lib/billing-db";
import { agencySelfSignupEnabled, LEGAL_VERSION } from "@/lib/legal";
import { getPlan, isBillingPeriod, isPaidPlan } from "@/lib/plans";
import { issueSession } from "@/lib/session";
import { checkLimits, clientIp, retryAfterHeader } from "@/lib/rate-limit";
import { withQuery } from "@/lib/url";

// Auto-cadastro (ou cadastro via convite) com login automático.
// - Sem token: brandSource = "platform" (vê a marca da plataforma).
// - Com token válido: papel e brandSource = "agency" (whitelabel da agência).
// - Agência sem convite cria a PRÓPRIA agência (workspace vazio, carteira e
//   plano de entrada); AGENCY_SELF_SIGNUP=false fecha isso (pedir acesso).
// - Convite: quem entra vai para a agência que convidou (agência = time).
// - Marca/profissional sem convite: marca fica na agência da casa (a
//   operação da plataforma); profissional vira freelancer do marketplace.
// - E-mail obrigatório e único; aceite dos termos gravado com data e versão.
const schema = z.object({
  role: z.enum(["client", "professional", "agency"]).optional(),
  name: z.string().trim().min(1, "Informe o nome").max(120),
  email: z.string().trim().max(200).default(""),
  password: z.string().max(200),
  token: z.string().trim().max(200).optional(),
  acceptTerms: z.boolean().optional(),
  // plano escolhido na página de preços (vai direto para o pagamento)
  plan: z.string().trim().max(40).optional(),
  period: z.string().trim().max(20).optional(),
  // honeypot: humanos não veem este campo
  website: z.string().max(200).optional(),
  // campos opcionais de perfil
  industry: z.string().trim().max(120).default(""),
  country: z.string().trim().max(60).default("Brasil"),
  professionalRole: z.enum(["fotografo", "designer"]).optional(),
  location: z.string().trim().max(120).default(""),
});

export async function POST(request: Request) {
  const verdict = checkLimits([["registerPerIp", clientIp(request)]]);
  if (!verdict.ok) {
    return NextResponse.json(
      { error: "Muitos cadastros a partir desta rede. Tente de novo mais tarde." },
      { status: 429, headers: retryAfterHeader(verdict) }
    );
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }
  const data = parsed.data;
  if (data.website) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  if (data.acceptTerms !== true) {
    return NextResponse.json({ error: "Para criar a conta, aceite os Termos de Uso e a Política de Privacidade." }, { status: 400 });
  }
  const email = normalizeEmail(data.email);
  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: "Informe um e-mail válido. Ele serve para entrar e recuperar a conta." }, { status: 400 });
  }
  const problem = passwordProblem(data.password);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  // Resolve papel e origem da marca a partir do convite (se houver)
  let role = data.role;
  let brandSource: BrandSource = "platform";
  let invitedBy: string | null = null;
  if (data.token) {
    const invite = getInvite(data.token);
    if (!invite || invite.status !== "pending" || (invite.expiresAt && invite.expiresAt < new Date().toISOString())) {
      return NextResponse.json({ error: "Convite inválido ou expirado." }, { status: 400 });
    }
    role = invite.role;
    brandSource = "agency"; // convidado por uma agência = whitelabel dela
    invitedBy = invite.agencyId || HOUSE_AGENCY_ID;
  }
  if (!role) return NextResponse.json({ error: "Escolha o tipo de conta." }, { status: 400 });
  if (role === "agency" && !data.token && !agencySelfSignupEnabled()) {
    return NextResponse.json(
      {
        error: "O cadastro de agências está por convite no momento. Peça acesso e respondemos por e-mail.",
        code: "agency_access_request",
      },
      { status: 403 }
    );
  }
  if (emailInUse(email)) {
    return NextResponse.json({ error: new EmailTakenError().message }, { status: 409 });
  }

  let refId: string | null = null;
  // Marca autônoma quando se cadastra sozinha (sem agência convidando).
  const selfServe = role === "client" && brandSource === "platform";
  // Tenant da conta nova.
  let agencyId: string | null =
    role === "agency" ? invitedBy : role === "client" ? (invitedBy ?? HOUSE_AGENCY_ID) : invitedBy;
  let createdAgency = false;
  if (role === "agency" && !agencyId) {
    agencyId = createAgency({ name: data.name, ownerUserId: null }).id;
    createdAgency = true;
  }
  if (role === "client") {
    refId = createClient({
      name: data.name,
      industry: data.industry,
      description: "",
      audience: "",
      tone: "",
      goals: "",
      budget: "",
      channels: [],
      differentials: "",
      competitors: "",
      brandColors: "",
      website: "",
      instagram: "",
      notes: "",
      capabilities: "",
      language: "pt-BR",
      source: "self",
      country: data.country || "Brasil",
      selfServe,
    }, agencyId!).id;
  } else if (role === "professional") {
    refId = createProfessional({
      name: data.name,
      role: data.professionalRole ?? "fotografo",
      email,
      phone: "",
      location: data.location,
      skills: [],
      specialties: "",
      marketFocus: "",
      bio: "",
      portfolio: [],
      priceRange: "",
      availability: "",
      employmentType: "freelancer",
    }, agencyId).id;
  }

  let created: { username: string; id: string };
  try {
    created = await createUser({
      password: data.password,
      role,
      refId,
      agencyId,
      name: data.name,
      brandSource,
      email,
      consentVersion: LEGAL_VERSION,
    });
  } catch (error) {
    // Desfaz a entidade criada acima para não deixar marca/perfil órfão.
    if (refId && role === "client") deleteClient(refId);
    if (refId && role === "professional") deleteProfessional(refId);
    if (createdAgency && agencyId) deleteAgencyWorkspace(agencyId);
    if (error instanceof EmailTakenError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }

  if (createdAgency && agencyId) {
    setAgencyOwner(agencyId, created.id);
    setUserAgency(created.id, agencyId);
  }
  if (data.token) consumeInvite(data.token, refId ?? created.id);
  // Cota do plano de entrada já na criação da conta (agência nova: carteira própria).
  if (role === "agency" && createdAgency && agencyId) startAccount("agency", agencyId);
  else if (refId) startAccount(role, refId);

  // Plano pago escolhido na página de preços → direto para o pagamento.
  const chosen = data.plan ? getPlan(data.plan) : undefined;
  const wantsCheckout = chosen && chosen.accountType === role && isPaidPlan(chosen);
  const period = isBillingPeriod(data.period) ? data.period : "monthly";
  // Marca que se cadastrou sozinha decide primeiro como quer trabalhar
  // (autônoma x com agência). Os demais vão direto pra sua home.
  const home = wantsCheckout
    ? withQuery("/plans", { plan: chosen.id, period, welcome: "1" })
    : selfServe && refId
      ? withQuery(`/portal/client/${refId}`, { welcome: "1", choose: "1" })
      : withQuery(homeForUser({ role, refId }, { selfServe }), { welcome: "1" });
  const response = NextResponse.json(
    { ok: true, home, username: created.username, role, newAgency: createdAgency },
    { status: 201 }
  );
  await issueSession(response, { id: created.id, role, refId, name: data.name, brandSource }, { selfServe, sessionVersion: 0 });
  return response;
}
