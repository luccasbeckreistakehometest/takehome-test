// Identidade legal e versões dos documentos. Os dados da empresa vêm SÓ de
// variáveis de ambiente — nada é inventado. Sem elas, as páginas omitem as
// linhas e apontam para o formulário de contato.

// Mude quando os termos/política mudarem de forma relevante: o aceite gravado
// no cadastro guarda a versão que a pessoa aceitou.
export const LEGAL_VERSION = "2026-09-17";

export type LegalIdentity = {
  name: string | null;
  document: string | null;
  address: string | null;
  email: string | null;
};

const clean = (value: string | undefined) => {
  const v = (value ?? "").trim();
  return v ? v : null;
};

export function legalIdentity(): LegalIdentity {
  return {
    name: clean(process.env.LEGAL_NAME),
    document: clean(process.env.LEGAL_DOCUMENT),
    address: clean(process.env.LEGAL_ADDRESS),
    email: clean(process.env.LEGAL_EMAIL),
  };
}

export type SupportChannels = { email: string | null; whatsapp: string | null };

export function supportChannels(): SupportChannels {
  const whatsapp = clean(process.env.SUPPORT_WHATSAPP)?.replace(/\D/g, "") ?? null;
  return { email: clean(process.env.SUPPORT_EMAIL), whatsapp: whatsapp && whatsapp.length >= 10 ? whatsapp : null };
}

// A política de privacidade identifica o controlador (LGPD art. 9)? Nome,
// documento e e-mail precisam estar no ambiente.
export function legalIdentityComplete(): boolean {
  const id = legalIdentity();
  return Boolean(id.name && id.document && id.email);
}

// Cadastro público de agência: LIGADO (cada agência nasce com o próprio
// workspace isolado). AGENCY_SELF_SIGNUP=false fecha o cadastro de novo
// (vira "pedir acesso") — um interruptor de emergência. Em produção ele só
// abre com o controlador identificado (LEGAL_NAME, LEGAL_DOCUMENT e
// LEGAL_EMAIL); até lá, agência entra por convite ou pedido de acesso.
export function agencySelfSignupEnabled(): boolean {
  if ((process.env.AGENCY_SELF_SIGNUP ?? "").trim().toLowerCase() === "false") return false;
  return process.env.NODE_ENV !== "production" || legalIdentityComplete();
}

export function appBaseUrl(): string {
  const raw = (process.env.APP_URL || process.env.NEXT_PUBLIC_BASE_URL || "https://marqa.online").trim();
  return raw.replace(/\/$/, "");
}
