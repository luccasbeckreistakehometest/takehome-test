"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Card, SectionTitle, Skeleton, Tag } from "@/components/ui";
import { Icon, type IconName } from "@/components/icons";

type Overview = {
  totals: {
    users: number;
    clients: number;
    professionals: number;
    generations: number;
    paidProjects: number;
    trackedRevenue: number;
  };
  clients: { id: string; name: string; industry: string; country: string }[];
  professionals: { id: string; name: string; role: string; employmentType: string }[];
  users: { username: string; role: string; name: string }[];
  invites: { token: string; role: string; status: string; note: string; createdAt: string }[];
};

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export default function AdminPage() {
  const [data, setData] = useState<Overview | null>(null);

  useEffect(() => {
    api<Overview>("/api/admin/overview").then(setData).catch(() => {});
  }, []);

  if (!data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-56" />
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  const kpis: { label: string; value: string; icon: IconName }[] = [
    { label: "Usuários", value: String(data.totals.users), icon: "users" },
    { label: "Clientes", value: String(data.totals.clients), icon: "briefcase" },
    { label: "Profissionais", value: String(data.totals.professionals), icon: "user" },
    { label: "Entregáveis", value: String(data.totals.generations), icon: "sparkle" },
    { label: "Demandas pagas", value: String(data.totals.paidProjects), icon: "check" },
    { label: "Receita rastreada", value: brl(data.totals.trackedRevenue), icon: "money" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">
            <Icon name="settings" size={24} className="text-accent" /> Admin da Plataforma
          </h1>
          <p className="mt-1 text-sm text-muted">
            Controle geral: agências, clientes, profissionais, planos e receita.
          </p>
        </div>
        <Link
          href="/plans"
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90"
        >
          Gerenciar planos
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {kpis.map((k) => (
          <Card key={k.label} hover>
            <Icon name={k.icon} size={20} className="text-accent" />
            <p className="mt-2 font-[family-name:var(--font-display)] text-2xl font-bold">{k.value}</p>
            <p className="text-xs text-muted">{k.label}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle>Clientes ({data.clients.length})</SectionTitle>
          <div className="max-h-80 space-y-1.5 overflow-y-auto">
            {data.clients.map((c) => (
              <Link
                key={c.id}
                href={`/clients/${c.id}`}
                className="flex items-center justify-between rounded-md border border-edge bg-surface-2 px-3 py-2 text-sm transition-colors hover:border-accent/60"
              >
                <span className="font-medium">{c.name}</span>
                <span className="text-xs text-muted">{[c.industry, c.country].filter(Boolean).join(" · ")}</span>
              </Link>
            ))}
            {data.clients.length === 0 && <p className="text-sm text-muted">Nenhum cliente.</p>}
          </div>
        </Card>

        <Card>
          <SectionTitle>Profissionais ({data.professionals.length})</SectionTitle>
          <div className="max-h-80 space-y-1.5 overflow-y-auto">
            {data.professionals.map((p) => (
              <Link
                key={p.id}
                href={`/professionals/${p.id}`}
                className="flex items-center justify-between rounded-md border border-edge bg-surface-2 px-3 py-2 text-sm transition-colors hover:border-accent/60"
              >
                <span className="font-medium">{p.name}</span>
                <span className="flex items-center gap-1.5 text-xs text-muted">
                  {p.role}
                  <Tag>{p.employmentType === "employee" ? "full-time" : "freelancer"}</Tag>
                </span>
              </Link>
            ))}
            {data.professionals.length === 0 && <p className="text-sm text-muted">Nenhum profissional.</p>}
          </div>
        </Card>

        <Card>
          <SectionTitle>Contas de acesso ({data.users.length})</SectionTitle>
          <div className="max-h-80 space-y-1.5 overflow-y-auto">
            {data.users.map((u) => (
              <div
                key={u.username}
                className="flex items-center justify-between rounded-md border border-edge bg-surface-2 px-3 py-2 text-sm"
              >
                <span>
                  <span className="font-mono text-accent">{u.username}</span>{" "}
                  <span className="text-muted">— {u.name}</span>
                </span>
                <Tag>{u.role}</Tag>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionTitle>Convites ({data.invites.length})</SectionTitle>
          <div className="max-h-80 space-y-1.5 overflow-y-auto">
            {data.invites.length === 0 ? (
              <p className="text-sm text-muted">Nenhum convite gerado. Agências geram em Configurações.</p>
            ) : (
              data.invites.map((i) => (
                <div key={i.token} className="rounded-md border border-edge bg-surface-2 px-3 py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <Tag>{i.role}</Tag>
                    <span className={`text-xs ${i.status === "accepted" ? "text-emerald-500" : "text-muted"}`}>
                      {i.status}
                    </span>
                  </div>
                  {i.note && <p className="mt-1 text-xs text-muted">{i.note}</p>}
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
