"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { Button, ErrorBox, Input, Label, Select } from "./ui";
import { Icon, type IconName } from "./icons";

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
}: {
  fixedRole?: Role;
  initialRole?: Role; // pré-seleciona (mas deixa trocar); vindo do funil (?type=)
  token?: string;
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
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!role) return;
    setLoading(true);
    setError("");
    try {
      const result = await api<{ home: string }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ role, token, ...form }),
      });
      window.location.href = `${result.home}?welcome=1`;
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

  return (
    <div className="space-y-3">
      {!fixedRole && (
        <button
          onClick={() => setRole(null)}
          className="text-xs text-muted transition-colors hover:text-foreground"
        >
          ← trocar tipo de conta
        </button>
      )}
      <div className="flex items-center gap-2 rounded-md border border-edge bg-surface-2 px-3 py-2 text-sm">
        <Icon name={ROLE_INFO[role].icon} size={16} className="text-accent" />
        <span className="font-medium">{ROLE_INFO[role].label}</span>
      </div>

      <div>
        <Label>{role === "agency" ? "Nome da agência" : "Nome"}</Label>
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
      </div>

      {role === "client" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Segmento</Label>
            <Input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} placeholder="Ex.: moda, café..." />
          </div>
          <div>
            <Label>País</Label>
            <Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
          </div>
        </div>
      )}

      {role === "professional" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Atuação</Label>
            <Select
              value={form.professionalRole}
              onChange={(e) => setForm({ ...form, professionalRole: e.target.value as "fotografo" | "designer" })}
            >
              <option value="fotografo">Fotógrafo(a)</option>
              <option value="designer">Designer</option>
            </Select>
          </div>
          <div>
            <Label>Localização</Label>
            <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Cidade, UF" />
          </div>
        </div>
      )}

      {role !== "agency" && (
        <div>
          <Label>Email (opcional)</Label>
          <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
      )}

      <div>
        <Label>Senha</Label>
        <Input
          type="password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="mínimo 4 caracteres"
        />
      </div>

      {error && <ErrorBox message={error} />}
      <Button className="w-full" onClick={submit} disabled={loading || !form.name.trim() || !form.password}>
        {loading ? "Criando conta..." : "Criar conta e entrar"}
      </Button>
    </div>
  );
}
