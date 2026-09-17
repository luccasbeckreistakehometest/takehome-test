"use client";

import { use, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Client, Generation } from "@/lib/types";
import {
  APPROVAL_STATUS_LABELS,
  ESCROW_LABELS,
  PROJECT_STATUS_LABELS,
  type Deliverable,
  type Professional,
  type Project,
} from "@/lib/marketplace-types";
import type { ApprovalEvent } from "@/lib/approvals-db";
import ApprovalTimeline from "@/components/ApprovalTimeline";
import type { ClientReport } from "@/lib/marketplace-schemas";
import type { TierInfo } from "@/lib/ranking";
import { ClientReportView } from "@/components/renderers";
import TierBadge, { TierProgress } from "@/components/TierBadge";
import { Button, Card, Input, SectionTitle, Spinner, Tag, Textarea } from "@/components/ui";
import MarcaModeChoice from "@/components/MarcaModeChoice";
import type { AccountMessage } from "@/lib/marketplace-db";

type ProjectDetail = Project & {
  professional: Professional | null;
  deliverables: Deliverable[];
  approvals: ApprovalEvent[];
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
  const [chooserOpen, setChooserOpen] = useState(false);

  useEffect(() => {
    // Abre o seletor de modo logo após o cadastro (?choose=1)
    if (new URLSearchParams(window.location.search).get("choose") === "1") {
      setChooserOpen(true);
    }
  }, []);

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

  async function reloadProjects() {
    const list = await api<Project[]>(`/api/projects?clientId=${id}`);
    const detailed = await Promise.all(
      list.map((p) => api<ProjectDetail>(`/api/projects/${p.id}`))
    );
    setProjects(detailed);
  }

  // Aprovar a demanda inteira = aprovar cada entrega pendente (cada uma
  // dispara as automações); pedir ajustes devolve a demanda para produção.
  async function approveProject(projectId: string, approve: boolean) {
    await api(`/api/projects/${projectId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: approve ? "approved" : "in_progress" }),
    });
    await reloadProjects();
  }

  const [busyDeliverable, setBusyDeliverable] = useState<string | null>(null);
  async function decideDeliverable(deliverableId: string, decision: "approved" | "changes_requested") {
    let note = "";
    if (decision === "changes_requested") {
      note = window.prompt("O que precisa mudar nesta peça?") ?? "";
      if (!note.trim()) return;
    }
    setBusyDeliverable(deliverableId);
    try {
      await api(`/api/deliverables/${deliverableId}/approval`, {
        method: "POST",
        body: JSON.stringify({ decision, note }),
      });
      await reloadProjects();
    } finally {
      setBusyDeliverable(null);
    }
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
            <TierProgress info={tier} celebrate celebrateKey={`levelup_client_${id}`} />
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {client.selfServe ? (
            <>
              <a
                href={`/clients/${client.id}`}
                className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90"
              >
                ⚙ Abrir meu workspace →
              </a>
              <button
                onClick={() => setChooserOpen(true)}
                className="text-sm text-muted underline-offset-2 transition-colors hover:text-foreground hover:underline"
              >
                Prefiro ter uma agência cuidando
              </button>
            </>
          ) : (
            <button
              onClick={() => setChooserOpen(true)}
              className="text-sm text-muted underline-offset-2 transition-colors hover:text-foreground hover:underline"
            >
              Quero fazer eu mesmo (modo autônomo) →
            </button>
          )}
        </div>
      </div>

      <MarcaModeChoice id={client.id} open={chooserOpen} onClose={() => setChooserOpen(false)} />

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <SectionTitle>Relatório mensal</SectionTitle>
          <p className="text-sm text-muted">
            O que foi entregue, aprovado e publicado no mês, com resumo e recomendações — pronto para salvar em PDF.
          </p>
        </div>
        <a
          href={`/portal/client/${client.id}/report`}
          data-testid="portal-monthly-report"
          className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90"
        >
          📊 Ver relatório do mês →
        </a>
      </Card>

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
                {project.deliverables.filter((d) => d.kind !== "reference").length > 0 && (
                  <div className="mt-2 space-y-2">
                    {project.deliverables
                      .filter((d) => d.kind !== "reference")
                      .map((deliverable) => {
                        const canDecide =
                          project.status === "client_approval" && deliverable.approvalStatus !== "approved";
                        const events = project.approvals.filter((e) => e.deliverableId === deliverable.id);
                        return (
                          <div
                            key={deliverable.id}
                            className="rounded-md border border-edge bg-background p-2.5"
                            data-testid="portal-deliverable"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <a
                                href={`/api/files/${deliverable.id}?download=1`}
                                className="text-xs text-muted transition-colors hover:text-accent"
                              >
                                ⬇ {deliverable.title}
                              </a>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <Tag>{APPROVAL_STATUS_LABELS[deliverable.approvalStatus]}</Tag>
                                {canDecide && (
                                  <>
                                    <Button
                                      className="!px-2.5 !py-1 text-xs"
                                      disabled={busyDeliverable === deliverable.id}
                                      onClick={() => decideDeliverable(deliverable.id, "approved")}
                                      data-testid="approve-deliverable"
                                    >
                                      ✅ Aprovar
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      className="!px-2.5 !py-1 text-xs"
                                      disabled={busyDeliverable === deliverable.id}
                                      onClick={() => decideDeliverable(deliverable.id, "changes_requested")}
                                    >
                                      ↩ Pedir ajustes
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                            {events.length > 0 && (
                              <div className="mt-2">
                                <ApprovalTimeline events={events} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}
                {project.status === "client_approval" && (
                  <div className="mt-3 rounded-md border border-accent/40 bg-accent/5 p-3">
                    <p className="text-sm font-medium">
                      Esta entrega aguarda a SUA aprovação:
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      Ao aprovar, a agência é avisada na hora e as peças de redes sociais já entram no calendário como rascunho.
                    </p>
                    <div className="mt-2 flex gap-2">
                      <Button
                        className="!px-3 !py-1.5 text-xs"
                        onClick={() => approveProject(project.id, true)}
                      >
                        ✅ Aprovar tudo
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

      {!client.selfServe && (
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
      )}

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
            {client.selfServe
              ? "Gere o relatório executivo da sua marca no workspace — ele aparece aqui quando pronto."
              : "O primeiro relatório executivo da sua conta aparecerá aqui assim que a agência gerá-lo."}
          </p>
        </Card>
      )}
    </div>
  );
}
