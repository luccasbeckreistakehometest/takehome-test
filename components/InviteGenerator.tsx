"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button, Card, CopyButton, Label, SectionTitle, Select, Tag } from "./ui";

type Invite = {
  id: string;
  token: string;
  role: string;
  note: string;
  status: string;
  expiresAt: string | null;
  createdAt: string;
};

const ROLE_LABEL: Record<string, string> = {
  client: "Cliente",
  professional: "Profissional",
  agency: "Agência",
};

// Gera convites com TOKEN. Quem entra pelo link fica com a marca whitelabel
// da agência (brandSource=agency). Rastreia status e permite revogar.
export default function InviteGenerator({ origin }: { origin: string }) {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [role, setRole] = useState("client");
  const [note, setNote] = useState("");
  const [expires, setExpires] = useState("14");
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    api<{ invites: Invite[] }>("/api/invites").then((r) => setInvites(r.invites)).catch(() => {});
  }, []);
  useEffect(() => load(), [load]);

  async function create() {
    setCreating(true);
    try {
      await api("/api/invites", {
        method: "POST",
        body: JSON.stringify({
          role,
          note,
          expiresInDays: expires ? Number(expires) : undefined,
        }),
      });
      setNote("");
      load();
    } finally {
      setCreating(false);
    }
  }

  async function revoke(id: string) {
    await api(`/api/invites?id=${id}`, { method: "DELETE" });
    load();
  }

  const pending = invites.filter((i) => i.status === "pending");

  return (
    <Card className="space-y-3">
      <SectionTitle>Convites com a sua marca</SectionTitle>
      <p className="t3 text-text-muted">
        Gere um link de convite. Quem entrar por ele vê a plataforma com a{" "}
        <strong className="text-text">sua identidade (whitelabel)</strong> — logo e cores da agência.
        Auto-cadastros pela porta pública veem a marca da plataforma.
      </p>

      <div className="grid gap-3 sm:grid-cols-[1fr_2fr_auto_auto] sm:items-end">
        <div>
          <Label>Tipo</Label>
          <Select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="client">Cliente</option>
            <option value="professional">Profissional</option>
            <option value="agency">Agência</option>
          </Select>
        </div>
        <div>
          <Label>Nota (opcional)</Label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ex.: Fotógrafo indicado pela Ana"
            className="w-full rounded-md border border-edge bg-surface-sunken px-3 py-2 t3 outline-none focus:border-edge"
          />
        </div>
        <div>
          <Label>Expira (dias)</Label>
          <input
            type="number"
            value={expires}
            onChange={(e) => setExpires(e.target.value)}
            className="w-20 rounded-md border border-edge bg-surface-sunken px-3 py-2 t3 outline-none focus:border-edge"
          />
        </div>
        <Button onClick={create} disabled={creating}>
          {creating ? "Gerando..." : "Gerar link"}
        </Button>
      </div>

      {pending.length > 0 && (
        <div className="space-y-1.5 border-t border-edge pt-3">
          {pending.map((invite) => {
            const link = `${origin}/convite/${invite.token}`;
            return (
              <div
                key={invite.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-edge bg-surface-sunken px-3 py-2 t3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Tag>{ROLE_LABEL[invite.role] ?? invite.role}</Tag>
                    {invite.note && <span className="t5 text-text-muted">{invite.note}</span>}
                  </div>
                  <p className="mt-0.5 truncate font-mono t5 text-text-muted">{link}</p>
                </div>
                <div className="flex items-center gap-2">
                  <CopyButton text={link} label="Copiar" />
                  <button
                    onClick={() => revoke(invite.id)}
                    className="t5 text-text-muted transition-colors hover:text-negative"
                  >
                    Revogar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
