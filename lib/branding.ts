import { getSettings, type AgencySettings } from "./settings";

// Identidade da PLATAFORMA (o produto em si) — fixa, distinta da marca da
// agência. É o que visitantes anônimos e usuários auto-cadastrados veem.
// A agência e os usuários que ela convidou veem a marca whitelabel dela.
export const PLATFORM_BRAND = {
  name: "Marqa",
  tagline: "sua marca, acelerada por IA",
  accentColor: "#c6f24e",
  logoMime: "", // sem logo custom = mostra a inicial
  isPlatform: true as const,
};

export type Brand = {
  name: string;
  tagline: string;
  accentColor: string;
  logoMime: string;
  isPlatform: boolean;
};

type SessionLike = {
  role: "admin" | "agency" | "client" | "professional";
  brandSource?: "agency" | "platform";
} | null;

// Decide qual marca renderizar no chrome global:
// - agência logada → a própria marca (settings)
// - cliente/profissional → conforme brandSource (convidado pela agência =
//   whitelabel; auto-cadastrado = plataforma)
// - anônimo (login, etc.) → plataforma
export function resolveBrand(session: SessionLike, settings?: AgencySettings): Brand {
  const agency = settings ?? getSettings();
  const agencyBrand: Brand = {
    name: agency.agencyName,
    tagline: agency.tagline,
    accentColor: agency.accentColor,
    logoMime: agency.logoMime,
    isPlatform: false,
  };
  if (!session) return { ...PLATFORM_BRAND };
  if (session.role === "agency") return agencyBrand;
  // cliente/profissional: default agência (convidado) salvo se marcado platform
  return session.brandSource === "platform" ? { ...PLATFORM_BRAND } : agencyBrand;
}
