"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import {
  REVIEW_ROLE_LABELS,
  type Annotation,
  type ArtReview,
  type Deliverable,
  type ReviewRole,
} from "@/lib/marketplace-types";
import type { ArtReviewContent } from "@/lib/marketplace-schemas";
import { Button, Card, ErrorBox, SectionTitle, Spinner, Tag, Textarea } from "./ui";
import { Icon } from "./icons";
import ApprovalTimeline from "./ApprovalTimeline";
import { APPROVAL_STATUS_LABELS } from "@/lib/marketplace-types";
import type { ApprovalEvent } from "@/lib/approvals-db";

// Comentários genéricos (thread) — funcionam para qualquer entregável, texto
// ou imagem. Tipo local para não importar comments-db (server-only) no client.
type DeliverableComment = {
  id: string;
  deliverableId: string;
  author: ReviewRole;
  authorName: string;
  body: string;
  createdAt: string;
};

function scoreColor(score: number): string {
  if (score >= 80) return "#7de2d1";
  if (score >= 60) return "#e6c229";
  return "#f87171";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DeliverableViewer({ deliverable }: { deliverable: Deliverable }) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [reviews, setReviews] = useState<ArtReview[]>([]);
  const [pending, setPending] = useState<{ x: number; y: number } | null>(null);
  const [comment, setComment] = useState("");
  const [author, setAuthor] = useState<ReviewRole>("agency");
  const [audience, setAudience] = useState<ReviewRole | "all">("all");
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState("");
  const [comments, setComments] = useState<DeliverableComment[]>([]);
  const [commentBody, setCommentBody] = useState("");
  const [commentAuthor, setCommentAuthor] = useState<ReviewRole>("agency");
  const [posting, setPosting] = useState(false);
  const [approval, setApproval] = useState<{
    approvalStatus: Deliverable["approvalStatus"];
    events: ApprovalEvent[];
  } | null>(null);
  const [deciding, setDeciding] = useState(false);
  const imageRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    api<Annotation[]>(`/api/deliverables/${deliverable.id}/annotations`).then(setAnnotations);
    api<ArtReview[]>(`/api/deliverables/${deliverable.id}/review`).then(setReviews);
    api<DeliverableComment[]>(`/api/deliverables/${deliverable.id}/comments`).then(setComments);
    api<{ approvalStatus: Deliverable["approvalStatus"]; events: ApprovalEvent[] }>(
      `/api/deliverables/${deliverable.id}/approval`
    )
      .then(setApproval)
      .catch(() => {});
  }, [deliverable.id]);

  // Aprovação em nome do cliente: mesma regra do portal (rascunho de post
  // quando é peça social), sem o aviso de WhatsApp — a agência é quem aprovou.
  async function approveHere() {
    setDeciding(true);
    try {
      await api(`/api/deliverables/${deliverable.id}/approval`, {
        method: "POST",
        body: JSON.stringify({ decision: "approved" }),
      });
      load();
    } finally {
      setDeciding(false);
    }
  }

  useEffect(load, [load]);

  function handleImageClick(event: React.MouseEvent) {
    const rect = imageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setPending({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });
    setComment("");
  }

  async function saveAnnotation() {
    if (!pending || !comment.trim()) return;
    await api(`/api/deliverables/${deliverable.id}/annotations`, {
      method: "POST",
      body: JSON.stringify({ ...pending, comment: comment.trim(), author, audience }),
    });
    setPending(null);
    setComment("");
    load();
  }

  async function runReview() {
    setReviewing(true);
    setError("");
    try {
      await api(`/api/deliverables/${deliverable.id}/review`, { method: "POST" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro na análise");
    } finally {
      setReviewing(false);
    }
  }

  async function postComment() {
    if (!commentBody.trim()) return;
    setPosting(true);
    setError("");
    try {
      await api(`/api/deliverables/${deliverable.id}/comments`, {
        method: "POST",
        body: JSON.stringify({
          author: commentAuthor,
          authorName: REVIEW_ROLE_LABELS[commentAuthor],
          body: commentBody.trim(),
        }),
      });
      setCommentBody("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao comentar");
    } finally {
      setPosting(false);
    }
  }

  async function removeComment(commentId: string) {
    await api(`/api/deliverables/${deliverable.id}/comments?commentId=${commentId}`, {
      method: "DELETE",
    });
    load();
  }

  const latestReview = reviews[0];
  const reviewContent: ArtReviewContent | null = latestReview
    ? (JSON.parse(latestReview.content) as ArtReviewContent)
    : null;

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">{deliverable.title}</p>
        <div className="flex items-center gap-2">
          {approval && (
            <Tag>{APPROVAL_STATUS_LABELS[approval.approvalStatus ?? "pending"]}</Tag>
          )}
          {approval && approval.approvalStatus !== "approved" && (
            <Button
              variant="ghost"
              className="!px-2 !py-1 t5"
              disabled={deciding}
              onClick={approveHere}
              title="Aprova a peça em nome do cliente e dispara as automações"
            >Aprovar peça
            </Button>
          )}
          <a
            href={`/api/files/${deliverable.id}?download=1`}
            className="rounded border border-edge bg-surface-sunken px-2 py-1 t5 text-text-muted transition-colors hover:border-edge hover:text-text"
          >
            Baixar </a>
          {latestReview && (
            <span
              className="t5 rounded-xs border px-3 py-1"
              style={{
                borderColor: scoreColor(latestReview.score),
                color: scoreColor(latestReview.score),
              }}
            >
              {latestReview.score}/100
            </span>
          )}
          <Button variant="ghost" onClick={runReview} disabled={reviewing}>
            {reviewing ? "Analisando..." : latestReview ? "Reanalisar com IA" : "Analisar com IA"}
          </Button>
        </div>
      </div>
      {reviewing && (
        <Spinner label="A IA está avaliando a peça no contexto da campanha (1-2 min)..." />
      )}
      {error && <ErrorBox message={error} />}
      {approval && approval.events.length > 0 && <ApprovalTimeline events={approval.events} />}

      <p className="t5 text-text-muted">
        Clique em qualquer ponto da imagem para adicionar um comentário de revisão.
      </p>
      <div
        ref={imageRef}
        onClick={handleImageClick}
        className="relative w-fit max-w-full cursor-crosshair overflow-hidden rounded-lg border border-edge"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/files/${deliverable.id}`}
          alt={deliverable.title}
          className="max-h-[70vh] w-auto max-w-full select-none"
          draggable={false}
        />
        {annotations.map((annotation, index) => (
          <span
            key={annotation.id}
            title={annotation.comment}
            className={`absolute grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 t5 font-bold ${
              annotation.resolved
                ? "border-positive/50 bg-positive-wash text-black"
                : "border-white bg-negative text-white"
            }`}
            style={{ left: `${annotation.x}%`, top: `${annotation.y}%` }}
            onClick={(e) => e.stopPropagation()}
          >
            {index + 1}
          </span>
        ))}
        {pending && (
          <span
            className="absolute grid size-6 -translate-x-1/2 -translate-y-1/2 animate-pulse place-items-center rounded-full border-2 border-canvas bg-text t5 font-medium text-canvas"
            style={{ left: `${pending.x}%`, top: `${pending.y}%` }}
            onClick={(e) => e.stopPropagation()}
          >
            +
          </span>
        )}
      </div>

      {pending && (
        <div className="flex flex-wrap gap-2">
          <select
            value={author}
            onChange={(e) => setAuthor(e.target.value as ReviewRole)}
            className="rounded-md border border-edge bg-surface-sunken px-2 py-2 t5 text-text-muted outline-none"
            title="Quem está comentando"
          >
            {Object.entries(REVIEW_ROLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                De: {label}
              </option>
            ))}
          </select>
          <select
            value={audience}
            onChange={(e) => setAudience(e.target.value as ReviewRole | "all")}
            className="rounded-md border border-edge bg-surface-sunken px-2 py-2 t5 text-text-muted outline-none"
            title="Para quem é a revisão"
          >
            <option value="all">Para: Todos</option>
            {Object.entries(REVIEW_ROLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                Para: {label}
              </option>
            ))}
          </select>
          <input
            autoFocus
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveAnnotation()}
            placeholder="Descreva o ajuste neste ponto..."
            className="min-w-48 flex-1 rounded-md border border-edge bg-surface-sunken px-3 py-2 t3 outline-none focus:border-edge"
          />
          <Button onClick={saveAnnotation}>Salvar</Button>
          <Button variant="ghost" onClick={() => setPending(null)}>
            Cancelar
          </Button>
        </div>
      )}

      {annotations.length > 0 && (
        <div className="space-y-1.5">
          {annotations.map((annotation, index) => (
            <div
              key={annotation.id}
              className="flex items-start justify-between gap-3 rounded-md border border-edge bg-surface-sunken px-3 py-2 t3"
            >
              <p className={annotation.resolved ? "text-text-muted line-through" : ""}>
                <span className="mr-2 font-bold text-text">#{index + 1}</span>
                {annotation.comment}
                <span className="ml-2 text-[10px] uppercase tracking-wide text-text-muted">
                  {REVIEW_ROLE_LABELS[annotation.author] ?? annotation.author} →{" "}
                  {annotation.audience === "all"
                    ? "todos"
                    : (REVIEW_ROLE_LABELS[annotation.audience as ReviewRole] ?? annotation.audience)}
                </span>
              </p>
              <div className="flex shrink-0 gap-2 t5">
                <button
                  className="text-text-muted hover:text-text"
                  onClick={async () => {
                    await api(`/api/annotations/${annotation.id}`, {
                      method: "PATCH",
                      body: JSON.stringify({ resolved: !annotation.resolved }),
                    });
                    load();
                  }}
                >
                  {annotation.resolved ? "Reabrir" : "Resolver ✓"}
                </button>
                <button
                  className="text-text-muted hover:text-negative"
                  onClick={async () => {
                    await api(`/api/annotations/${annotation.id}`, { method: "DELETE" });
                    load();
                  }}
                >
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {reviewContent && (
        <div className="space-y-3 rounded-lg border border-edge bg-surface-sunken p-4">
          <SectionTitle>Análise da IA — no contexto da campanha</SectionTitle>
          <p className="t3 font-medium">{reviewContent.verdict}</p>
          <div className="space-y-1.5">
            {reviewContent.criteria.map((criterion, i) => (
              <div key={i} className="t3">
                <div className="flex items-center justify-between t5">
                  <span>{criterion.criterion}</span>
                  <span style={{ color: scoreColor(criterion.score) }}>
                    {criterion.score}
                  </span>
                </div>
                <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-background">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${criterion.score}%`,
                      backgroundColor: scoreColor(criterion.score),
                    }}
                  />
                </div>
                <p className="mt-0.5 t5 text-text-muted">{criterion.comment}</p>
              </div>
            ))}
          </div>
          <p className="t3 text-text-muted">
            <span className="font-semibold text-text/80">
              Fit na campanha ({reviewContent.campaignFit.score}/100):{" "}
            </span>
            {reviewContent.campaignFit.comment}
          </p>
          <div className="grid gap-3 t3 text-text-muted sm:grid-cols-2">
            <div>
              <p className="mb-1 t5 font-semibold uppercase text-positive">
                Pontos fortes
              </p>
              <ul className="list-disc space-y-0.5 pl-4">
                {reviewContent.strengths.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-1 t5 font-semibold uppercase text-caution">
                Melhorias
              </p>
              <ul className="list-disc space-y-0.5 pl-4">
                {reviewContent.improvements.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
          {reviewContent.revisionNotes.length > 0 && (
            <div className="rounded-md border border-caution/50 bg-caution-wash p-3 t3 text-text-muted">
              <p className="mb-1 t5 font-semibold uppercase text-caution">
                Notas de revisão para o profissional
              </p>
              <ul className="list-disc space-y-0.5 pl-4">
                {reviewContent.revisionNotes.map((note, i) => (
                  <li key={i}>{note}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Comentários — thread genérica para qualquer entregável (texto ou imagem) */}
      <div className="space-y-3 border-t border-edge pt-4">
        <h3 className="t5 flex items-center gap-1.5 uppercase tracking-wider text-text">
          <Icon name="message" size={15} />
          Comentários
          {comments.length > 0 && (
            <span className="normal-case text-text-muted">({comments.length})</span>
          )}
        </h3>

        {comments.length === 0 ? (
          <p className="t5 text-text-muted">
            Nenhum comentário ainda. Inicie a conversa sobre esta entrega.
          </p>
        ) : (
          <div className="space-y-2">
            {comments.map((c) => (
              <div
                key={c.id}
                className="rounded-md border border-edge bg-surface-sunken px-3 py-2"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1.5 t5 font-semibold text-text">
                    <Icon name="user" size={13} className="text-text-muted" />
                    {c.authorName || REVIEW_ROLE_LABELS[c.author] || c.author}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wide text-text-muted">
                      {formatDate(c.createdAt)}
                    </span>
                    <button
                      type="button"
                      title="Excluir comentário"
                      className="text-text-muted transition-colors hover:text-negative"
                      onClick={() => removeComment(c.id)}
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                </div>
                <p className="mt-1 whitespace-pre-wrap t3 text-text/90">
                  {c.body}
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2">
          <select
            value={commentAuthor}
            onChange={(e) => setCommentAuthor(e.target.value as ReviewRole)}
            className="rounded-md border border-edge bg-surface-sunken px-2 py-2 t5 text-text-muted outline-none"
            title="Quem está comentando"
          >
            {Object.entries(REVIEW_ROLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                Como: {label}
              </option>
            ))}
          </select>
          <Textarea
            value={commentBody}
            onChange={(e) => setCommentBody(e.target.value)}
            placeholder="Escreva um comentário sobre esta entrega..."
          />
          <div className="flex justify-end">
            <Button onClick={postComment} disabled={posting || !commentBody.trim()}>
              <Icon name="send" size={14} />
              {posting ? "Enviando..." : "Comentar"}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
