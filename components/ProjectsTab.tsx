"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Client } from "@/lib/types";
import {
  APPLICATION_STATUS_LABELS,
  ESCROW_LABELS,
  PROJECT_STATUS_LABELS,
  REFERENCE_MEANINGS,
  SKILL_OPTIONS,
  type Professional,
  type Project,
  type ProjectMessage,
  type Deliverable,
} from "@/lib/marketplace-types";
import type { ApplicationWithProfessional, Meeting } from "@/lib/marketplace-db";
import type { DemandSuggestions, MatchResult, SketchResult } from "@/lib/marketplace-schemas";
import { googleCalendarUrl } from "@/lib/gcal";
import DeliverableViewer from "./DeliverableViewer";
import { Button, Card, ErrorBox, Input, Label, SectionTitle, Skeleton, Spinner, Tag, Textarea } from "./ui";
import { Icon, type IconName } from "@/components/icons";

type ProjectDetailData = Project & {
  professional: Professional | null;
  messages: ProjectMessage[];
  deliverables: Deliverable[];
  meetings: Meeting[];
  applications: ApplicationWithProfessional[];
  sketches: SketchRecord[];
};

type SketchRecord = {
  id: string;
  svg: string;
  rationale: string;
  neededReferences: string[];
  createdAt: string;
};

