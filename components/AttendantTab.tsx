"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useUiLang } from "@/lib/i18n";
import type { Client } from "@/lib/types";
import type { AttendantConfig, AttendantMode } from "@/lib/attendant-rules";
import type { AttendantReply } from "@/lib/attendant-db";
import type { InboundMessage } from "@/lib/messaging-db";
import { Button, Card, ErrorBox, Input, Label, SectionTitle, Spinner, Tag, Textarea } from "./ui";
import { Icon } from "./icons";
import BrandVoiceCheck from "./BrandVoiceCheck";

type View = {
  config: AttendantConfig & { hasToken: boolean };
  channel: { ready: boolean; via: string };
  stats: { drafts: number; sentToday: number; handoffs: number };
  replies: AttendantReply[];
  inbound: InboundMessage[];
};

const MODES: { value: AttendantMode; title: string; body: string }[] = [
  { value: "off", title: "Desligado", body: "Mensagens recebidas só ficam na caixa de entrada." },
  { value: "draft", title: "Rascunho", body: "A IA escreve a resposta na voz da marca; a agência revisa, ajusta e envia." },
  { value: "auto", title: "Automático", body: "Responde sozinha no horário comercial, com limite por contato e passagem para humano quando precisa." },
];

const STATUS_LABEL: Record<AttendantReply["status"], string> = {
  draft: "Rascunho",
  sent: "Enviada",
  handoff: "Passou para humano",
  skipped: "Não respondida",
  discarded: "Descartada",
};

const REASON_LABEL: Record<string, string> = {
  requested_human: "o contato pediu uma pessoa",
  needs_human: "a IA pediu ajuda humana",
  price_or_promise: "falava de preço ou compromisso",
  low_confidence: "confiança baixa",
  outside_hours: "fora do horário comercial",
  rate_limit: "limite diário do contato",
  mode_draft: "modo rascunho",
  no_channel: "nenhum canal conectado",
  auto: "resposta automática",
  approved: "aprovada pela agência",
  discarded: "descartada",
  empty: "resposta vazia",
};

const DAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

