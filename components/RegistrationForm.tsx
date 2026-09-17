"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Button, ErrorBox, Input, Label, Select } from "./ui";
import { Icon, type IconName } from "./icons";
import AccessRequestForm from "./AccessRequestForm";

type Role = "client" | "professional" | "agency";

const ROLE_INFO: Record<Role, { label: string; icon: IconName; blurb: string }> = {
  client: {
    label: "Cliente / Marca",
    icon: "briefcase",
    blurb: "Quero estratégia, campanhas e materiais para a minha marca.",
  },
  professional: {
    label: "Profissional",
    icon: "user",
    blurb: "Sou fotógrafo(a) ou designer e quero receber demandas.",
  },
  agency: {
    label: "Agência",
    icon: "users",
    blurb: "Gerencio clientes e uma rede de profissionais.",
  },
};

// Form de cadastro reutilizado pelo auto-cadastro (/criar-conta, com seletor
// de tipo) e pelo convite (/convite/[token], com papel travado).
export default function RegistrationForm({
  fixedRole,
  initialRole,
  token,
  agencySignupOpen = false,
  plan,
  period,
}: {
  fixedRole?: Role;
  initialRole?: Role; // pré-seleciona (mas deixa trocar); vindo do funil (?type=)
  token?: string;
  agencySignupOpen?: boolean; // AGENCY_SELF_SIGNUP (sem convite, agência pede acesso)
  plan?: string; // plano escolhido na página de preços → vai direto ao pagamento
  period?: string;
}) {
  const [role, setRole] = useState<Role | null>(fixedRole ?? initialRole ?? null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    industry: "",
    country: "Brasil",
    professionalRole: "fotografo" as "fotografo" | "designer",
    location: "",
    website: "", // honeypot
  });
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!role) return;
    setLoading(true);
    setError("");
    try {
      const result = await api<{ home: string }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ role, token, acceptTerms, plan, period, ...form }),
      });
      // O servidor já devolve a home com ?welcome=1 (e o que mais precisar).
      window.location.href = result.home;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao criar conta");
      setLoading(false);
    }
  }

  // Seleção de tipo (só no auto-cadastro)
  if (!role) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted">Que tipo de conta você quer criar?</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {(Object.keys(ROLE_INFO) as Role[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className="group flex flex-col items-start gap-2 rounded-xl border border-edge bg-surface-2 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-accent"
            >
              <span className="grid size-10 place-items-center rounded-lg bg-accent/10 text-accent transition-colors group-hover:bg-accent group-hover:text-accent-ink">
                <Icon name={ROLE_INFO[r].icon} size={20} />
              </span>
              <span className="font-semibold">{ROLE_INFO[r].label}</span>
              <span className="text-xs text-muted">{ROLE_INFO[r].blurb}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const header = (
    <>
      {!fixedRole && (
        <button type="button" onClick={() => setRole(null)} className="text-xs text-muted transition-colors hover:text-foreground">
          ← trocar tipo de conta
        </button>
      )}
      <div className="flex items-center gap-2 rounded-md border border-edge bg-surface-2 px-3 py-2 text-sm">
        <Icon name={ROLE_INFO[role].icon} size={16} className="text-accent" />
        <span className="font-medium">{ROLE_INFO[role].label}</span>
      </div>
    </>
  );

  // Agência sem convite: cadastro por pedido de acesso (até o isolamento
  // por agência ficar pronto).
  if (role === "agency" && !token && !agencySignupOpen) {
    return (
      <div className="space-y-3">
        {header}
        <AccessRequestForm />
      </div>
    );
  }

  return (
    <form className="space-y-3" onSubmit={submit} aria-label="Criar conta">
      {header}

      <div>
        <Label htmlFor="reg-name">{role === "agency" ? "Nome da agência" : role === "client" ? "Nome da marca" : "Seu nome"}</Label>
        <Input
          id="reg-name"
          name="name"
          autoComplete={role === "professional" ? "name" : "organization"}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          autoFocus
          required
          data-testid="reg-name"
        />
      </div>

      {role === "client" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="reg-industry">Segmento</Label>
            <Input id="reg-industry" value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} placeholder="Ex.: moda, café..." data-testid="reg-industry" />
          </div>
          <div>
            <Label htmlFor="reg-country">País</Label>
            <Input id="reg-country" autoComplete="country-name" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
          </div>
        </div>
      )}

      {role === "professional" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="reg-pro-role">Atuação</Label>
            <Select
              id="reg-pro-role"
              value={form.professionalRole}
              onChange={(e) => setForm({ ...form, professionalRole: e.target.value as "fotografo" | "designer" })}
            >
              <option value="fotografo">Fotógrafo(a)</option>
              <option value="designer">Designer</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="reg-location">Localização</Label>
            <Input id="reg-location" autoComplete="address-level2" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Cidade, UF" />
          </div>
        </div>
      )}

      <div>
        <Label htmlFor="reg-email">E-mail</Label>
        <Input
          id="reg-email"
          name="email"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
          data-testid="reg-email"
        />
        <p className="mt-1 text-xs text-muted">Você entra com ele (ou com o usuário que vamos mostrar).</p>
      </div>

      <div>
        <Label htmlFor="reg-password">Senha</Label>
        <Input
          id="reg-password"
          name="new-password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          placeholder="mínimo 8 caracteres"
          required
          data-testid="reg-password"
        />
      </div>

      {/* honeypot: fora da tela para pessoas, visível para robôs */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="reg-website">Site</label>
        <input id="reg-website" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
      </div>

      <label className="flex items-start gap-2 text-sm text-muted" htmlFor="reg-terms">
        <input
          id="reg-terms"
          type="checkbox"
          className="mt-1 size-4 accent-[var(--accent)]"
          checked={acceptTerms}
          onChange={(e) => setAcceptTerms(e.target.checked)}
          required
          data-testid="reg-terms"
        />
        <span>
          Li e aceito os{" "}
          <Link href="/termos" target="_blank" className="text-accent hover:underline">
            Termos de Uso
          </Link>{" "}
          e a{" "}
          <Link href="/privacidade" target="_blank" className="text-accent hover:underline">
            Política de Privacidade
          </Link>
          .
        </span>
      </label>

      {error && <ErrorBox message={error} />}
      <Button
        type="submit"
        className="w-full"
        disabled={loading || !form.name.trim() || !form.email.trim() || form.password.length < 8 || !acceptTerms}
        data-testid="reg-submit"
      >
        {loading ? "Criando conta..." : plan ? "Criar conta e ir para o pagamento" : "Criar conta e entrar"}
      </Button>
    </form>
  );
}