export default function ProjectsTab({
  client,
  initialProjectId,
}: {
  client: Client;
  initialProjectId?: string;
}) {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(initialProjectId ?? null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    title: "",
    brief: "",
    skillsNeeded: [] as string[],
    location: "",
    budget: "",
    deadline: "",
    mode: "marketplace" as "marketplace" | "internal",
  });
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState<DemandSuggestions | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [idea, setIdea] = useState("");
  const [createdFromSuggestion, setCreatedFromSuggestion] = useState<Set<number>>(new Set());

  const load = useCallback(() => {
    api<Project[]>(`/api/projects?clientId=${client.id}`).then(setProjects);
  }, [client.id]);

  useEffect(load, [load]);

  async function createProject() {
    setError("");
    try {
      const project = await api<Project>("/api/projects", {
        method: "POST",
        body: JSON.stringify({ clientId: client.id, ...form }),
      });
      setCreating(false);
      setForm({ title: "", brief: "", skillsNeeded: [], location: "", budget: "", deadline: "", mode: "marketplace" });
      load();
      setSelectedId(project.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar demanda");
    }
  }

  async function suggest(withIdea: boolean) {
    setSuggesting(true);
    setError("");
    try {
      const result = await api<DemandSuggestions>("/api/projects/suggest", {
        method: "POST",
        body: JSON.stringify({ clientId: client.id, idea: withIdea ? idea : "" }),
      });
      setSuggestions(result);
      setCreatedFromSuggestion(new Set());
      if (withIdea) setIdea("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao sugerir demandas");
    } finally {
      setSuggesting(false);
    }
  }

  async function createFromSuggestion(index: number) {
    const demand = suggestions?.demands[index];
    if (!demand) return;
    await api<Project>("/api/projects", {
      method: "POST",
      body: JSON.stringify({
        clientId: client.id,
        title: demand.title,
        brief: `${demand.brief}${demand.source ? `\n\nOrigem no plano: ${demand.source}` : ""}`,
        skillsNeeded: demand.skillsNeeded,
        location: demand.location,
        budget: demand.budget,
        deadline: demand.deadline,
      }),
    });
    setCreatedFromSuggestion((prev) => new Set(prev).add(index));
    load();
  }

  if (!projects) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full rounded-xl" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (selectedId) {
    return (
      <ProjectDetail
        projectId={selectedId}
        onBack={() => {
          setSelectedId(null);
          load();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-3">
        <p className="text-sm text-muted">
          Demandas conectam esta conta a fotógrafos e designers da plataforma:
          brief → match por IA → produção → revisão com anotações e nota de
          qualidade → aprovação → pagamento garantido.
        </p>
        {!creating ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => setCreating(true)}>
                <Icon name="plus" size={15} /> Nova demanda
              </Button>
              <Button variant="ghost" onClick={() => suggest(false)} disabled={suggesting}>
                {suggesting ? (
                  "Analisando o plano..."
                ) : (
                  <>
                    <Icon name="sparkle" size={15} /> Gerar demandas do plano (IA)
                  </>
                )}
              </Button>
              {suggesting && <Spinner label="Lendo estratégia, campanha e calendário..." />}
            </div>
            <div className="flex flex-wrap gap-2">
              <Input
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                placeholder='Ou descreva uma ideia (ex.: "ensaio de inverno com os pratos novos")...'
                className="max-w-md"
              />
              <Button variant="ghost" onClick={() => suggest(true)} disabled={suggesting || !idea.trim()}>
                <Icon name="sparkle" size={15} /> Escrever brief com IA
              </Button>
            </div>
            {error && <ErrorBox message={error} />}
            {suggestions && (
              <div className="space-y-2 border-t border-edge pt-3">
                <p className="text-sm text-muted">{suggestions.summary}</p>
                {suggestions.demands.map((demand, index) => (
                  <div key={index} className="rounded-lg border border-edge bg-surface-2 p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold">{demand.title}</p>
                      {createdFromSuggestion.has(index) ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-accent"><Icon name="check" size={13} /> Criada</span>
                      ) : (
                        <Button className="!px-2.5 !py-1 text-xs" onClick={() => createFromSuggestion(index)}>
                          Criar demanda
                        </Button>
                      )}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-xs text-muted">{demand.brief}</p>
                    <p className="mt-1.5 text-xs text-muted">
                      <span className="text-accent">{demand.skillsNeeded.join(", ") || "skills livres"}</span>
                      {" · "}{demand.location || "local livre"} · {demand.budget || "verba a definir"} · {demand.deadline || "prazo a definir"}
                      {demand.source && ` · origem: ${demand.source}`}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label>Execução</Label>
              <div className="flex gap-2">
                {(
                  [
                    { value: "marketplace", label: "Com freelas da plataforma", icon: "globe" },
                    { value: "internal", label: "Interna (meu time)", icon: "home" },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, mode: option.value }))}
                    className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors ${
                      form.mode === option.value
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-edge bg-surface-2 text-muted hover:border-muted"
                    }`}
                  >
                    <Icon name={option.icon} size={15} />
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <Label>Título *</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Ex.: Ensaio de produto para campanha de agosto"
                />
              </div>
              <div>
                <Label>Local da produção</Label>
                <Input
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  placeholder="Ex.: Curitiba/PR ou remoto"
                />
              </div>
            </div>
            <div>
              <Label>Brief</Label>
              <Textarea
                value={form.brief}
                onChange={(e) => setForm((f) => ({ ...f, brief: e.target.value }))}
                placeholder="O que precisa ser produzido, referências, entregáveis esperados..."
              />
            </div>
            <div>
              <Label>Skills necessárias</Label>
              <div className="flex flex-wrap gap-2">
                {SKILL_OPTIONS.map((skill) => {
                  const active = form.skillsNeeded.includes(skill);
                  return (
                    <button
                      key={skill}
                      type="button"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          skillsNeeded: active
                            ? f.skillsNeeded.filter((s) => s !== skill)
                            : [...f.skillsNeeded, skill],
                        }))
                      }
                      className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                        active
                          ? "border-accent bg-accent text-accent-ink"
                          : "border-edge bg-surface-2 text-muted hover:border-muted"
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
                <Label>Verba</Label>
                <Input
                  value={form.budget}
                  onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))}
                  placeholder="Ex.: R$ 1.200"
                />
              </div>
              <div>
                <Label>Prazo</Label>
                <Input
                  value={form.deadline}
                  onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
                  placeholder="Ex.: 15/09/2026"
                />
              </div>
            </div>
            {error && <ErrorBox message={error} />}
            <div className="flex gap-2">
              <Button onClick={createProject}>Criar demanda</Button>
              <Button variant="ghost" onClick={() => setCreating(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </Card>

      {projects.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">Nenhuma demanda ainda.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {projects.map((project) => (
            <button
              key={project.id}
              onClick={() => setSelectedId(project.id)}
              className="rounded-xl border border-edge bg-surface p-4 text-left transition-colors hover:border-accent/60"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">{project.title}</p>
                <Tag>{PROJECT_STATUS_LABELS[project.status]}</Tag>
              </div>
              <p className="mt-1 text-xs text-muted">
                {project.skillsNeeded.join(", ") || "skills n/d"} · {project.budget || "verba n/d"}
              </p>
              <p className="mt-1 text-xs text-muted">
                {ESCROW_LABELS[project.escrow]} · criada em{" "}
                {new Date(project.createdAt).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectDetail({ projectId, onBack }: { projectId: string; onBack: () => void }) {
  const [project, setProject] = useState<ProjectDetailData | null>(null);
  const [match, setMatch] = useState<MatchResult | null>(null);
  const [matching, setMatching] = useState(false);
  const [error, setError] = useState("");
  const [messageText, setMessageText] = useState("");
  const [sender, setSender] = useState<"agency" | "professional">("agency");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [meetingForm, setMeetingForm] = useState({ title: "", scheduledAt: "", link: "" });
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ title: "", brief: "", budget: "", deadline: "" });
  const [sketching, setSketching] = useState(false);
  const [sketchIndex, setSketchIndex] = useState(0);
  const [refMeaning, setRefMeaning] = useState<string>(REFERENCE_MEANINGS[0]);
  const [refUploading, setRefUploading] = useState(false);
  const [mocking, setMocking] = useState(false);
  const [concepting, setConcepting] = useState(false);

  const load = useCallback(() => {
    api<ProjectDetailData>(`/api/projects/${projectId}`).then((data) => {
      setProject(data);
      if (data.matchResult) setMatch(JSON.parse(data.matchResult) as MatchResult);
    });
  }, [projectId]);

  useEffect(load, [load]);

  // Co-working leve: atualiza a cada 8s para refletir edições/mensagens de
  // outros usuários trabalhando na mesma demanda em paralelo
  useEffect(() => {
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
  }, [load]);

  async function patch(body: Record<string, unknown>) {
    setError("");
    try {
      await api(`/api/projects/${projectId}`, { method: "PATCH", body: JSON.stringify(body) });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar");
    }
  }

  async function runMatch() {
    setMatching(true);
    setError("");
    try {
      setMatch(await api<MatchResult>(`/api/projects/${projectId}/match`, { method: "POST" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro no match");
    } finally {
      setMatching(false);
    }
  }

  async function sendMessage() {
    if (!messageText.trim()) return;
    await api(`/api/projects/${projectId}/messages`, {
      method: "POST",
      body: JSON.stringify({ sender, text: messageText.trim() }),
    });
    setMessageText("");
    load();
  }

  async function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("title", uploadTitle || file.name);
      const response = await fetch(`/api/projects/${projectId}/deliverables`, {
        method: "POST",
        body,
      });
      if (!response.ok) throw new Error((await response.json()).error ?? "Erro no upload");
      setUploadTitle("");
      if (project && ["open", "matched", "in_progress"].includes(project.status)) {
        await patch({ status: "in_review" });
      } else {
        load();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro no upload");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  if (!project) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64 rounded-md" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  const references = project.deliverables.filter((d) => d.kind === "reference");
  const deliveries = project.deliverables.filter((d) => d.kind !== "reference");

  const internal = project.mode === "internal";
  const nextActions: { label: string; icon?: IconName; body: Record<string, unknown> }[] = [];
  if (internal) {
    if (project.status === "open") {
      nextActions.push({ label: "🚀 Iniciar produção", body: { status: "in_progress" } });
    }
    if (project.status === "in_review") {
      nextActions.push({ label: "Aprovar entrega", icon: "check", body: { status: "approved" } });
      nextActions.push({ label: "↩ Voltar para produção", body: { status: "in_progress" } });
    }
    if (project.status === "approved") {
      nextActions.push({ label: "Concluir demanda", icon: "check", body: { status: "paid" } });
    }
  } else {
    if (project.status === "matched" && project.escrow === "none") {
      nextActions.push({
        label: "Reservar pagamento (escrow) e iniciar produção",
        icon: "money",
        body: { escrow: "held", status: "in_progress" },
      });
    }
    if (project.status === "in_review") {
      nextActions.push({ label: "Enviar para aprovação do cliente", icon: "user", body: { status: "client_approval" } });
      nextActions.push({ label: "Aprovar direto", icon: "check", body: { status: "approved" } });
      nextActions.push({ label: "↩ Voltar para produção (ajustes)", body: { status: "in_progress" } });
    }
    if (project.status === "client_approval") {
      nextActions.push({ label: "Aprovar em nome do cliente", icon: "check", body: { status: "approved" } });
      nextActions.push({ label: "↩ Voltar para produção", body: { status: "in_progress" } });
    }
    if (project.status === "approved" && project.escrow === "held") {
      nextActions.push({
        label: "Liberar pagamento ao profissional",
        icon: "money",
        body: { escrow: "released", status: "paid" },
      });
    }
  }

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="text-sm text-accent hover:underline">
        ← Todas as demandas
      </button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold">
            {project.title}
          </h2>
          <div className="mt-2 flex flex-wrap gap-2">
            <Tag>{PROJECT_STATUS_LABELS[project.status]}</Tag>
            <Tag>{ESCROW_LABELS[project.escrow]}</Tag>
            {project.budget && <Tag>{project.budget}</Tag>}
            {project.deadline && <Tag>até {project.deadline}</Tag>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {nextActions.map((action) => (
            <Button key={action.label} onClick={() => patch(action.body)}>
              {action.icon && <Icon name={action.icon} size={15} />}
              {action.label}
            </Button>
          ))}
          <Button
            variant="ghost"
            onClick={() => {
              setEditForm({
                title: project.title,
                brief: project.brief,
                budget: project.budget,
                deadline: project.deadline,
              });
              setEditing((e) => !e);
            }}
          >
            {editing ? "Fechar edição" : "Editar demanda"}
          </Button>
          <Button
            variant="ghost"
            onClick={async () => {
              await api(`/api/projects`, {
                method: "POST",
                body: JSON.stringify({
                  clientId: project.clientId,
                  title: `${project.title} (cópia)`,
                  brief: project.brief,
                  skillsNeeded: project.skillsNeeded,
                  location: project.location,
                  budget: project.budget,
                  deadline: "",
                  mode: project.mode,
                }),
              });
              alert("Demanda duplicada — veja na lista de demandas.");
            }}
          >
            <Icon name="copy" size={15} /> Duplicar
          </Button>
        </div>
      </div>
      {editing ? (
        <Card className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-1">
              <Label>Título</Label>
              <Input
                value={editForm.title}
                onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div>
              <Label>Verba</Label>
              <Input
                value={editForm.budget}
                onChange={(e) => setEditForm((f) => ({ ...f, budget: e.target.value }))}
              />
            </div>
            <div>
              <Label>Prazo</Label>
              <Input
                value={editForm.deadline}
                onChange={(e) => setEditForm((f) => ({ ...f, deadline: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <Label>Brief</Label>
            <Textarea
              value={editForm.brief}
              className="min-h-32"
              onChange={(e) => setEditForm((f) => ({ ...f, brief: e.target.value }))}
            />
          </div>
          <Button
            onClick={async () => {
              await patch(editForm);
              setEditing(false);
            }}
          >
            Salvar demanda
          </Button>
        </Card>
      ) : (
        project.brief && <p className="whitespace-pre-wrap text-sm text-muted">{project.brief}</p>
      )}
      {error && <ErrorBox message={error} />}

      {internal ? (
        <Card>
          <SectionTitle>Execução interna</SectionTitle>
          <p className="text-sm text-muted">
            Demanda gerenciada pelo time interno da agência — sem match de freelas
            nem escrow. Use o sketch, as referências, o chat e as entregas com
            revisão normalmente.
          </p>
        </Card>
      ) : (
      <Card className="space-y-3">
        <SectionTitle>Profissional</SectionTitle>
        {project.applications.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">
              Candidaturas ({project.applications.length})
            </p>
            {project.applications.map((application) => (
              <div
                key={application.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-edge bg-surface-2 p-3 text-sm"
              >
                <div>
                  <Link
                    href={`/professionals/${application.professionalId}`}
                    className="font-semibold text-accent hover:underline"
                  >
                    {application.professionalName}
                  </Link>{" "}
                  <span className="text-xs text-muted">
                    ({application.professionalRole}, {application.professionalLocation})
                  </span>
                  {application.message && (
                    <p className="text-xs text-muted">“{application.message}”</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Tag>{APPLICATION_STATUS_LABELS[application.status]}</Tag>
                  {application.status === "pending" && (
                    <>
                      <Button
                        className="!px-2.5 !py-1 text-xs"
                        onClick={async () => {
                          await api(`/api/applications/${application.id}`, {
                            method: "PATCH",
                            body: JSON.stringify({ status: "accepted" }),
                          });
                          load();
                        }}
                      >
                        Aceitar
                      </Button>
                      <Button
                        variant="danger"
                        className="!px-2.5 !py-1 text-xs"
                        onClick={async () => {
                          await api(`/api/applications/${application.id}`, {
                            method: "PATCH",
                            body: JSON.stringify({ status: "rejected" }),
                          });
                          load();
                        }}
                      >
                        Recusar
                      </Button>
                    </>
                  )}
                  {application.status === "accepted" &&
                    project.professionalId !== application.professionalId && (
                      <Button
                        variant="ghost"
                        className="!px-2.5 !py-1 text-xs"
                        onClick={() =>
                          patch({ professionalId: application.professionalId, status: "matched" })
                        }
                      >
                        ⭐ Definir como preferido
                      </Button>
                    )}
                </div>
              </div>
            ))}
            <p className="text-xs text-muted">
              Você pode aceitar mais de uma candidatura para comparar entregas
              (pagando ambas) e depois definir o preferido.
            </p>
          </div>
        )}
        {project.professional ? (
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <p>
              Vinculado:{" "}
              <Link
                href={`/professionals/${project.professional.id}`}
                className="font-semibold text-accent hover:underline"
              >
                {project.professional.name}
              </Link>{" "}
              <span className="text-muted">({project.professional.location})</span>
            </p>
            {project.status === "matched" && (
              <Button variant="ghost" onClick={() => patch({ professionalId: null, status: "open" })}>
                Desvincular
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <Button onClick={runMatch} disabled={matching}>
                {matching ? (
                  "Analisando fit..."
                ) : (
                  <>
                    <Icon name="sparkle" size={15} /> Match por IA
                  </>
                )}
              </Button>
              {matching && (
                <Spinner label="Cruzando briefing, estratégia e track record dos profissionais..." />
              )}
            </div>
            {match && (
              <div className="space-y-2">
                <p className="text-sm text-muted">{match.summary}</p>
                {match.matches.map((candidate) => (
                  <div
                    key={candidate.professionalId}
                    className="rounded-lg border border-edge bg-surface-2 p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold">
                        {candidate.name}{" "}
                        <span
                          className="ml-1 font-[family-name:var(--font-display)]"
                          style={{ color: candidate.fit >= 75 ? "#7de2d1" : candidate.fit >= 50 ? "#e6c229" : "#f87171" }}
                        >
                          {candidate.fit}% fit
                        </span>
                      </p>
                      <div className="flex gap-2">
                        <Link
                          href={`/professionals/${candidate.professionalId}`}
                          className="text-xs text-accent hover:underline"
                        >
                          Ver portfolio →
                        </Link>
                        <Button
                          className="!px-2.5 !py-1 text-xs"
                          onClick={() =>
                            patch({ professionalId: candidate.professionalId, status: "matched" })
                          }
                        >
                          Vincular ao projeto
                        </Button>
                      </div>
                    </div>
                    <ul className="mt-1 list-disc pl-5 text-xs text-muted">
                      {candidate.reasons.map((reason, i) => (
                        <li key={i}>{reason}</li>
                      ))}
                      {candidate.gaps.map((gap, i) => (
                        <li key={`g${i}`} className="text-amber-400/80">
                          {gap}
                        </li>
                      ))}
                    </ul>
                    {candidate.suggestedBrief && (
                      <p className="mt-1 text-xs text-muted">
                        <span className="text-accent">Mini-brief: </span>
                        {candidate.suggestedBrief}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </Card>
      )}

      <Card className="space-y-3">
        <SectionTitle>Referências (fotos base)</SectionTitle>
        <p className="text-sm text-muted">
          Suba as fotos que a produção deve seguir — a peça, a modelo, a equipe, o
          local — marcando o significado de cada uma. O sketch da IA e o
          profissional usam essas referências como base.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={refMeaning}
            onChange={(e) => setRefMeaning(e.target.value)}
            className="rounded-md border border-edge bg-surface-2 px-2 py-2 text-sm text-foreground outline-none"
          >
            {REFERENCE_MEANINGS.map((meaning) => (
              <option key={meaning} value={meaning}>
                {meaning}
              </option>
            ))}
          </select>
          <label className="cursor-pointer rounded-md border border-edge bg-surface-2 px-3.5 py-2 text-sm text-foreground transition-colors hover:border-accent">
            {refUploading ? "Enviando..." : "⬆ Enviar referência"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm"
              className="hidden"
              disabled={refUploading}
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                setRefUploading(true);
                try {
                  const body = new FormData();
                  body.append("file", file);
                  body.append("title", `${refMeaning} — ${file.name}`);
                  body.append("kind", "reference");
                  body.append("meaning", refMeaning);
                  await fetch(`/api/projects/${projectId}/deliverables`, {
                    method: "POST",
                    body,
                  });
                  load();
                } finally {
                  setRefUploading(false);
                  event.target.value = "";
                }
              }}
            />
          </label>
        </div>
        {references.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {references.map((reference) => (
              <div
                key={reference.id}
                className="w-36 rounded-lg border border-edge bg-surface-2 p-2"
              >
                {reference.mime.startsWith("video/") ? (
                  <video
                    src={`/api/files/${reference.id}`}
                    className="h-24 w-full rounded object-cover"
                    controls
                    muted
                  />
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={`/api/files/${reference.id}`}
                    alt={reference.meaning}
                    className="h-24 w-full rounded object-cover"
                  />
                )}
                <div className="mt-1.5 flex items-center justify-between gap-1">
                  <Tag>{reference.meaning || "referência"}</Tag>
                  <span className="flex gap-1 text-xs">
                    <a
                      href={`/api/files/${reference.id}?download=1`}
                      className="text-muted hover:text-accent"
                      title="Baixar"
                    >
                      ⬇
                    </a>
                    <button
                      className="text-muted hover:text-red-400"
                      title="Excluir"
                      onClick={async () => {
                        await api(`/api/deliverables/${reference.id}`, { method: "DELETE" });
                        load();
                      }}
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionTitle>Sketch de referência (IA)</SectionTitle>
          <span className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              disabled={sketching}
              onClick={async () => {
                setSketching(true);
                setError("");
                try {
                  await api(`/api/projects/${projectId}/sketch`, { method: "POST" });
                  load();
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Erro no sketch");
                } finally {
                  setSketching(false);
                }
              }}
            >
              {sketching
                ? "Desenhando..."
                : project.sketch
                  ? "↻ Regerar sketch"
                  : (
                    <>
                      <Icon name="edit" size={15} /> Gerar sketch da composição
                    </>
                  )}
            </Button>
            <Button
              disabled={mocking}
              onClick={async () => {
                setMocking(true);
                setError("");
                try {
                  await api(`/api/projects/${projectId}/mockup`, { method: "POST" });
                  load();
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Erro no mockup");
                } finally {
                  setMocking(false);
                }
              }}
            >
              {mocking ? (
                "Compondo imagem..."
              ) : (
                <>
                  <Icon name="image" size={15} /> Gerar mockup fotorrealista
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              disabled={concepting}
              onClick={async () => {
                setConcepting(true);
                setError("");
                try {
                  await api(`/api/projects/${projectId}/concepts`, {
                    method: "POST",
                    body: JSON.stringify({ count: 4 }),
                  });
                  load();
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Erro nos conceitos");
                } finally {
                  setConcepting(false);
                }
              }}
              title="Gera 4 imagens-conceito grátis (text-to-image, sem custo)"
            >
              {concepting ? (
                "Gerando 4 conceitos..."
              ) : (
                <>
                  <Icon name="sparkle" size={15} /> Gerar 4 conceitos (grátis)
                </>
              )}
            </Button>
          </span>
        </div>
        {concepting && (
          <Spinner label="Gerando conceitos grátis (Pollinations/Together FLUX)..." />
        )}
        {sketching && <Spinner label="A IA está desenhando o rafe da composição (1-2 min)..." />}
        {project.sketches.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {project.sketches.map((version, index) => (
              <button
                key={version.id}
                onClick={() => setSketchIndex(index)}
                className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                  index === sketchIndex
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-edge bg-surface-2 text-muted hover:border-muted"
                }`}
              >
                v{project.sketches.length - index} ·{" "}
                {new Date(version.createdAt).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </button>
            ))}
          </div>
        )}
        {project.sketches.length > 0 ? (
          (() => {
            const record = project.sketches[Math.min(sketchIndex, project.sketches.length - 1)];
            const sketch: SketchResult = {
              svg: record.svg,
              rationale: record.rationale,
              neededReferences: record.neededReferences,
            };
            return (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-lg border border-edge bg-white p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`data:image/svg+xml;utf8,${encodeURIComponent(sketch.svg)}`}
                    alt="Sketch de referência"
                    className="mx-auto max-h-[60vh] w-auto max-w-full"
                  />
                </div>
                <div className="space-y-2 text-sm text-muted">
                  <p>
                    <span className="font-semibold text-foreground/80">
                      Direção de arte:{" "}
                    </span>
                    {sketch.rationale}
                  </p>
                  {(sketch.neededReferences?.length ?? 0) > 0 && (
                    <div className="rounded-md border border-amber-900/50 bg-amber-950/30 p-3 text-xs">
                      <p className="mb-1 font-semibold uppercase text-amber-400">
                        Para um sketch mais fiel, envie nas Referências:
                      </p>
                      <ul className="list-disc space-y-0.5 pl-4">
                        {sketch.neededReferences.map((need, i) => (
                          <li key={i}>{need}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <a
                    href={`data:image/svg+xml;utf8,${encodeURIComponent(sketch.svg)}`}
                    download="sketch-referencia.svg"
                    className="inline-block rounded-md border border-edge bg-surface-2 px-3 py-1.5 text-xs transition-colors hover:border-accent hover:text-accent"
                  >
                    ⬇ Baixar SVG para enviar ao profissional
                  </a>
                </div>
              </div>
            );
          })()
        ) : (
          !sketching && (
            <p className="text-sm text-muted">
              Gere um rafe visual da composição esperada (enquadramento, posição de
              produto, texto e CTA) para anexar ao brief — o profissional executa sem
              ambiguidade.
            </p>
          )
        )}
      </Card>

      <Card className="space-y-3">
        <SectionTitle>Reuniões</SectionTitle>
        {project.meetings.length > 0 && (
          <div className="space-y-1.5">
            {project.meetings.map((meeting) => (
              <div
                key={meeting.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-edge bg-surface-2 px-3 py-2 text-sm"
              >
                <p>
                  <span className="font-medium">{meeting.title}</span>{" "}
                  <span className="text-muted">
                    · {new Date(meeting.scheduledAt).toLocaleString("pt-BR")}
                  </span>
                  {meeting.link && (
                    <a
                      href={meeting.link}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-2 text-accent hover:underline"
                    >
                      entrar ↗
                    </a>
                  )}
                  <a
                    href={googleCalendarUrl(meeting)}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-2 inline-flex items-center gap-1 text-muted hover:text-accent"
                    title="Adicionar ao Google Calendar (e anexar o Meet por lá)"
                  >
                    <Icon name="calendar" size={13} /> Calendar
                  </a>
                </p>
                <button
                  className="text-xs text-muted hover:text-red-400"
                  onClick={async () => {
                    await api(`/api/meetings/${meeting.id}`, { method: "DELETE" });
                    load();
                  }}
                >
                  Cancelar
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="grid gap-2 sm:grid-cols-4">
          <Input
            placeholder="Título (ex.: alinhamento de brief)"
            value={meetingForm.title}
            onChange={(e) => setMeetingForm((f) => ({ ...f, title: e.target.value }))}
          />
          <Input
            type="datetime-local"
            value={meetingForm.scheduledAt}
            onChange={(e) => setMeetingForm((f) => ({ ...f, scheduledAt: e.target.value }))}
          />
          <Input
            placeholder="Link (Meet/Zoom)"
            value={meetingForm.link}
            onChange={(e) => setMeetingForm((f) => ({ ...f, link: e.target.value }))}
          />
          <Button
            variant="ghost"
            onClick={async () => {
              if (!meetingForm.title || !meetingForm.scheduledAt) return;
              await api(`/api/projects/${projectId}/meetings`, {
                method: "POST",
                body: JSON.stringify({ ...meetingForm, notes: "" }),
              });
              setMeetingForm({ title: "", scheduledAt: "", link: "" });
              load();
            }}
          >
            Agendar
          </Button>
        </div>
      </Card>

      <Card className="space-y-3">
        <SectionTitle>Chat do projeto</SectionTitle>
        <div className="max-h-64 space-y-2 overflow-y-auto">
          {project.messages.length === 0 && (
            <p className="text-sm text-muted">Nenhuma mensagem ainda.</p>
          )}
          {project.messages.map((message) => (
            <div
              key={message.id}
              className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                message.sender === "agency"
                  ? "ml-auto bg-accent/15 text-foreground"
                  : "bg-surface-2 text-foreground"
              }`}
            >
              <p className="text-[10px] uppercase tracking-wide text-muted">
                {message.sender === "agency" ? "Agência" : "Profissional"} ·{" "}
                {new Date(message.createdAt).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
              {message.text}
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <select
            value={sender}
            onChange={(e) => setSender(e.target.value as "agency" | "professional")}
            className="rounded-md border border-edge bg-surface-2 px-2 py-2 text-xs text-muted outline-none"
          >
            <option value="agency">Agência</option>
            <option value="professional">Profissional</option>
          </select>
          <Input
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Escreva uma mensagem..."
          />
          <Button onClick={sendMessage}>Enviar</Button>
        </div>
      </Card>

      <div className="space-y-4">
        <Card className="space-y-2">
          <SectionTitle>Entregas</SectionTitle>
          <p className="text-sm text-muted">
            Envie a arte/foto para revisão: clique na imagem para marcar ajustes e
            rode a análise de qualidade da IA (nota 0-100 no contexto da campanha).
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              placeholder="Título da entrega (opcional)"
              className="max-w-xs"
            />
            <label className="cursor-pointer rounded-md bg-accent px-3.5 py-2 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90">
              {uploading ? "Enviando..." : "⬆ Enviar imagem"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={upload}
                disabled={uploading}
              />
            </label>
          </div>
        </Card>
        {deliveries.map((deliverable) => (
          <DeliverableViewer key={deliverable.id} deliverable={deliverable} />
        ))}
      </div>
    </div>
  );
}
