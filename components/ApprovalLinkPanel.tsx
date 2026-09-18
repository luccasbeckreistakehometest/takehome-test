"use client";

import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { api } from "@/lib/api";
import { Button, CopyButton, ErrorBox, Input, Label, Select, Spinner, Tag } from "./ui";
import { Icon } from "./icons";
import { openAfter } from "@/lib/open-later";

type Candidate = { kind: "post" | "deliverable"; id: string; title: string; detail: string; status: string };
type LinkRow = {
  id: string;
  token: string;
  url: string;
  state: "open" | "expired" | "closed";
  pending: number;
  items: { kind: string; id: string }[];
  expiresAt: string;
  viewCount: number;
  createdAt: string;
};
type Payload = { links: LinkRow[]; candidates: { posts: Candidate[]; deliverables: Candidate[] } };
type Created = { url: string; text: string; whatsappUrl: string };

const STATE_LABEL: Record<LinkRow["state"], string> = { open: "Aberto", expired: "Expirado", closed: "Encerrado" };

// Aprovação por link: escolher posts e entregas, gerar o link e mandar pelo
// WhatsApp (wa.me, sem API), copiar ou mostrar o QR.
export default function ApprovalLinkPanel({ clientId }: { clientId: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [days, setDays] = useState("14");
  const [phone, setPhone] = useState("");
  const [created, setCreated] = useState<Created | null>(null);
  const [qr, setQr] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<Payload>(`/api/approval-links?clientId=${encodeURIComponent(clientId)}`)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Erro"));
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load]);

  function toggle(key: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function create() {
    setBusy(true);
    setError("");
    try {
      const items = [...picked].map((key) => {
        const [kind, id] = key.split(":");
        return { kind, id };
      });
      const result = await api<Created>("/api/approval-links", {
        method: "POST",
        body: JSON.stringify({ clientId, items, days: Number(days), phone: phone || undefined }),
      });
      setCreated(result);
      setQr(await QRCode.toString(result.url, { type: "svg", margin: 1, width: 180 }));
      setPicked(new Set());
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao gerar o link");
    } finally {
      setBusy(false);
    }
  }

  async function resend(link: LinkRow) {
    await openAfter(async () => (await api<Created>(`/api/approval-links/${link.id}`)).whatsappUrl).catch(() => {});
  }

  async function close(link: LinkRow) {
    if (!confirm("Encerrar este link? O cliente passa a ver que ele expirou.")) return;
    await api(`/api/approval-links/${link.id}`, { method: "PATCH" });
    load();
  }

  if (!data) return <Spinner label="Carregando..." />;
  const candidates = [...data.candidates.posts, ...data.candidates.deliverables];

  return (
    <div className="space-y-4" data-testid="approval-link-panel">
      {error && <ErrorBox message={error} />}
      {created && (
        <div className="space-y-3 rounded-xl border border-edge bg-surface-sunken p-4" data-testid="approval-link-created">
          <p className="t3 font-medium">Link pronto. O cliente abre no celular e aprova sem senha.</p>
          <p className="break-all rounded-md border border-edge bg-surface px-2 py-1.5 font-mono t5" data-testid="approval-link-url">
            {created.url}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={created.whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3.5 py-2 t3 font-medium text-accent-ink"
              data-testid="approval-link-whatsapp"
            >
              <Icon name="whatsapp" size={15} /> Enviar no WhatsApp
            </a>
            <CopyButton text={created.url} label="Copiar link" />
            <CopyButton text={created.text} label="Copiar mensagem" />
          </div>
          {qr && (
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-white p-2" aria-label="QR code do link" dangerouslySetInnerHTML={{ __html: qr }} />
              <p className="t5 text-text-muted">Em reunião? O cliente aponta a câmera e abre direto.</p>
            </div>
          )}
        </div>
      )}

      <div>
        <p className="mb-2 t3 font-medium">O que vai para aprovação</p>
        {candidates.length === 0 ? (
          <p className="rounded-md border border-dashed border-edge p-3 t3 text-text-muted" data-testid="approval-link-empty">
            Nada pendente: crie posts no calendário ou suba entregas nas demandas deste cliente.
          </p>
        ) : (
          <ul className="max-h-72 space-y-1.5 overflow-y-auto">
            {candidates.map((c) => {
              const key = `${c.kind}:${c.id}`;
              return (
                <li key={key}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-md border border-edge bg-surface-sunken px-3 py-2 t3 hover:border-edge">
                    <input type="checkbox" checked={picked.has(key)} onChange={() => toggle(key)} data-testid="approval-candidate" data-kind={c.kind} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{c.title}</span>
                      <span className="block truncate t5 text-text-muted">{c.detail}</span>
                    </span>
                    <Tag>{c.kind === "post" ? "Post" : "Entrega"}</Tag>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {candidates.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div>
            <Label htmlFor="approval-days">Validade</Label>
            <Select id="approval-days" value={days} onChange={(e) => setDays(e.target.value)}>
              <option value="3">3 dias</option>
              <option value="7">7 dias</option>
              <option value="14">14 dias</option>
              <option value="30">30 dias</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="approval-phone">WhatsApp do cliente (opcional)</Label>
            <Input id="approval-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="5511999999999" inputMode="tel" />
          </div>
          <Button onClick={create} disabled={busy || picked.size === 0} data-testid="approval-link-create">
            {busy ? "Gerando..." : `Gerar link (${picked.size})`}
          </Button>
        </div>
      )}

      {data.links.length > 0 && (
        <div>
          <p className="mb-2 t3 font-medium">Links enviados</p>
          <ul className="space-y-1.5 t3" data-testid="approval-links">
            {data.links.map((link) => (
              <li key={link.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-edge px-3 py-2">
                <span>
                  <Tag>{STATE_LABEL[link.state]}</Tag>{" "}
                  <span className="text-text-muted">{`${link.items.length} itens · ${link.pending} sem resposta · aberto ${link.viewCount}x`}</span>
                </span>
                {link.state === "open" && (
                  <span className="flex gap-2">
                    <button type="button" className="text-text hover:underline" onClick={() => resend(link)}>
                      Reenviar
                    </button>
                    <CopyButton text={link.url} label="Copiar" />
                    <button type="button" className="text-negative hover:underline" onClick={() => close(link)}>
                      Encerrar
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Modal para abrir o painel de qualquer tela (calendário, dashboard do cliente).
export function ApprovalLinkDialog({
  clients,
  defaultClientId,
  onClose,
}: {
  clients: { id: string; name: string }[];
  defaultClientId: string;
  onClose: () => void;
}) {
  const [clientId, setClientId] = useState(defaultClientId || clients[0]?.id || "");
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-edge bg-surface p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        data-testid="approval-link-dialog"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h3 className="d4">Enviar para aprovação</h3>
            <p className="t5 text-text-muted">O cliente aprova pelo celular, sem login. O post aprovado já entra na agenda.</p>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text" aria-label="Fechar">
            <Icon name="x" size={18} />
          </button>
        </div>
        {clients.length > 1 && (
          <div className="mb-3">
            <Label htmlFor="approval-client">Cliente</Label>
            <Select id="approval-client" value={clientId} onChange={(e) => setClientId(e.target.value)} data-testid="approval-client">
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
        )}
        {clientId ? <ApprovalLinkPanel key={clientId} clientId={clientId} /> : <p className="t3 text-text-muted">Cadastre um cliente primeiro.</p>}
      </div>
    </div>
  );
}

// Card do dashboard do cliente (agência): abre o painel deste cliente.
export function ApprovalLinkCard({ clientId, clientName }: { clientId: string; clientName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-edge bg-surface p-5 shadow-sm" data-testid="approval-link-card">
      <div>
        <p className="flex items-center gap-2 font-medium">
          <Icon name="check" size={16} className="text-text" /> Aprovação por link
        </p>
        <p className="t3 measure-lede mt-2 text-text-muted">Mande posts e entregas pelo WhatsApp. O cliente aprova sem senha e o post já entra na agenda.</p>
      </div>
      <Button onClick={() => setOpen(true)} data-testid="approval-link-open">
        <Icon name="send" size={14} /> Enviar para aprovação
      </Button>
      {open && <ApprovalLinkDialog clients={[{ id: clientId, name: clientName }]} defaultClientId={clientId} onClose={() => setOpen(false)} />}
    </div>
  );
}
