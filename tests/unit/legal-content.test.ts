import { afterEach, describe, expect, it, vi } from "vitest";
import * as pt from "../../lib/legal-content-pt";
import * as en from "../../lib/legal-content-en";
import { agencySelfSignupEnabled, legalIdentity, supportChannels } from "../../lib/legal";

describe("legal documents", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("exist in both languages with the same structure", () => {
    const pairs = [
      [pt.TERMS_PT, en.TERMS_EN],
      [pt.PRIVACY_PT, en.PRIVACY_EN],
      [pt.REFUNDS_PT, en.REFUNDS_EN],
      [pt.COOKIES_PT, en.COOKIES_EN],
    ] as const;
    for (const [a, b] of pairs) {
      expect(a.lang).toBe("pt");
      expect(b.lang).toBe("en");
      expect(a.sections.length).toBe(b.sections.length);
    }
  });

  it("cover LGPD essentials and the 7-day withdrawal right", () => {
    const privacy = JSON.stringify(pt.PRIVACY_PT);
    for (const needle of ["Anthropic", "Mercado Pago", "Stripe", "ElevenLabs", "OpenAI", "Meta", "Hostinger", "art. 18", "ANPD", "Transferência internacional"]) {
      expect(privacy).toContain(needle);
    }
    expect(JSON.stringify(pt.REFUNDS_PT)).toContain("art. 49");
    expect(JSON.stringify(pt.TERMS_PT)).toContain("não renovam automaticamente");
  });

  it("never invent company data: identity only from env", () => {
    for (const name of ["LEGAL_NAME", "LEGAL_DOCUMENT", "LEGAL_ADDRESS", "LEGAL_EMAIL"]) vi.stubEnv(name, "");
    expect(legalIdentity()).toEqual({ name: null, document: null, address: null, email: null });
    vi.stubEnv("LEGAL_NAME", "Empresa Exemplo LTDA");
    expect(legalIdentity().name).toBe("Empresa Exemplo LTDA");
    const all = JSON.stringify([pt, en]);
    expect(all).not.toMatch(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/); // nenhum CNPJ no texto
  });

  it("support channels and agency signup are opt-in", () => {
    vi.stubEnv("SUPPORT_EMAIL", "");
    vi.stubEnv("SUPPORT_WHATSAPP", "123");
    expect(supportChannels()).toEqual({ email: null, whatsapp: null });
    vi.stubEnv("AGENCY_SELF_SIGNUP", "");
    expect(agencySelfSignupEnabled()).toBe(false);
    vi.stubEnv("AGENCY_SELF_SIGNUP", "true");
    expect(agencySelfSignupEnabled()).toBe(true);
  });
});
