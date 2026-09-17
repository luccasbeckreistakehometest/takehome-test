import { getAgency, type Agency } from "./agencies";
import { agencyLogoUploadId } from "./tenancy-rules";

// Identidade da PLATAFORMA (o produto em si) — fixa, distinta da marca da
// agência. É o que visitantes anônimos e usuários auto-cadastrados veem.
// A agência e os usuários que ela convidou veem a marca whitelabel DELA.
export const PLATFORM_BRAND = {
  name: "Marqa",
  tagline: "sua marca, acelerada por IA",
  accentColor: "#f76b15",
  logoMime: "", // sem logo custom = mostra a inicial
  logoUrl: "",
  isPlatform: true as const,
};

export type Brand = {
  name: string;
  tagline: string;
  accentColor: string;
  logoMime: string;
  logoUrl: string; // endereço público do logo (vazio = sem logo)
  isPlatform: boolean;
};

type SessionLike = {
  role: "admin" | "agency" | "client" | "professional";
  brandSource?: "agency" | "platform";
  agencyId?: string | null;
} | null;

export function agencyLogoUrl(agency: Pick<Agency, "id" | "logoMime">): string {
  return agency.logoMime ? `/api/settings/logo?agency=${encodeURIComponent(agency.id)}` : "";
}

export function brandOf(agency: Agency): Brand {
  return {
    name: agency.name,
    tagline: agency.tagline,
    accentColor: agency.accentColor,
    logoMime: agency.logoMime,
    logoUrl: agencyLogoUrl(agency),
    isPlatform: false,
  };
}

// Decide qual marca renderizar no chrome global:
// - agência logada → a própria marca
// - cliente/profissional → a agência dele quando convidado (brandSource
//   "agency"); auto-cadastrado ou sem agência → plataforma
// - admin e anônimo → plataforma
export function resolveBrand(session: SessionLike): Brand {
  if (!session || session.role === "admin") return { ...PLATFORM_BRAND };
  if (session.role !== "agency" && session.brandSource === "platform") return { ...PLATFORM_BRAND };
  const agency = getAgency(session.agencyId);
  return agency ? brandOf(agency) : { ...PLATFORM_BRAND };
}

export { agencyLogoUploadId };
