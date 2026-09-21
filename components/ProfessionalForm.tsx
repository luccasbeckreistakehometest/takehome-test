"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import {
  ROLE_LABELS,
  SKILL_OPTIONS,
  type Professional,
  type ProfessionalInput,
} from "@/lib/marketplace-types";
import { Button, Card, ErrorBox, Input, Label, Select, Spinner, Textarea } from "./ui";

const EMPTY: ProfessionalInput = {
  name: "",
  role: "fotografo",
  email: "",
  phone: "",
  location: "",
  skills: [],
  specialties: "",
  marketFocus: "",
  bio: "",
  portfolio: [],
  priceRange: "",
  availability: "",
  employmentType: "freelancer",
};

export default function ProfessionalForm({
  initial,
  onSaved,
}: {
  initial?: Professional;
  onSaved: (professional: Professional) => void;
}) {
  const [form, setForm] = useState<ProfessionalInput>(
    initial ? { ...EMPTY, ...initial } : EMPTY
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = <K extends keyof ProfessionalInput>(key: K, value: ProfessionalInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const saved = initial
        ? await api<Professional>(`/api/professionals/${initial.id}`, {
            method: "PUT",
            body: JSON.stringify(form),
          })
        : await api<Professional>("/api/professionals", {
            method: "POST",
            body: JSON.stringify(form),
          });
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {error && <ErrorBox message={error} />}
      <Card className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label>Nome *</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} required />
          </div>
          <div>
            <Label>Atuação</Label>
            <Select
              value={form.role}
              onChange={(e) => set("role", e.target.value as ProfessionalInput["role"])}
            >
              {Object.entries(ROLE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Localização (cidade/UF) *</Label>
            <Input
              value={form.location}
              onChange={(e) => set("location", e.target.value)}
              placeholder="Ex.: Curitiba/PR"
              required
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label>E-mail</Label>
            <Input value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div>
            <Label>WhatsApp/telefone</Label>
            <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </div>
          <div>
            <Label>Faixa de preço</Label>
            <Input
              value={form.priceRange}
              onChange={(e) => set("priceRange", e.target.value)}
              placeholder="Ex.: R$ 800-1.500/diária"
            />
          </div>
        </div>
        <div>
          <Label>Skills</Label>
          <div className="flex flex-wrap gap-2">
            {SKILL_OPTIONS.map((skill) => {
              const active = form.skills.includes(skill);
              return (
                <button
                  key={skill}
                  type="button"
                  onClick={() =>
                    set(
                      "skills",
                      active
                        ? form.skills.filter((s) => s !== skill)
                        : [...form.skills, skill]
                    )
                  }
                  className={`rounded-xs border px-3 py-1 t5 transition-colors ${
                    active
                      ? "border-text bg-text text-canvas"
                      : "border-edge bg-surface-sunken text-text-muted hover:border-edge"
                  }`}
                >
                  {skill}
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Especialidades</Label>
            <Textarea
              value={form.specialties}
              onChange={(e) => set("specialties", e.target.value)}
              placeholder="Ex.: fotografia gastronômica com luz natural, direção de modelos..."
            />
          </div>
          <div>
            <Label>Foco de mercado</Label>
            <Textarea
              value={form.marketFocus}
              onChange={(e) => set("marketFocus", e.target.value)}
              placeholder="Ex.: restaurantes e cafés premium, moda feminina..."
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Disponibilidade</Label>
            <Input
              value={form.availability}
              onChange={(e) => set("availability", e.target.value)}
              placeholder="Ex.: seg-sex após 14h; fins de semana livres"
            />
          </div>
          <div>
            <Label>Vínculo</Label>
            <select
              value={form.employmentType}
              onChange={(e) =>
                set("employmentType", e.target.value as "freelancer" | "employee")
              }
              className="w-full rounded-md border border-edge bg-surface-sunken px-3 py-2 t3 text-text outline-none transition-colors focus:border-edge"
            >
              <option value="freelancer">Freelancer (marketplace aberto)</option>
              <option value="employee">Funcionário full-time (só demandas da agência)</option>
            </select>
          </div>
        </div>
        <div>
          <Label>Bio</Label>
          <Textarea
            value={form.bio}
            onChange={(e) => set("bio", e.target.value)}
            placeholder="Trajetória, estilo, clientes atendidos..."
          />
        </div>
        <div>
          <Label>Portfolio (links)</Label>
          <div className="space-y-2">
            {form.portfolio.map((item, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={item.title}
                  placeholder="Título"
                  onChange={(e) =>
                    set(
                      "portfolio",
                      form.portfolio.map((p, i) =>
                        i === index ? { ...p, title: e.target.value } : p
                      )
                    )
                  }
                />
                <Input
                  value={item.url}
                  placeholder="https://..."
                  onChange={(e) =>
                    set(
                      "portfolio",
                      form.portfolio.map((p, i) =>
                        i === index ? { ...p, url: e.target.value } : p
                      )
                    )
                  }
                />
                <Button
                  type="button"
                  variant="danger"
                  onClick={() =>
                    set(
                      "portfolio",
                      form.portfolio.filter((_, i) => i !== index)
                    )
                  }
                >
                  ✕
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="ghost"
              onClick={() => set("portfolio", [...form.portfolio, { title: "", url: "" }])}
            >
              + Adicionar link
            </Button>
          </div>
        </div>
      </Card>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving}>
          {initial ? "Salvar alterações" : "Criar perfil"}
        </Button>
        {saving && <Spinner label="Salvando..." />}
      </div>
    </form>
  );
}
