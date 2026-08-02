"use client";

import { use, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Client, Generation } from "@/lib/types";
import {
  ESCROW_LABELS,
  PROJECT_STATUS_LABELS,
  type Deliverable,
  type Professional,
  type Project,
} from "@/lib/marketplace-types";
import type { ClientReport } from "@/lib/marketplace-schemas";
import type { TierInfo } from "@/lib/ranking";
import { ClientReportView } from "@/components/renderers";
import TierBadge, { TierProgress } from "@/components/TierBadge";
import { Button, Card, Input, SectionTitle, Spinner, Tag, Textarea } from "@/components/ui";
import type { AccountMessage } from "@/lib/marketplace-db";

type ProjectDetail = Project & {
  professional: Professional | null;
  deliverables: Deliverable[];
};

// Portal do cliente: visão read-only do que a agência está produzindo,
// com download dos arquivos do contrato.
export default function ClientPortalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [client, setClient] = useState<Client | null>(null);
  const [tier, setTier] = useState<TierInfo | null>(null);
  const [report, setReport] = useState<Generation | null>(null);
  const [landings, setLandings] = useState<Generation[]>([]);
  const [projects, setProjects] = useState<ProjectDetail[]>([]);
  const [messages, setMessages] = useState<AccountMessage[]>([]);
  const [chatText, setChatText] = useState("");
  const [requestText, setRequestText] = useState("");
  const [requestSent, setRequestSent] = useState(false);

  useEffect(() => {
    api<Client>(`/api/clients/${id}`).then(setClient);
    api<{ tier: TierInfo }>(`/api/clients/${id}/dashboard`).then((d) => setTier(d.tier));
    api<Generation[]>(`/api/generations?clientId=${id}&type=client_report`).then((g) =>
      setReport(g[0] ?? null)
    );
    api<Generation[]>(`/api/generations?clientId=${id}&type=landing_page`).then(setLandings);
    const loadProjects = () =>
      api<Project[]>(`/api/projects?clientId=${id}`).then(async (list) => {
        const detailed = await Promise.all(
          list.map((p) => api<ProjectDetail>(`/api/projects/${p.id}`))
        );
        setProjects(detailed);
      });
    const loadMessages = () =>
      api<AccountMessage[]>(`/api/clients/${id}/account-messages`).then(setMessages);
    loadProjects();
    loadMessages();
    const interval = setInterval(() => {
      loadProjects();
      loadMessages();
    }, 10000);
    return () => clearInterval(interval);
  }, [id]);

  async function approveProject(projectId: string, approve: boolean) {
    await api(`/api/projects/${projectId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: approve ? "approved" : "in_progress" }),
    });
    const list = await api<Project[]>(`/api/projects?clientId=${id}`);
    const detailed = await Promise.all(
      list.map((p) => api<ProjectDetail>(`/api/projects/${p.id}`))
    );
    setProjects(detailed);
  }

  async function sendChat() {
    if (!chatText.trim()) return;
    await api(`/api/clients/${id}/account-messages`, {
      method: "POST",
      body: JSON.stringify({ sender: "client", text: chatText.trim() }),
    });
    setChatText("");
    setMessages(await api<AccountMessage[]>(`/api/clients/${id}/account-messages`));
  }

  async function requestProduction() {
    if (!requestText.trim()) return;
    await api("/api/projects", {
      method: "POST",
      body: JSON.stringify({
        clientId: id,
        title: `Solicitação do cliente: ${requestText.slice(0, 60)}`,
        brief: `Solicitação enviada pelo cliente no portal:\n\n${requestText.trim()}`,
        skillsNeeded: [],
        location: "",
        budget: "",
        deadline: "",
        mode: "marketplace",
      }),
    });
    await api(`/api/clients/${id}/account-messages`, {
      method: "POST",
      body: JSON.stringify({
        sender: "client",
        text: `📋 Nova solicitação: ${requestText.trim().slice(0, 120)}`,
      }),
    });
    setRequestText("");
    setRequestSent(true);
  }

  if (!client) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner label="Carregando portal..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-accent">Portal do cliente</p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">
            {client.name}
          </h1>
          {tier && <TierBadge info={tier} />}
        </div>
        <p className="mt-1 text-sm text-muted">
          {client.selfServe
            ? "Sua conta em modo autônomo — você no controle, com a IA de copiloto."
            : "Acompanhe aqui o que a agência está construindo para a sua marca."}
        </p>
        {tier && (
          <div className="mt-3 max-w-md">
            <TierProgress info={tier} />
          </div>
        )}
        {client.selfServe && (
          <a
            href={`/clients/${client.id}`}
            className="mt-3 inline-block rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90"
          >
            ⚙ Gerenciar minha conta (workspace completo) →
          </a>
        )}
      </div>

      <Card>
        <SectionTitle>Produções em andamento</SectionTitle>
        {projects.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma produção com profissionais no momento.</p>
        ) : (
          <div className="space-y-2">
            {projects.map((project) => (
              <div key={project.id} className="rounded-lg border border-edge bg-surface-2 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{project.title}</p>
                  <div className="flex gap-1.5">
                    <Tag>{PROJECT_STATUS_LABELS[project.status]}</Tag>
                    <Tag>{ESCROW_LABELS[project.escrow]}</Tag>
                  </div>
                </div>
                {project.professional && (
                  <p className="mt-1 text-xs text-muted">
                    Profissional: {project.professional.name}
                  </p>
                )}
                {project.deliverables.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {project.deliverables.map((deliverable) => (
                      <a
                        key={deliverable.id}
                        href={`/api/files/${deliverable.id}?download=1`}
                        className="rounded border border-edge bg-background px-2 py-1 text-xs text-muted transition-colors hover:border-accent hover:text-accent"
                      >
                        ⬇ {deliverable.title}
                      </a>
                    ))}
                  </div>
                )}
                {project.status === "client_approval" && (
                  <div className="mt-3 rounded-md border border-accent/40 bg-accent/5 p-3">
                    <p className="text-sm font-medium">
                      Esta entrega aguarda a SUA aprovação:
                    </p>
                    <div className="mt-2 flex gap-2">
                      <Button
                        className="!px-3 !py-1.5 text-xs"
                        onClick={() => approveProject(project.id, true)}
                      >
                        ✅ Aprovar entrega
                      </Button>
                      <Button
                        variant="ghost"
                        className="!px-3 !py-1.5 text-xs"
                        onClick={() => approveProject(project.id, false)}
                      >
                        ↩ Pedir ajustes
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-3">
          <SectionTitle>Fale com a agência</SectionTitle>
          <div className="max-h-56 space-y-2 overflow-y-auto">
            {messages.length === 0 && (
              <p className="text-sm text-muted">Nenhuma mensagem ainda — diga oi!</p>
            )}
            {messages.map((message) => (
              <div
                key={message.id}
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  message.sender === "client"
                    ? "ml-auto bg-accent/15"
                    : "bg-surface-2"
                }`}
              >
                <p className="text-[10px] uppercase tracking-wide text-muted">
                  {message.sender === "client" ? "Você" : "Agência"}
                </p>
                {message.text}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendChat()}
              placeholder="Escreva para a agência..."
            />
            <Button onClick={sendChat}>Enviar</Button>
          </div>
        </Card>

        <Card className="space-y-3">
          <SectionTitle>Solicitar uma produção</SectionTitle>
          <p className="text-sm text-muted">
            Precisa de algo? Descreva e a solicitação vira uma demanda no painel
            da agência na hora.
          </p>
          {requestSent ? (
            <p className="rounded-md border border-accent/40 bg-accent/5 p-3 text-sm">
              ✅ Solicitação enviada! A agência já recebeu e vai preparar o brief.
            </p>
          ) : (
            <>
              <Textarea
                value={requestText}
                onChange={(e) => setRequestText(e.target.value)}
                placeholder='Ex.: "preciso de posts para o feriado de setembro" ou "quero fotos novas do cardápio"...'
              />
              <Button onClick={requestProduction} disabled={!requestText.trim()}>
                📋 Enviar solicitação
              </Button>
            </>
          )}
        </Card>
      </div>

      {landings.length > 0 && (
        <Card>
          <SectionTitle>Suas landing pages</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {landings.map((landing) => (
              <span key={landing.id} className="flex gap-1">
                <a
                  href={`/api/generations/${landing.id}/html`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md border border-edge bg-surface-2 px-3 py-1.5 text-sm text-muted transition-colors hover:border-accent hover:text-accent"
                >
                  {landing.title} ↗
                </a>
                <a
                  href={`/api/generations/${landing.id}/html?download=1`}
                  className="rounded-md border border-edge bg-surface-2 px-2 py-1.5 text-sm text-muted transition-colors hover:border-accent hover:text-accent"
                  title="Baixar HTML"
                >
                  ⬇
                </a>
              </span>
            ))}
          </div>
        </Card>
      )}

      {report ? (
        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
              {report.title}
            </h2>
            <a
              href={`/print/${report.id}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-edge bg-surface-2 px-3 py-1.5 text-sm text-muted transition-colors hover:border-accent hover:text-accent"
            >
              📄 Salvar em PDF
            </a>
          </div>
          <ClientReportView data={JSON.parse(report.content) as ClientReport} />
        </div>
      ) : (
        <Card>
          <p className="text-sm text-muted">
            O primeiro relatório executivo da sua conta aparecerá aqui assim que a
            agência gerá-lo.
          </p>
        </Card>
      )}
    </div>
  );
}
