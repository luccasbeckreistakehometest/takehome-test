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
import { Button, EmptyState, Input, SectionTitle, Spinner, Tag } from "@/components/ui";
import { buttonClass } from "@/lib/button-class";
import MarcaModeChoice from "@/components/MarcaModeChoice";
import PulsePrompt from "@/components/PulsePrompt";
import ScopeRequestCard from "@/components/ScopeRequestCard";
import PortalInvoicesCard from "@/components/PortalInvoicesCard";
import OnboardingModal from "@/components/OnboardingModal";
import ActivationChecklist from "@/components/ActivationChecklist";
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
  // canChooseMode: só a marca que se cadastrou sozinha troca o próprio modo
  const [client, setClient] = useState<(Client & { canChooseMode?: boolean }) | null>(null);
  const [tier, setTier] = useState<TierInfo | null>(null);
  const [report, setReport] = useState<Generation | null>(null);
  const [landings, setLandings] = useState<Generation[]>([]);
  const [projects, setProjects] = useState<ProjectDetail[]>([]);
  const [messages, setMessages] = useState<AccountMessage[]>([]);
  const [chatText, setChatText] = useState("");
  // Abre o seletor de modo logo após o cadastro (?choose=1). O portal só
  // aparece depois do primeiro fetch, então o servidor e o navegador batem.
  const [chooserOpen, setChooserOpen] = useState(
    () => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("choose") === "1"
  );
  // recarrega o pulso depois de cada aprovação (a pergunta "como foi?" aparece na hora)
  const [pulseKey, setPulseKey] = useState(0);

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
    if (approve) setPulseKey((k) => k + 1);
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
      if (decision === "approved") setPulseKey((k) => k + 1);
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

  if (!client) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner label="Carregando portal..." />
      </div>
    );
  }

  return (
    // Portal: é a tela que o CLIENTE da agência abre. Régua estrutural no
    // cabeçalho, seções separadas por régua em vez de cartão e nenhum botão de
    // marca repetido — a marca aparece uma vez, no relatório do mês.
    <div>
      <div className="border-b border-edge pb-5">
        <p className="t6 text-text-muted">Portal do cliente</p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="d3">
            {client.name}
          </h1>
          {tier && <TierBadge info={tier} />}
        </div>
        <p className="t3 measure-lede mt-2 text-text-muted">
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
                className={buttonClass("primary")}
              >
                Abrir meu workspace
              </a>
              {client.canChooseMode !== false && (
                <button
                  onClick={() => setChooserOpen(true)}
                  className="t3 text-text-muted underline-offset-2 transition-colors hover:text-text hover:underline"
                >
                  Prefiro ter uma agência cuidando
                </button>
              )}
            </>
          ) : client.canChooseMode !== false ? (
            <button
              onClick={() => setChooserOpen(true)}
              className="t3 text-text-muted underline-offset-2 transition-colors hover:text-text hover:underline"
            >
              Quero fazer eu mesmo (modo autônomo)
            </button>
          ) : null}
        </div>
      </div>

      {client.canChooseMode !== false && (
        <MarcaModeChoice id={client.id} open={chooserOpen} onClose={() => setChooserOpen(false)} />
      )}

      {!client.selfServe && (
        <>
          <OnboardingModal role="managed" />
          <ActivationChecklist expect="managed" />
          <PulsePrompt clientId={client.id} refreshKey={pulseKey} />
        </>
      )}

      <section className="mt-8 flex flex-wrap items-end justify-between gap-4 border-b border-edge pb-5">
        <div className="min-w-0">
          <SectionTitle>Relatório mensal</SectionTitle>
          <p className="t3 measure-prose text-text-muted">
            O que foi entregue, aprovado e publicado no mês, com resumo e recomendações — pronto
            para salvar em PDF.
          </p>
        </div>
        <a
          href={`/portal/client/${client.id}/report`}
          data-testid="portal-monthly-report"
          className={buttonClass("primary")}
        >
          Ver relatório do mês
        </a>
      </section>

      <section id="producoes" className="mt-8 scroll-mt-20" data-tour="portal-deliverables">
        <SectionTitle>Produções em andamento</SectionTitle>
        {projects.length === 0 ? (
          <p className="t3 text-text-muted">Nenhuma produção com profissionais no momento.</p>
        ) : (
          <div className="space-y-2">
            {projects.map((project) => (
              <div key={project.id} className="t3 border-b border-rule py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{project.title}</p>
                  <div className="flex gap-1.5">
                    <Tag>{PROJECT_STATUS_LABELS[project.status]}</Tag>
                    <Tag>{ESCROW_LABELS[project.escrow]}</Tag>
                  </div>
                </div>
                {project.professional && (
                  <p className="mt-1 t5 text-text-muted">
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
                                className="t5 text-text-muted transition-colors hover:text-text"
                              >{deliverable.title}
                              </a>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <Tag>{APPROVAL_STATUS_LABELS[deliverable.approvalStatus]}</Tag>
                                {canDecide && (
                                  <>
                                    <Button
                                      className="!px-2.5 !py-1 t5"
                                      disabled={busyDeliverable === deliverable.id}
                                      onClick={() => decideDeliverable(deliverable.id, "approved")}
                                      data-testid="approve-deliverable"
                                    >Aprovar
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      className="!px-2.5 !py-1 t5"
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
                  <div className="mt-3 rounded-md border border-edge bg-surface-sunken p-3">
                    <p className="t3 font-medium">
                      Esta entrega aguarda a SUA aprovação:
                    </p>
                    <p className="mt-1 t5 text-text-muted">
                      Ao aprovar, a agência é avisada na hora e as peças de redes sociais já entram no calendário como rascunho.
                    </p>
                    <div className="mt-2 flex gap-2">
                      <Button
                        className="!px-3 !py-1.5 t5"
                        onClick={() => approveProject(project.id, true)}
                      >Aprovar tudo
                      </Button>
                      <Button
                        variant="ghost"
                        className="!px-3 !py-1.5 t5"
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
      </section>

      {!client.selfServe && (
      <div className="ed-grid mt-10">
        <section id="conversa" className="c6 scroll-mt-20 space-y-3" data-tour="portal-chat">
          <SectionTitle>Fale com a agência</SectionTitle>
          <div className="scroll-y max-h-56 space-y-2">
            {messages.length === 0 && (
              <p className="t3 text-text-muted">Nenhuma mensagem ainda — diga oi!</p>
            )}
            {messages.map((message) => (
              <div
                key={message.id}
                className={`max-w-[85%] rounded-lg px-3 py-2 t3 ${
                  message.sender === "client"
                    ? "ml-auto bg-surface-sunken"
                    : "bg-surface-sunken"
                }`}
              >
                <p className="t6 text-text-muted">
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
            <Button variant="secondary" onClick={sendChat}>Enviar</Button>
          </div>
        </section>

        <div className="c5 c-start8">
          <div id="pacote" className="scroll-mt-20" data-tour="portal-scope">
            <ScopeRequestCard clientId={id} />
          </div>
          <div id="faturas" className="mt-8 scroll-mt-20" data-tour="portal-invoices">
            <PortalInvoicesCard clientId={id} />
          </div>
        </div>
      </div>
      )}

      {landings.length > 0 && (
        <section className="mt-10 border-t border-edge pt-4">
          <SectionTitle>Suas landing pages</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {landings.map((landing) => (
              <span key={landing.id} className="flex gap-1">
                <a
                  href={`/api/generations/${landing.id}/html`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md border border-edge bg-surface-sunken px-3 py-1.5 t3 text-text-muted transition-colors hover:border-edge hover:text-text"
                >
                  {landing.title}
                </a>
                <a
                  href={`/api/generations/${landing.id}/html?download=1`}
                  className="rounded-md border border-edge bg-surface-sunken px-2 py-1.5 t3 text-text-muted transition-colors hover:border-edge hover:text-text"
                  title="Baixar HTML"
                ></a>
              </span>
            ))}
          </div>
        </section>
      )}

      {report ? (
        <div className="mt-10 border-t border-edge pt-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="d4">
              {report.title}
            </h2>
            <a
              href={`/print/${report.id}`}
              target="_blank"
              rel="noreferrer"
              className={buttonClass("secondary")}
            >
              Salvar em PDF
            </a>
          </div>
          <ClientReportView data={JSON.parse(report.content) as ClientReport} />
        </div>
      ) : (
        <div className="mt-10">
          <EmptyState
            icon="doc"
            title="Relatório executivo ainda não gerado"
            condition={
              client.selfServe
                ? "Gere o relatório executivo da sua marca no workspace — ele aparece aqui quando pronto."
                : "O primeiro relatório executivo da sua conta aparecerá aqui assim que a agência gerá-lo."
            }
          />
        </div>
      )}
    </div>
  );
}
