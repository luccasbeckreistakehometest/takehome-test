"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button, Card, ErrorBox, Input, Label, SectionTitle, Select, Spinner, Tag, Textarea } from "@/components/ui";
import { Icon, type IconName } from "@/components/icons";

type Channel = "whatsapp" | "instagram";
type Contact = {
  id: string;
  name: string;
  phone: string;
  instagram: string;
  clientId: string | null;
  tags: string;
  notes: string;
};
type BroadcastList = { id: string; name: string; channel: Channel; contactIds: string[] };
type OutboxMessage = {
  id: string;
  channel: Channel;
  mode: string;
  toAddress: string;
  body: string;
  status: string;
  scheduledFor: string | null;
  sentAt: string | null;
  error: string;
};
type Connection = {
  channel: Channel;
  mode: string;
  apiAccountId: string;
  hasToken: boolean;
  sessionReady: boolean;
};

const TABS: { key: string; label: string; icon: IconName }[] = [
  { key: "compose", label: "Compor", icon: "send" },
  { key: "inbox", label: "Recebidas", icon: "mail" },
  { key: "contacts", label: "Contatos", icon: "users" },
  { key: "lists", label: "Listas de transmissão", icon: "megaphone" },
  { key: "outbox", label: "Fila & agendados", icon: "clock" },
  { key: "connections", label: "Conexões", icon: "link" },
];

const STATUS_STYLE: Record<string, string> = {
  queued: "text-caution",
  scheduled: "text-text-muted",
  sending: "text-text-muted",
  sent: "text-positive",
  failed: "text-negative",
};

