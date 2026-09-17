import { afterEach, describe, expect, it, vi } from "vitest";
import * as pt from "../../lib/legal-content-pt";
import * as en from "../../lib/legal-content-en";
import { agencySelfSignupEnabled, legalIdentity, legalIdentityComplete, supportChannels } from "../../lib/legal";

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
  });

  it("describes the card subscription the product actually sells", () => {
    const ptAll = JSON.stringify([pt.TERMS_PT, pt.REFUNDS_PT]);
    expect(ptAll).not.toContain("não renovam automaticamente");
    for (const needle of ["assinatura no cartão", "Cancelar renovação", "3 dias", "7 dias"]) expect(ptAll).toContain(needle);
    const enAll = JSON.stringify([en.TERMS_EN, en.REFUNDS_EN]);
    expect(enAll).not.toContain("do not renew automatically");
    for (const needle of ["card subscription", "Cancelar renovação", "3 days"]) expect(enAll).toContain(needle);
  });

  it("explains the cookie-free measurement round 3 added", () => {
    for (const doc of [pt.PRIVACY_PT, pt.COOKIES_PT]) {
      const text = JSON.stringify(doc);
      expect(text).toContain("sem cookie");
      expect(text).toContain("utm");
    }
    expect(JSON.stringify(pt.PRIVACY_PT)).toContain("90 dias");
    for (const doc of [en.PRIVACY_EN, en.COOKIES_EN]) {
      const text = JSON.stringify(doc).toLowerCase();
      expect(text).toContain("no cookies");
      expect(text).toContain("utm");
    }
    expect(JSON.stringify(en.PRIVACY_EN)).toContain("90 days");
  });

  it("never invent company data: identity only from env", () => {
    for (const name of ["LEGAL_NAME", "LEGAL_DOCUMENT", "LEGAL_ADDRESS", "LEGAL_EMAIL"]) vi.stubEnv(name, "");
    expect(legalIdentity()).toEqual({ name: null, document: null, address: null, email: null });
    vi.stubEnv("LEGAL_NAME", "Empresa Exemplo LTDA");
    expect(legalIdentity().name).toBe("Empresa Exemplo LTDA");
    const all = JSON.stringify([pt, en]);
    expect(all).not.toMatch(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/); // nenhum CNPJ no texto
  });

  it("support channels are opt-in; agency signup is open unless switched off", () => {
    vi.stubEnv("SUPPORT_EMAIL", "");
    vi.stubEnv("SUPPORT_WHATSAPP", "123");
    expect(supportChannels()).toEqual({ email: null, whatsapp: null });
    vi.stubEnv("AGENCY_SELF_SIGNUP", "");
    expect(agencySelfSignupEnabled()).toBe(true);
    vi.stubEnv("AGENCY_SELF_SIGNUP", "true");
    expect(agencySelfSignupEnabled()).toBe(true);
    vi.stubEnv("AGENCY_SELF_SIGNUP", "false");
    expect(agencySelfSignupEnabled()).toBe(false);
    vi.stubEnv("AGENCY_SELF_SIGNUP", " FALSE ");
    expect(agencySelfSignupEnabled()).toBe(false);
  });

  it("in production, agency signup opens only once the data controller is identified", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AGENCY_SELF_SIGNUP", "");
    for (const name of ["LEGAL_NAME", "LEGAL_DOCUMENT", "LEGAL_ADDRESS", "LEGAL_EMAIL"]) vi.stubEnv(name, "");
    expect(legalIdentityComplete()).toBe(false);
    expect(agencySelfSignupEnabled()).toBe(false);
    vi.stubEnv("AGENCY_SELF_SIGNUP", "true");
    expect(agencySelfSignupEnabled()).toBe(false);
    vi.stubEnv("LEGAL_NAME", "Empresa Exemplo LTDA");
    vi.stubEnv("LEGAL_DOCUMENT", "documento de teste");
    expect(agencySelfSignupEnabled()).toBe(false);
    vi.stubEnv("LEGAL_EMAIL", "contato@example.test");
    expect(legalIdentityComplete()).toBe(true);
    expect(agencySelfSignupEnabled()).toBe(true);
    vi.stubEnv("AGENCY_SELF_SIGNUP", "false");
    expect(agencySelfSignupEnabled()).toBe(false);
  });
});
