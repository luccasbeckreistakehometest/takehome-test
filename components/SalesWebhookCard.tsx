"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { Button, CopyButton } from "./ui";

// URL do webhook de vendas com o token do cliente. O token só aparece quando
// alguém pede (não fica exposto na tela o tempo todo).
export default function SalesWebhookCard({ clientId }: { clientId: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const url = token ? `${origin}/api/webhooks/sales/${clientId}?token=${token}` : "";

  async function reveal() {
    setBusy(true);
    try {
      const current = await api<{ token: string | null }>(`/api/clients/${clientId}/webhook-token`);
      setToken(current.token);
      setLoaded(true);
    } finally {
      setBusy(false);
    }
  }

  async function rotate() {
    if (token && !window.confirm("Gerar um novo endereço? O atual para de funcionar na hora.")) return;
    setBusy(true);
    try {
      const next = await api<{ token: string }>(`/api/clients/${clientId}/webhook-token`, { method: "POST" });
      setToken(next.token);
      setLoaded(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-edge bg-surface-sunken p-3 t3" data-testid="sales-webhook">
      <p className="font-medium">Webhook de vendas (Shopify, Mercado Livre, loja própria)</p>
      <p className="mt-1 t5 text-text-muted">
        Cada pedido enviado para este endereço entra como venda do cliente. O endereço tem uma chave secreta: não publique.
      </p>
      {!loaded ? (
        <Button variant="ghost" className="mt-2" onClick={reveal} disabled={busy}>
          Mostrar endereço
        </Button>
      ) : token ? (
        <div className="mt-2 space-y-2">
          <code className="block break-all rounded bg-background px-2 py-1 t5">{url}</code>
          <div className="flex flex-wrap gap-2">
            <CopyButton text={url} label="Copiar endereço" />
            <button type="button" onClick={rotate} disabled={busy} className="t5 text-text-muted underline hover:text-text">
              Gerar novo endereço
            </button>
          </div>
        </div>
      ) : (
        <Button className="mt-2" onClick={rotate} disabled={busy}>
          Criar endereço
        </Button>
      )}
    </div>
  );
}