// Aba "Atendente" do cliente: modo, horário, guardrails, número próprio,
// sandbox para testar e o log de cada resposta gerada pela IA.
export default function AttendantTab({ client }: { client: Client }) {
  const lang = useUiLang();
  const [view, setView] = useState<View | null>(null);
  const [form, setForm] = useState<AttendantConfig | null>(null);
  const [apiToken, setApiToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [testName, setTestName] = useState("Maria");
  const [testText, setTestText] = useState("");
  const [testing, setTesting] = useState(false);
  const [lastReply, setLastReply] = useState<AttendantReply | null | "none">(null);

  const load = useCallback(() => {
    api<View>(`/api/clients/${client.id}/attendant`)
      .then((v) => {
        setView(v);
        setForm((prev) => prev ?? { ...v.config });
      })
      .catch((e) => setError(e.message));
  }, [client.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    if (!form) return;
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const next = await api<View>(`/api/clients/${client.id}/attendant`, {
        method: "PUT",
        body: JSON.stringify({ ...form, apiToken }),
      });
      setView(next);
      setForm({ ...next.config });
      setApiToken("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function simulate() {
    if (!testText.trim()) return;
    setTesting(true);
    setError("");
    try {
      const result = await api<{ reply: AttendantReply | null }>(`/api/clients/${client.id}/attendant/inbound`, {
        method: "POST",
        body: JSON.stringify({ fromAddress: "5511900000000", fromName: testName, body: testText }),
      });
      setLastReply(result.reply ?? "none");
      setTestText("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro no teste");
    } finally {
      setTesting(false);
    }
  }

  async function act(reply: AttendantReply, action: "send" | "discard", text?: string) {
    setError("");
    try {
      await api(`/api/attendant/replies/${reply.id}`, { method: "POST", body: JSON.stringify({ action, reply: text }) });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    }
  }

  if (!view || !form) {
    return (
      <div className="grid place-items-center py-16">
        <Spinner label="Carregando o atendente..." />
      </div>
    );
  }

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(lang === "en" ? "en-US" : "pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-6" data-testid="attendant-tab">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">Atendente de WhatsApp com IA</h2>
          <p className="mt-1 text-sm text-muted">
            Responde os clientes desta marca 24/7 na voz dela, sem inventar preço nem promessa — e chama uma pessoa quando precisa.
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          <Tag>
            <span>{view.stats.drafts}</span> <span>rascunhos</span>
          </Tag>
          <Tag>
            <span>{view.stats.sentToday}</span> <span>enviadas hoje</span>
          </Tag>
          <Tag>
            <span>{view.stats.handoffs}</span> <span>passadas para humano</span>
          </Tag>
        </div>
      </div>

      <Card className="space-y-4">
        <SectionTitle>Modo</SectionTitle>
        <div className="grid gap-2 sm:grid-cols-3">
          {MODES.map((m) => (
            <label
              key={m.value}
              className={`cursor-pointer rounded-md border p-3 text-sm transition-colors ${
                form.mode === m.value ? "border-accent bg-accent/10" : "border-edge bg-surface-2 hover:border-muted"
              }`}
              data-testid={`mode-${m.value}`}
            >
              <input type="radio" name="attendant-mode" className="hidden" checked={form.mode === m.value} onChange={() => setForm({ ...form, mode: m.value })} />
              <span className="font-medium">{m.title}</span>
              <span className="mt-1 block text-xs text-muted">{m.body}</span>
            </label>
          ))}
        </div>
        <div className={`rounded-md border px-3 py-2 text-xs ${view.channel.ready ? "border-emerald-500/40 text-emerald-500" : "border-amber-500/40 text-amber-500"}`}>
          {view.channel.via === "own_number" && "Saída pelo número próprio da marca (WhatsApp Cloud API)."}
          {view.channel.via === "agency_api" && "Saída pela API do WhatsApp da agência (Mensagens → Conexões)."}
          {view.channel.via === "agency_session" && "Saída pela sessão de WhatsApp da agência (Mensagens → Conexões)."}
          {view.channel.via === "none" && "Nenhum canal de WhatsApp conectado: as respostas ficam como rascunho até você conectar um número."}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Horário comercial (modo automático)</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Das (hora)</Label>
                <Input type="number" min={0} max={23} value={form.hoursStart} onChange={(e) => setForm({ ...form, hoursStart: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Até (hora)</Label>
                <Input type="number" min={1} max={24} value={form.hoursEnd} onChange={(e) => setForm({ ...form, hoursEnd: Number(e.target.value) })} />
              </div>
            </div>
            <div>
              <Label>Dias</Label>
              <div className="flex gap-1">
                {DAYS.map((d, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() =>
                      setForm({ ...form, days: form.days.includes(i) ? form.days.filter((x) => x !== i) : [...form.days, i].sort() })
                    }
                    className={`size-8 rounded-md border text-xs font-medium ${form.days.includes(i) ? "border-accent bg-accent/15 text-accent" : "border-edge text-muted"}`}
                    aria-label={`dia ${i}`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Fuso horário</Label>
              <Input value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} placeholder="America/Sao_Paulo" />
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Guardrails</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Máx. respostas automáticas por contato/dia</Label>
                <Input type="number" min={1} max={50} value={form.maxAutoPerContactPerDay} onChange={(e) => setForm({ ...form, maxAutoPerContactPerDay: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Confiança mínima para enviar (%)</Label>
                <Input type="number" min={0} max={100} value={Math.round(form.minConfidence * 100)} onChange={(e) => setForm({ ...form, minConfidence: Number(e.target.value) / 100 })} />
              </div>
            </div>
            <div>
              <Label>O que a IA pode dizer (FAQ, serviços, endereço, o que nunca falar)</Label>
              <Textarea
                value={form.instructions}
                onChange={(e) => setForm({ ...form, instructions: e.target.value })}
                placeholder="Ex.: atendemos de segunda a sábado; entregamos na zona sul; não fazemos orçamento por WhatsApp — sempre passar para a equipe."
              />
            </div>
            <div>
              <Label>Mensagem ao passar para uma pessoa (opcional)</Label>
              <Textarea
                value={form.handoffMessage}
                onChange={(e) => setForm({ ...form, handoffMessage: e.target.value })}
                placeholder="Em branco: 'Vou chamar alguém da equipe para te responder pessoalmente…'"
              />
            </div>
          </div>
        </div>

        <div className="space-y-2 border-t border-edge pt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Número próprio da marca (opcional)</p>
          <p className="text-xs text-muted">
            Com o Phone Number ID e o token do WhatsApp Cloud API deste cliente, as mensagens que chegam nesse número entram aqui e as respostas saem por ele. Sem isso, o atendente usa o canal de WhatsApp da agência.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Phone Number ID</Label>
              <Input value={form.phoneNumberId} onChange={(e) => setForm({ ...form, phoneNumberId: e.target.value })} placeholder="1234567890" />
            </div>
            <div>
              <Label>
                Token de acesso {view.config.hasToken && <span className="normal-case text-accent">configurado ✓</span>}
              </Label>
              <Input type="password" value={apiToken} onChange={(e) => setApiToken(e.target.value)} placeholder={view.config.hasToken ? "•••• (em branco = manter, clear = apagar)" : "EAAG..."} />
            </div>
          </div>
        </div>

        {error && <ErrorBox message={error} />}
        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={saving} data-testid="attendant-save">
            {saving ? "Salvando..." : "Salvar atendente"}
          </Button>
          {saved && <span className="text-sm text-accent">Aplicado ✓</span>}
        </div>
      </Card>

      <Card className="space-y-3">
        <SectionTitle>Testar o atendente</SectionTitle>
        <p className="text-sm text-muted">
          Simule uma mensagem chegando no WhatsApp desta marca e veja o que o atendente faria com o modo atual.
        </p>
        <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
          <Input value={testName} onChange={(e) => setTestName(e.target.value)} placeholder="Nome do contato" />
          <Input
            value={testText}
            onChange={(e) => setTestText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && simulate()}
            placeholder="Ex.: Oi, vocês abrem no sábado?"
            data-testid="attendant-test-text"
          />
          <Button onClick={simulate} disabled={testing || !testText.trim()} data-testid="attendant-test-send">
            <Icon name="send" size={14} /> {testing ? "Pensando..." : "Simular"}
          </Button>
        </div>
        {lastReply === "none" && (
          <p className="rounded-md border border-edge bg-surface-2 p-3 text-sm text-muted" data-testid="attendant-test-result">
            O atendente está desligado: a mensagem ficou só na caixa de entrada.
          </p>
        )}
        {lastReply && lastReply !== "none" && (
          <div className="rounded-md border border-accent/40 bg-accent/5 p-3 text-sm" data-testid="attendant-test-result" data-status={lastReply.status}>
            <div className="flex flex-wrap items-center gap-2">
              <Tag>{STATUS_LABEL[lastReply.status]}</Tag>
              <span className="text-xs text-muted">{REASON_LABEL[lastReply.reason] ?? lastReply.reason}</span>
              {lastReply.confidence > 0 && (
                <span className="text-xs text-muted">
                  · <span>confiança</span> {Math.round(lastReply.confidence * 100)}%
                </span>
              )}
            </div>
            {lastReply.reply && <p className="mt-2 whitespace-pre-wrap">{lastReply.reply}</p>}
          </div>
        )}
      </Card>

      <Card className="space-y-3">
        <SectionTitle>Respostas do atendente</SectionTitle>
        {view.replies.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma resposta gerada ainda.</p>
        ) : (
          <div className="space-y-2">
            {view.replies.map((reply) => (
              <ReplyRow key={reply.id} reply={reply} fmt={fmt} onAct={act} />
            ))}
          </div>
        )}
      </Card>

      {view.inbound.length > 0 && (
        <Card>
          <SectionTitle>Mensagens recebidas neste número</SectionTitle>
          <div className="space-y-1.5">
            {view.inbound.slice(0, 20).map((m) => (
              <div key={m.id} className="rounded-md border border-edge bg-surface-2 px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{m.fromName || m.fromAddress}</span>
                  <span className="text-xs text-muted">{fmt(m.receivedAt)}</span>
                </div>
                <p className="mt-0.5 text-foreground/80">{m.body}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function ReplyRow({
  reply,
  fmt,
  onAct,
}: {
  reply: AttendantReply;
  fmt: (iso: string) => string;
  onAct: (reply: AttendantReply, action: "send" | "discard", text?: string) => Promise<void>;
}) {
  const [text, setText] = useState(reply.reply);
  const [busy, setBusy] = useState(false);
  const isDraft = reply.status === "draft";
  return (
    <div className="rounded-md border border-edge bg-surface-2 p-3 text-sm" data-testid="attendant-reply" data-status={reply.status}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p>
          <span className="font-medium">{reply.contactName || reply.contactAddress}</span>{" "}
          <span className="text-xs text-muted">· {fmt(reply.createdAt)}</span>
        </p>
        <div className="flex items-center gap-1.5 text-xs">
          <Tag>{reply.mode === "auto" ? "Automático" : reply.mode === "draft" ? "Rascunho" : "Desligado"}</Tag>
          <Tag>{STATUS_LABEL[reply.status]}</Tag>
          {reply.confidence > 0 && (
            <span className="text-muted">
              <span>confiança</span> {Math.round(reply.confidence * 100)}%
            </span>
          )}
        </div>
      </div>
      <p className="mt-1 text-xs text-muted">
        <span>Mensagem:</span> “{reply.inboundBody}”
      </p>
      {reply.reason && REASON_LABEL[reply.reason] && (
        <p className="mt-0.5 text-xs text-muted">
          <span>Motivo:</span> {REASON_LABEL[reply.reason]}
        </p>
      )}
      {isDraft ? (
        <div className="mt-2 space-y-2">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} data-testid="reply-text" />
          <BrandVoiceCheck clientId={reply.clientId} text={text} kind="reply" onRewrite={setText} compact />
          <div className="flex gap-2">
            <Button
              className="!px-3 !py-1.5 text-xs"
              disabled={busy || !text.trim()}
              onClick={async () => {
                setBusy(true);
                await onAct(reply, "send", text);
                setBusy(false);
              }}
              data-testid="reply-send"
            >Aprovar e enviar
            </Button>
            <Button
              variant="ghost"
              className="!px-3 !py-1.5 text-xs"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await onAct(reply, "discard");
                setBusy(false);
              }}
            >
              Descartar
            </Button>
          </div>
        </div>
      ) : (
        reply.reply && <p className="mt-2 whitespace-pre-wrap rounded-md bg-background px-3 py-2">{reply.reply}</p>
      )}
    </div>
  );
}
