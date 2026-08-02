"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { Professional, Project } from "@/lib/marketplace-types";
import { PROJECT_STATUS_LABELS, ROLE_LABELS } from "@/lib/marketplace-types";
import type { ProfessionalStats } from "@/lib/marketplace-db";
import type { TierInfo } from "@/lib/ranking";
import ProfessionalForm from "@/components/ProfessionalForm";
import TierBadge from "@/components/TierBadge";
import { Button, Card, SectionTitle, Spinner, Tag } from "@/components/ui";

type Profile = Professional & {
  stats: ProfessionalStats;
  tier: TierInfo;
  projects: Project[];
  opportunities: Project[];
};

export default function ProfessionalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [editing, setEditing] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(() => {
    api<Profile>(`/api/professionals/${id}`)
      .then(setProfile)
      .catch(() => setNotFound(true));
  }, [id]);

  useEffect(load, [load]);

  if (notFound) {
    return <p className="py-24 text-center text-muted">Profissional não encontrado.</p>;
  }
  if (!profile) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner label="Carregando perfil..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">
            {profile.name}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {ROLE_LABELS[profile.role]} · {profile.location}
            {profile.priceRange && ` · ${profile.priceRange}`}
          </p>
          <div className="mt-3">
            <TierBadge info={profile.tier} detailed />
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/ideas?audience=professional&targetId=${profile.id}`}>
            <Button variant="ghost">💡 Ideias para mim</Button>
          </Link>
          <Button variant="ghost" onClick={() => setEditing((e) => !e)}>
            {editing ? "Fechar edição" : "Editar perfil"}
          </Button>
        </div>
      </div>

      {editing ? (
        <ProfessionalForm
          initial={profile}
          onSaved={() => {
            setEditing(false);
            load();
          }}
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: "Demandas concluídas", value: profile.stats.completed },
              { label: "Nota média das entregas", value: profile.stats.avgScore ?? "—" },
              { label: "Demandas ativas", value: profile.stats.active },
            ].map((stat) => (
              <Card key={stat.label} className="text-center">
                <p className="text-xs uppercase tracking-wide text-muted">{stat.label}</p>
                <p className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold text-accent">
                  {stat.value}
                </p>
              </Card>
            ))}
          </div>

          <Card>
            <SectionTitle>Perfil</SectionTitle>
            <div className="flex flex-wrap gap-1.5">
              {profile.skills.map((skill) => (
                <Tag key={skill}>{skill}</Tag>
              ))}
            </div>
            {profile.specialties && (
              <p className="mt-3 text-sm text-muted">
                <span className="font-semibold text-foreground/80">Especialidades: </span>
                {profile.specialties}
              </p>
            )}
            {profile.marketFocus && (
              <p className="mt-1 text-sm text-muted">
                <span className="font-semibold text-foreground/80">Foco de mercado: </span>
                {profile.marketFocus}
              </p>
            )}
            {profile.bio && <p className="mt-3 text-sm text-muted">{profile.bio}</p>}
            {(profile.email || profile.phone) && (
              <p className="mt-3 text-xs text-muted">
                {profile.email} {profile.phone && `· ${profile.phone}`}
              </p>
            )}
          </Card>

          {profile.portfolio.length > 0 && (
            <Card>
              <SectionTitle>Portfolio</SectionTitle>
              <div className="flex flex-wrap gap-2">
                {profile.portfolio.map((item, i) => (
                  <a
                    key={i}
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md border border-edge bg-surface-2 px-3 py-1.5 text-sm text-muted transition-colors hover:border-accent hover:text-accent"
                  >
                    {item.title || item.url} ↗
                  </a>
                ))}
              </div>
            </Card>
          )}

          <Card>
            <SectionTitle>Minhas demandas</SectionTitle>
            {profile.projects.length === 0 ? (
              <p className="text-sm text-muted">Nenhuma demanda vinculada ainda.</p>
            ) : (
              <div className="space-y-2">
                {profile.projects.map((project) => (
                  <div
                    key={project.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-edge bg-surface-2 p-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">{project.title}</p>
                      <p className="text-xs text-muted">
                        Verba: {project.budget || "n/d"} · Prazo: {project.deadline || "n/d"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Tag>{PROJECT_STATUS_LABELS[project.status]}</Tag>
                      <Link
                        href={`/clients/${project.clientId}?project=${project.id}`}
                        className="text-xs text-accent hover:underline"
                      >
                        Abrir →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <SectionTitle>Oportunidades abertas na plataforma</SectionTitle>
            {profile.opportunities.length === 0 ? (
              <p className="text-sm text-muted">Nenhuma demanda aberta no momento.</p>
            ) : (
              <div className="space-y-2">
                {profile.opportunities.map((project) => (
                  <div
                    key={project.id}
                    className="rounded-lg border border-edge bg-surface-2 p-3 text-sm"
                  >
                    <p className="font-medium">{project.title}</p>
                    <p className="mt-1 text-xs text-muted">
                      Skills: {project.skillsNeeded.join(", ") || "n/d"} · Local:{" "}
                      {project.location || "remoto"} · Verba: {project.budget || "n/d"}
                    </p>
                    {project.brief && (
                      <p className="mt-1 text-xs text-muted">{project.brief.slice(0, 200)}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="flex items-center justify-between">
            <p className="text-sm text-muted">Remover este perfil da plataforma.</p>
            <Button
              variant="danger"
              onClick={async () => {
                if (!confirm(`Excluir ${profile.name}?`)) return;
                await api(`/api/professionals/${profile.id}`, { method: "DELETE" });
                router.push("/professionals");
              }}
            >
              Excluir perfil
            </Button>
          </Card>
        </>
      )}
    </div>
  );
}
