import { db, getClient } from "./db";
import { getAgency } from "./agencies";
import { getAgencyPage } from "./agency-page-db";
import { getProfessional } from "./marketplace-db";
import { recordUserEvent } from "./analytics-db";
import { activationState, markActivationLogged } from "./onboarding-db";
import {
  activationProgress,
  activationSteps,
  briefingCompleteness,
  type ActivationFacts,
  type ActivationRole,
  type ActivationStep,
} from "./activation-rules";
import type { SessionPayload } from "./auth-shared";

// Primeiros passos: fatos lidos das tabelas reais da conta (nada vem de
// cliques no checklist) e o evento activation_step uma vez por passo.

const count = (sql: string, ...args: unknown[]): number => {
  try {
    return (db.prepare(sql).get(...args) as { c: number } | undefined)?.c ?? 0;
  } catch {
    // tabela de um módulo que ainda não subiu neste processo
    return 0;
  }
};

export function activationRole(session: Pick<SessionPayload, "role" | "selfServe" | "refId">): ActivationRole | null {
  if (session.role === "agency") return "agency";
  if (session.role === "client" && session.refId) return session.selfServe ? "brand" : "managed";
  if (session.role === "professional" && session.refId) return "professional";
  return null;
}

export function activationFacts(role: ActivationRole, session: Pick<SessionPayload, "refId" | "agencyId">): ActivationFacts {
  const ref = session.refId ?? "";
  if (role === "brand") {
    const client = getClient(ref);
    return {
      briefingPct: client ? briefingCompleteness(client) : 0,
      generations: count("SELECT COUNT(*) c FROM generations WHERE clientId = ?", ref),
      scheduledPosts: count("SELECT COUNT(*) c FROM scheduled_posts WHERE clientId = ?", ref),
      carousels: count("SELECT COUNT(*) c FROM carousels WHERE clientId = ?", ref),
      reports:
        count("SELECT COUNT(*) c FROM monthly_reports WHERE clientId = ?", ref) +
        count("SELECT COUNT(*) c FROM generations WHERE clientId = ? AND type = 'client_report'", ref),
    };
  }
  if (role === "managed") {
    return {
      approvals: count("SELECT COUNT(*) c FROM approval_events WHERE clientId = ? AND actor = 'client'", ref),
      requests: count("SELECT COUNT(*) c FROM scope_requests WHERE clientId = ?", ref),
      invoicesSeen: count("SELECT COUNT(*) c FROM client_invoices WHERE clientId = ? AND (openedAt IS NOT NULL OR paidClaimedAt IS NOT NULL)", ref),
      messagesSent: count("SELECT COUNT(*) c FROM account_messages WHERE clientId = ? AND sender = 'client'", ref),
      pulseAnswers: count("SELECT COUNT(*) c FROM client_pulses WHERE clientId = ?", ref),
    };
  }
  if (role === "professional") {
    const pro = getProfessional(ref);
    return {
      profileComplete: Boolean(pro && pro.bio.trim().length >= 20 && pro.skills.length > 0 && pro.location.trim()),
      portfolioAssets: count("SELECT COUNT(*) c FROM professional_assets WHERE professionalId = ?", ref) + (pro?.portfolio.length ?? 0),
      applications: count("SELECT COUNT(*) c FROM applications WHERE professionalId = ?", ref),
      deliveries: count(
        "SELECT COUNT(*) c FROM deliverables d JOIN projects p ON p.id = d.projectId WHERE p.professionalId = ? AND d.kind = 'delivery'",
        ref
      ),
    };
  }
  const agencyId = session.agencyId ?? "";
  const agency = getAgency(agencyId);
  return {
    clients: count("SELECT COUNT(*) c FROM clients WHERE agencyId = ?", agencyId),
    brandingSet: Boolean(agency && (agency.logoMime || agency.tagline.trim() || agency.accentColor.toLowerCase() !== "#f76b15")),
    packages: count("SELECT COUNT(*) c FROM client_packages WHERE agencyId = ?", agencyId),
    pagePublished: agency ? getAgencyPage(agencyId).published : false,
    invites: count("SELECT COUNT(*) c FROM invites WHERE agencyId = ?", agencyId),
  };
}

export type ActivationPayload = {
  role: ActivationRole;
  steps: ActivationStep[];
  progress: ReturnType<typeof activationProgress>;
  dismissed: boolean;
};

export function activationFor(session: SessionPayload): ActivationPayload | null {
  const role = activationRole(session);
  if (!role) return null;
  const ids = role === "professional" ? { professionalId: session.refId ?? undefined } : { clientId: session.refId ?? undefined };
  const steps = activationSteps(role, activationFacts(role, session), ids);
  const progress = activationProgress(steps);
  // funil do admin: cada passo concluído vira um evento, uma vez só
  const fresh = markActivationLogged(
    session.userId,
    steps.filter((s) => s.done).map((s) => `${role}:${s.key}`)
  );
  for (const key of fresh) recordUserEvent("activation_step", session.userId, { step: key, done: progress.done, total: progress.total });
  return { role, steps, progress, dismissed: activationState(session.userId).dismissed };
}