export default function MessagesPage() {
  const [tab, setTab] = useState("compose");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [lists, setLists] = useState<BroadcastList[]>([]);
  const [outbox, setOutbox] = useState<OutboxMessage[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [sessionAvailable, setSessionAvailable] = useState(false);

  const loadContacts = useCallback(() => {
    api<{ contacts: Contact[] }>("/api/messaging/contacts").then((r) => setContacts(r.contacts));
  }, []);
  const loadLists = useCallback(() => {
    api<{ lists: BroadcastList[] }>("/api/messaging/lists").then((r) => setLists(r.lists));
  }, []);
  const loadOutbox = useCallback(() => {
    api<{ outbox: OutboxMessage[] }>("/api/messaging/outbox").then((r) => setOutbox(r.outbox));
  }, []);
  const loadConnections = useCallback(() => {
    api<{ connections: Connection[]; sessionModeAvailable?: boolean }>("/api/messaging/connections").then((r) => {
      setConnections(r.connections);
      setSessionAvailable(Boolean(r.sessionModeAvailable));
    });
  }, []);

  useEffect(() => {
    loadContacts();
    loadLists();
    loadOutbox();
    loadConnections();
  }, [loadContacts, loadLists, loadOutbox, loadConnections]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="d3">Mensagens</h1>
        <p className="t3 measure-lede mt-2 text-text-muted">
          WhatsApp e Instagram: mensagens individuais, listas de transmissão e agendamento — com rascunho por IA.
        </p>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-edge">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 t3 transition-colors ${
              tab === t.key
                ? "border-edge text-text"
                : "border-transparent text-text-muted hover:text-text"
            }`}
          >
            <Icon name={t.icon} size={15} />
            {t.label}
          </button>
        ))}
      </div>

      <div className="animate-fade-in">
        {tab === "compose" && (
          <Compose contacts={contacts} lists={lists} onSent={loadOutbox} />
        )}
        {tab === "inbox" && <Inbox />}
        {tab === "contacts" && (
          <Contacts contacts={contacts} onChange={loadContacts} />
        )}
        {tab === "lists" && (
          <Lists contacts={contacts} lists={lists} onChange={loadLists} />
        )}
        {tab === "outbox" && <Outbox outbox={outbox} onRefresh={loadOutbox} />}
        {tab === "connections" && (
          <Connections connections={connections} sessionAvailable={sessionAvailable} onChange={loadConnections} />
        )}
      </div>
    </div>
  );
}

type InboundMessage = {
  id: string;
  channel: Channel;
  fromAddress: string;
  fromName: string;
  body: string;
  receivedAt: string;
  readAt: string | null;
  clientId?: string | null;
  clientName?: string | null;
};

// Caixa de entrada: mensagens que os contatos ENVIAM de volta, capturadas pelo
// webhook da Meta (/api/webhooks/meta). Requer o webhook configurado na Meta.
function Inbox() {
  const [items, setItems] = useState<InboundMessage[]>([]);

  const load = useCallback(() => {
    api<{ inbound: InboundMessage[] }>("/api/messaging/inbound").then((r) => setItems(r.inbound)).catch(() => {});
  }, []);
  useEffect(() => {
    load();
    api("/api/messaging/inbound", { method: "PATCH" }).catch(() => {}); // marca lidas
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [load]);

  return (
    <Card>
      <SectionTitle>Recebidas ({items.length})</SectionTitle>
      {items.length === 0 ? (
        <p className="t3 text-text-muted">
          Nenhuma mensagem recebida ainda. Respostas chegam aqui quando o webhook da Meta estiver
          configurado (Conexões → API oficial): Callback URL <code className="text-text">/api/webhooks/meta</code>,
          verify token <code className="text-text">agencyhub-verify</code>.
        </p>
      ) : (
        <div className="space-y-1.5">
          {items.map((m) => (
            <div key={m.id} className="rounded-md border border-edge bg-surface-sunken px-3 py-2 t3">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 font-medium">
                  <Icon name={m.channel === "whatsapp" ? "whatsapp" : "instagram"} size={14} />
                  {m.fromName || m.fromAddress}
                  {m.clientName && (
                    <a href={`/clients/${m.clientId}?tab=attendant`} className="rounded-full border border-edge px-2 py-0.5 text-[10px] font-normal text-text-muted hover:border-edge hover:text-text">
                      {m.clientName}
                    </a>
                  )}
                </span>
                <span className="t5 text-text-muted">
                  {new Date(m.receivedAt).toLocaleString("pt-BR")}
                </span>
              </div>
              <p className="mt-1 text-text/80">{m.body}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function Compose({
  contacts,
  lists,
  onSent,
}: {
  contacts: Contact[];
  lists: BroadcastList[];
  onSent: () => void;
}) {
  const [channel, setChannel] = useState<Channel>("whatsapp");
  const [target, setTarget] = useState<"contacts" | "list">("contacts");
  const [selected, setSelected] = useState<string[]>([]);
  const [listId, setListId] = useState("");
  const [body, setBody] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [goal, setGoal] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [variants, setVariants] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const eligible = contacts.filter((c) => (channel === "whatsapp" ? c.phone : c.instagram));

  async function draft() {
    if (!goal.trim()) return;
    setDrafting(true);
    setError("");
    try {
      const r = await api<{ message: string; variants: string[] }>("/api/messaging/draft", {
        method: "POST",
        body: JSON.stringify({ channel, goal }),
      });
      setBody(r.message);
      setVariants(r.variants || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao redigir");
    } finally {
      setDrafting(false);
    }
  }

  async function send() {
    setError("");
    setStatus("");
    setSending(true);
    try {
      const payload =
        target === "list"
          ? { channel, body, listId, scheduledFor: scheduledFor || null }
          : { channel, body, contactIds: selected, scheduledFor: scheduledFor || null };
      const r = await api<{ enqueued: number; mode: string }>("/api/messaging/outbox", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      // Se for modo API e não agendado, dispara o envio já
      if (r.mode === "api" && !scheduledFor) {
        const sent = await api<{ sent: number; failed: number; skippedSession: number }>(
          "/api/messaging/send",
          { method: "POST" }
        );
        setStatus(`${r.enqueued} enfileirada(s) · ${sent.sent} enviada(s), ${sent.failed} falha(s).`);
      } else if (scheduledFor) {
        setStatus(`${r.enqueued} mensagem(ns) agendada(s).`);
      } else {
        setStatus(
          `${r.enqueued} na fila (modo sessão) — o worker local vai enviar pela sua conta logada.`
        );
      }
      setBody("");
      setSelected([]);
      setVariants([]);
      onSent();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao enviar");
    } finally {
      setSending(false);
    }
  }

  const canSend =
    body.trim() && (target === "list" ? listId : selected.length > 0) && !sending;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <SectionTitle>Nova mensagem</SectionTitle>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Canal</Label>
              <Select value={channel} onChange={(e) => { setChannel(e.target.value as Channel); setSelected([]); }}>
                <option value="whatsapp">WhatsApp</option>
                <option value="instagram">Instagram</option>
              </Select>
            </div>
            <div>
              <Label>Enviar para</Label>
              <Select value={target} onChange={(e) => setTarget(e.target.value as "contacts" | "list")}>
                <option value="contacts">Contatos selecionados</option>
                <option value="list">Lista de transmissão</option>
              </Select>
            </div>
          </div>

          {target === "list" ? (
            <div>
              <Label>Lista</Label>
              <Select value={listId} onChange={(e) => setListId(e.target.value)}>
                <option value="">Selecione uma lista…</option>
                {lists
                  .filter((l) => l.channel === channel)
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.contactIds.length})
                    </option>
                  ))}
              </Select>
            </div>
          ) : (
            <div>
              <Label>Destinatários ({selected.length})</Label>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-edge bg-surface-sunken p-2">
                {eligible.length === 0 && (
                  <p className="p-2 t5 text-text-muted">
                    Nenhum contato com {channel === "whatsapp" ? "telefone" : "@ do Instagram"}.
                  </p>
                )}
                {eligible.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 rounded px-2 py-1 t3 hover:bg-surface">
                    <input
                      type="checkbox"
                      checked={selected.includes(c.id)}
                      onChange={(e) =>
                        setSelected((prev) =>
                          e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id)
                        )
                      }
                    />
                    {c.name}
                    <span className="t5 text-text-muted">
                      {channel === "whatsapp" ? c.phone : c.instagram}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div>
            <Label>Mensagem — use {"{nome}"} para o primeiro nome</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              placeholder="Oi {nome}, tudo bem? ..."
            />
          </div>

          <div>
            <Label>Agendar (opcional)</Label>
            <Input
              type="datetime-local"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
            />
          </div>

          {error && <ErrorBox message={error} />}
          {status && (
            <div className="rounded-md border border-positive/40 bg-positive-wash px-3 py-2 t3 text-positive">
              {status}
            </div>
          )}

          <Button onClick={send} disabled={!canSend}>
            {sending ? <Spinner /> : <><Icon name="send" size={15} /> {scheduledFor ? "Agendar" : "Enviar agora"}</>}
          </Button>
        </div>
      </Card>

      <Card>
        <SectionTitle>
          <span className="flex items-center gap-1.5"><Icon name="sparkle" size={15} /> Rascunho por IA</span>
        </SectionTitle>
        <div className="space-y-3">
          <div>
            <Label>Objetivo da mensagem</Label>
            <Textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              rows={3}
              placeholder="Ex: reativar clientes que não compram há 60 dias com um cupom de 15%"
            />
          </div>
          <Button variant="ghost" onClick={draft} disabled={drafting || !goal.trim()}>
            {drafting ? <Spinner label="Redigindo..." /> : <><Icon name="sparkle" size={15} /> Gerar rascunho</>}
          </Button>
          {variants.length > 0 && (
            <div className="space-y-2">
              <p className="t6 text-text-muted">Variações — clique para usar</p>
              {variants.map((v, i) => (
                <button
                  key={i}
                  onClick={() => setBody(v)}
                  className="block w-full rounded-md border border-edge bg-surface-sunken px-3 py-2 text-left t3 transition-colors hover:border-edge"
                >
                  {v}
                </button>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function Contacts({ contacts, onChange }: { contacts: Contact[]; onChange: () => void }) {
  const [form, setForm] = useState({ name: "", phone: "", instagram: "", tags: "", notes: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function add() {
    setError("");
    setSaving(true);
    try {
      await api("/api/messaging/contacts", {
        method: "POST",
        body: JSON.stringify({ ...form, clientId: null }),
      });
      setForm({ name: "", phone: "", instagram: "", tags: "", notes: "" });
      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    await api(`/api/messaging/contacts?id=${id}`, { method: "DELETE" });
    onChange();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <SectionTitle>Novo contato</SectionTitle>
        <div className="space-y-3">
          <div>
            <Label>Nome</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>Telefone (com DDI, ex 5522…)</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="5522999999999" />
          </div>
          <div>
            <Label>Instagram (@ ou ID)</Label>
            <Input value={form.instagram} onChange={(e) => setForm({ ...form, instagram: e.target.value })} placeholder="@marca" />
          </div>
          <div>
            <Label>Tags</Label>
            <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="lead, vip" />
          </div>
          {error && <ErrorBox message={error} />}
          <Button onClick={add} disabled={saving || !form.name.trim()}>
            <Icon name="plus" size={15} /> Adicionar
          </Button>
        </div>
      </Card>

      <Card className="lg:col-span-2">
        <SectionTitle>Contatos ({contacts.length})</SectionTitle>
        {contacts.length === 0 ? (
          <p className="t3 text-text-muted">Nenhum contato ainda.</p>
        ) : (
          <div className="space-y-1.5">
            {contacts.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-md border border-edge bg-surface-sunken px-3 py-2 t3">
                <div>
                  <span className="font-medium">{c.name}</span>
                  <span className="ml-2 t5 text-text-muted">
                    {[c.phone && `📱 ${c.phone}`, c.instagram && `IG ${c.instagram}`].filter(Boolean).join(" · ")}
                  </span>
                  {c.tags && <span className="ml-2"><Tag>{c.tags}</Tag></span>}
                </div>
                <button onClick={() => remove(c.id)} className="text-text-muted transition-colors hover:text-negative" title="Remover">
                  <Icon name="trash" size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function Lists({
  contacts,
  lists,
  onChange,
}: {
  contacts: Contact[];
  lists: BroadcastList[];
  onChange: () => void;
}) {
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<Channel>("whatsapp");
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState("");

  const eligible = contacts.filter((c) => (channel === "whatsapp" ? c.phone : c.instagram));

  async function create() {
    setError("");
    try {
      await api("/api/messaging/lists", {
        method: "POST",
        body: JSON.stringify({ name, channel, contactIds: selected }),
      });
      setName("");
      setSelected([]);
      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao criar lista");
    }
  }

  async function remove(id: string) {
    await api(`/api/messaging/lists?id=${id}`, { method: "DELETE" });
    onChange();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <SectionTitle>Nova lista de transmissão</SectionTitle>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>Canal</Label>
              <Select value={channel} onChange={(e) => { setChannel(e.target.value as Channel); setSelected([]); }}>
                <option value="whatsapp">WhatsApp</option>
                <option value="instagram">Instagram</option>
              </Select>
            </div>
          </div>
          <div>
            <Label>Contatos ({selected.length})</Label>
            <div className="max-h-52 space-y-1 overflow-y-auto rounded-md border border-edge bg-surface-sunken p-2">
              {eligible.map((c) => (
                <label key={c.id} className="flex items-center gap-2 rounded px-2 py-1 t3 hover:bg-surface">
                  <input
                    type="checkbox"
                    checked={selected.includes(c.id)}
                    onChange={(e) =>
                      setSelected((prev) =>
                        e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id)
                      )
                    }
                  />
                  {c.name}
                </label>
              ))}
            </div>
          </div>
          {error && <ErrorBox message={error} />}
          <Button onClick={create} disabled={!name.trim() || selected.length === 0}>
            <Icon name="megaphone" size={15} /> Criar lista
          </Button>
        </div>
      </Card>

      <Card>
        <SectionTitle>Listas ({lists.length})</SectionTitle>
        {lists.length === 0 ? (
          <p className="t3 text-text-muted">Nenhuma lista criada.</p>
        ) : (
          <div className="space-y-1.5">
            {lists.map((l) => (
              <div key={l.id} className="flex items-center justify-between rounded-md border border-edge bg-surface-sunken px-3 py-2 t3">
                <span>
                  <span className="font-medium">{l.name}</span>
                  <span className="ml-2 t5 text-text-muted">
                    {l.channel === "whatsapp" ? "WhatsApp" : "Instagram"} · {l.contactIds.length} contatos
                  </span>
                </span>
                <button onClick={() => remove(l.id)} className="text-text-muted transition-colors hover:text-negative">
                  <Icon name="trash" size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function Outbox({ outbox, onRefresh }: { outbox: OutboxMessage[]; onRefresh: () => void }) {
  const [processing, setProcessing] = useState(false);

  async function process() {
    setProcessing(true);
    try {
      await api("/api/messaging/send", { method: "POST" });
      onRefresh();
    } finally {
      setProcessing(false);
    }
  }

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <SectionTitle>Fila & agendados ({outbox.length})</SectionTitle>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onRefresh}>Atualizar</Button>
          <Button onClick={process} disabled={processing}>
            {processing ? <Spinner /> : "Processar fila (API)"}
          </Button>
        </div>
      </div>
      {outbox.length === 0 ? (
        <p className="t3 text-text-muted">Nada na fila.</p>
      ) : (
        <div className="space-y-1.5">
          {outbox.map((m) => (
            <div key={m.id} className="rounded-md border border-edge bg-surface-sunken px-3 py-2 t3">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5">
                  <Icon name={m.channel === "whatsapp" ? "whatsapp" : "instagram"} size={15} />
                  <span className="t5 text-text-muted">{m.toAddress}</span>
                  <span className="t6 text-text-muted">· {m.mode}</span>
                </span>
                <span className={`t5 font-semibold ${STATUS_STYLE[m.status] ?? "text-text-muted"}`}>
                  {m.status}
                  {m.scheduledFor && m.status === "scheduled" && ` · ${new Date(m.scheduledFor).toLocaleString("pt-BR")}`}
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-text/80">{m.body}</p>
              {m.error && <p className="mt-0.5 t5 text-negative">{m.error}</p>}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function Connections({
  connections,
  sessionAvailable,
  onChange,
}: {
  connections: Connection[];
  sessionAvailable: boolean;
  onChange: () => void;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {(["whatsapp", "instagram"] as Channel[]).map((channel) => (
        <ConnectionCard
          key={channel}
          channel={channel}
          conn={connections.find((c) => c.channel === channel)}
          sessionAvailable={sessionAvailable}
          onChange={onChange}
        />
      ))}
    </div>
  );
}

function ConnectionCard({
  channel,
  conn,
  sessionAvailable,
  onChange,
}: {
  channel: Channel;
  conn?: Connection;
  sessionAvailable: boolean;
  onChange: () => void;
}) {
  // API oficial é o padrão; o modo sessão só aparece onde o worker roda.
  const [mode, setMode] = useState<string>(conn?.mode === "session" && sessionAvailable ? "session" : "api");
  const [apiToken, setApiToken] = useState("");
  const [apiAccountId, setApiAccountId] = useState(conn?.apiAccountId ?? "");
  const [saved, setSaved] = useState(false);

  const [saveError, setSaveError] = useState("");
  async function save() {
    setSaveError("");
    try {
    await api("/api/messaging/connections", {
      method: "POST",
      body: JSON.stringify({ channel, mode, apiToken, apiAccountId }),
    });
    setApiToken("");
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
    onChange();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Erro ao salvar");
    }
  }

  const isWa = channel === "whatsapp";
  const showSessionControls = isWa && mode === "session" && sessionAvailable;
  return (
    <Card>
      <SectionTitle>
        <span className="flex items-center gap-1.5">
          <Icon name={isWa ? "whatsapp" : "instagram"} size={16} />
          {isWa ? "WhatsApp" : "Instagram"}
        </span>
      </SectionTitle>
      <div className="space-y-3">
        <div>
          <Label>Modo de envio</Label>
          <Select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="api">API oficial ({isWa ? "WhatsApp Cloud API" : "Instagram Graph"})</option>
            {isWa && sessionAvailable && <option value="session">Minha sessão logada (worker local)</option>}
          </Select>
        </div>
        {mode === "api" ? (
          <>
            <div>
              <Label>{isWa ? "Phone Number ID" : "Instagram Account ID"}</Label>
              <Input value={apiAccountId} onChange={(e) => setApiAccountId(e.target.value)} />
            </div>
            <div>
              <Label>Token de acesso {conn?.hasToken && "(já configurado)"}</Label>
              <Input
                type="password"
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                placeholder={conn?.hasToken ? "•••• (deixe em branco para manter)" : "EAAG..."}
              />
            </div>
            <p className="t5 text-text-muted">
              Requer conta comercial verificada na Meta. Estável e sem risco de bloqueio.
            </p>
          </>
        ) : isWa ? (
          <p className="rounded-md border border-edge bg-surface-sunken p-3 t5 text-text-muted">
            Sem conta comercial? Clique em <strong className="text-text">Conectar</strong> abaixo:
            abrimos o WhatsApp Web com a <strong className="text-text">sua sessão logada</strong>,
            você escaneia o QR uma vez e as mensagens da fila são enviadas automaticamente
            (com pausas para não tomar rate-limit). Sem terminal.
          </p>
        ) : (
          <p className="rounded-md border border-edge bg-surface-sunken p-3 t5 text-text-muted">
            Instagram por sessão não é suportado — use a <strong className="text-text">API oficial</strong>.
          </p>
        )}
        {conn?.mode === "session" && !sessionAvailable && (
          <p role="alert" className="rounded-md border border-caution/50 bg-caution-wash p-3 t5">
            Esta conexão estava no modo sessão, que não funciona neste servidor. Configure a API oficial e salve para as
            mensagens da fila saírem.
          </p>
        )}
        {saveError && <ErrorBox message={saveError} />}
        <Button onClick={save}>{saved ? "Salvo ✓" : "Salvar conexão"}</Button>
        {showSessionControls && <SessionWorker onSavedConnection={save} />}
      </div>
    </Card>
  );
}

// Controla o worker de sessão do WhatsApp por botão (sem terminal): conectar
// (abre login/QR), status ao vivo e enviar teste.
function SessionWorker({ onSavedConnection }: { onSavedConnection: () => void }) {
  const [status, setStatus] = useState<{ state: string; message: string; running: boolean }>({
    state: "idle",
    message: "",
    running: false,
  });
  const [testPhone, setTestPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [qrTick, setQrTick] = useState(0);

  const poll = useCallback(() => {
    api<{ state: string; message: string; running: boolean }>("/api/messaging/worker")
      .then(setStatus)
      .catch(() => {});
  }, []);

  useEffect(() => {
    poll();
    const interval = setInterval(() => {
      poll();
      setQrTick((t) => t + 1); // força recarregar o QR (ele expira/muda)
    }, 3000);
    return () => clearInterval(interval);
  }, [poll]);

  const STATE_LABEL: Record<string, { text: string; cls: string }> = {
    idle: { text: "Desconectado", cls: "text-text-muted" },
    starting: { text: "Iniciando…", cls: "text-text-muted" },
    installing: { text: "Instalando motor (1ª vez)…", cls: "text-text-muted" },
    awaiting_login: { text: "Aguardando login (escaneie o QR)", cls: "text-caution" },
    connected: { text: "Conectado ✓", cls: "text-positive" },
    draining: { text: "Enviando…", cls: "text-positive" },
    stopped: { text: "Parado", cls: "text-text-muted" },
    error: { text: "Erro", cls: "text-negative" },
  };
  const label = STATE_LABEL[status.state] ?? STATE_LABEL.idle;

  async function act(action: "start" | "stop") {
    setBusy(true);
    setNote("");
    try {
      // garante a conexão salva em modo sessão antes de conectar
      if (action === "start") onSavedConnection();
      await api("/api/messaging/worker", {
        method: "POST",
        body: JSON.stringify({ action, channel: "whatsapp" }),
      });
      poll();
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    if (!testPhone.trim()) return;
    setBusy(true);
    setNote("");
    try {
      await api("/api/messaging/worker", {
        method: "POST",
        body: JSON.stringify({ action: "test", channel: "whatsapp", testPhone }),
      });
      setNote(`Teste enfileirado para ${testPhone}. Se estiver conectado, envia em instantes.`);
      poll();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Erro ao enviar teste");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-1 space-y-2 rounded-md border border-edge bg-surface-sunken p-3">
      <div className="flex items-center justify-between">
        <span className="t6 text-text-muted">Assistente de envio</span>
        <span className={`t5 font-semibold ${label.cls}`}>{label.text}</span>
      </div>
      {status.message && <p className="t5 text-text-muted">{status.message}</p>}

      {/* QR code capturado do WhatsApp Web (headless no servidor) para escanear */}
      {status.state === "awaiting_login" && (
        <div className="flex flex-col items-center gap-2 rounded-md border border-edge bg-surface p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/messaging/worker/qr?t=${qrTick}`}
            alt="QR code do WhatsApp"
            className="size-48 rounded bg-white p-1"
            onError={(e) => ((e.currentTarget.style.opacity = "0.3"))}
          />
          <p className="text-center t5 text-text-muted">
            Abra o WhatsApp no celular → <strong>Aparelhos conectados</strong> → <strong>Conectar aparelho</strong> e escaneie.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {status.running ? (
          <Button variant="ghost" onClick={() => act("stop")} disabled={busy}>
            Parar
          </Button>
        ) : (
          <Button onClick={() => act("start")} disabled={busy}>
            <Icon name="whatsapp" size={15} /> Conectar WhatsApp
          </Button>
        )}
      </div>
      <div className="flex items-end gap-2 pt-1">
        <div className="flex-1">
          <Label>Enviar teste para (com DDI)</Label>
          <Input
            value={testPhone}
            onChange={(e) => setTestPhone(e.target.value)}
            placeholder="5522999999999"
          />
        </div>
        <Button variant="ghost" onClick={sendTest} disabled={busy || !testPhone.trim()}>
          <Icon name="send" size={15} /> Testar
        </Button>
      </div>
      {note && <p className="t5 text-text">{note}</p>}
    </div>
  );
}
