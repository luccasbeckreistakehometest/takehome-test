"use client";

import type { ApprovalEvent } from "@/lib/approvals-db";
import { useUiLang } from "@/lib/i18n";

// Linha do tempo "o que aconteceu quando você aprovou": cada evento de
// aprovação com as ações que a regra disparou. Os rótulos são do chrome
// (traduzidos pelo dicionário); datas seguem o idioma da interface.
export default function ApprovalTimeline({ events, compact = false }: { events: ApprovalEvent[]; compact?: boolean }) {
  const lang = useUiLang();
  if (events.length === 0) return null;
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(lang === "en" ? "en-US" : "pt-BR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  const fmtSlot = (local: string) =>
    new Date(local).toLocaleString(lang === "en" ? "en-US" : "pt-BR", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  return (
    <div className={`space-y-2 ${compact ? "" : "rounded-lg border border-edge bg-surface-sunken p-3"}`} data-testid="approval-timeline">
      {!compact && (
        <p className="t5 font-semibold uppercase tracking-wider text-text">O que aconteceu quando você aprovou</p>
      )}
      {events.map((event) => (
        <div key={event.id} className="t3">
          <p className="font-medium">
            {event.decision === "approved" ? (
              <span>{event.actor === "client" ? "Cliente aprovou" : "Agência aprovou"}</span>
            ) : (
              <span>{event.actor === "client" ? "Cliente pediu ajustes" : "Agência pediu ajustes"}</span>
            )}{" "}
            <span className="t5 font-normal text-text-muted">{fmt(event.createdAt)}</span>
          </p>
          {event.source === "link" && (
            <p className="t5 text-text-muted" data-testid="approval-source-link">
              <span>Pelo link de aprovação</span>
              {event.approverName ? <span> · {event.approverName}</span> : null}
            </p>
          )}
          {event.note && <p className="t5 italic text-text-muted">“{event.note}”</p>}
          <ul className="mt-1 space-y-0.5 t5 text-text-muted">
            {event.actions.map((action, index) => (
              <li key={index} className="flex gap-1.5" data-action={action.type}>
                <span className="text-text">→</span>
                {action.type === "post_draft" && (
                  <span>
                    <span>Rascunho de post criado no calendário</span>{" "}
                    <span>· {action.channel} · {fmtSlot(action.scheduledFor)}</span>
                  </span>
                )}
                {action.type === "whatsapp" && <span>Agência avisada por WhatsApp</span>}
                {action.type === "activity" && <span>Agência notificada no painel</span>}
                {action.type === "project_approved" && <span>Demanda concluída — todas as entregas aprovadas</span>}
                {action.type === "changes_requested" && <span>Pedido de ajustes enviado à agência</span>}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
