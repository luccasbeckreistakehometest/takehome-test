"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Professional } from "@/lib/marketplace-types";
import { ROLE_LABELS } from "@/lib/marketplace-types";
import type { ProfessionalStats } from "@/lib/marketplace-db";
import type { TierInfo } from "@/lib/ranking";
import TierBadge from "@/components/TierBadge";
import { Card, Spinner, Tag } from "@/components/ui";

type Row = Professional & { stats: ProfessionalStats; tier: TierInfo };

export default function ProfessionalsPage() {
  const [professionals, setProfessionals] = useState<Row[] | null>(null);

  useEffect(() => {
    api<Row[]>("/api/professionals").then(setProfessionals).catch(() => setProfessionals([]));
  }, []);

  if (!professionals) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner label="Carregando profissionais..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">
            Profissionais
          </h1>
          <p className="mt-1 text-sm text-muted">
            Fotógrafos e designers parceiros — rankeados por elo com base em
            entregas reais e notas de qualidade da IA.
          </p>
        </div>
        <Link
          href="/professionals/new"
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90"
        >
          + Cadastrar profissional
        </Link>
      </div>

      {professionals.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted">
          Nenhum profissional ainda. Cadastre (ou envie o link de convite — veja
          Configurações) para começar a fazer match com demandas.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {professionals.map((professional) => (
            <Link key={professional.id} href={`/professionals/${professional.id}`}>
              <Card className="h-full transition-colors hover:border-accent/60">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-[family-name:var(--font-display)] text-lg font-semibold">
                      {professional.name}
                    </p>
                    <p className="text-sm text-muted">
                      {ROLE_LABELS[professional.role]} · {professional.location}
                    </p>
                  </div>
                  <TierBadge info={professional.tier} />
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {professional.skills.slice(0, 4).map((skill) => (
                    <Tag key={skill}>{skill}</Tag>
                  ))}
                  {professional.skills.length > 4 && (
                    <Tag>+{professional.skills.length - 4}</Tag>
                  )}
                </div>
                <p className="mt-3 text-xs text-muted">
                  {professional.stats.completed} demandas concluídas · nota média{" "}
                  {professional.stats.avgScore ?? "—"}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
