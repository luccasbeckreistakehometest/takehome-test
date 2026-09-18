"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { fmtMoney, useUiLang } from "@/lib/i18n";
import { quotaCheck } from "@/lib/scope-rules";
import { Button, Card, ErrorBox, Input, SectionTitle, Select, Textarea } from "./ui";
import { monthLabel, RequestList, UsageBars, type PackagePayload, type RequestDecision } from "./PackageUsage";

type Guess = { itemKey: string; qty: number; confidence: number; reasoning: string; source: "ai" | "rules" | "manual"; noPackage?: boolean };

// Portal: "Solicitar uma produção" com o pacote do mês à vista. O pedido é
// conferido contra o que sobrou; o que passar vira extra com valor que o
// cliente aprova antes de a agência começar.
export default function ScopeRequestCard({ clientId }: { clientId: string }) {
  const lang = useUiLang();
  const [data, setData] = useState<PackagePayload | null>(null);
  const [text, setText] = useState("");
  const [guess, setGuess] = useState<Guess | null>(null);
  const [itemKey, setItemKey] = useState("");
  const [qty, setQty] = useState("1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState<"in" | "extra" | null>(null);

  const load = useCallback(() => api<PackagePayload>(`/api/clients/${clientId}/package`).then(setData).catch(() => {}), [clientId]);
  useEffect(() => {
    load();
  }, [load]);

  const hasPackage = Boolean(data?.package && data.usage.length > 0);
  const row = data?.usage.find((u) => u.key === itemKey);
  const preview = row ? quotaCheck(row, Number(qty) || 1) : null;

  async function next() {
    setBusy(true);
    setError("");
    try {
      const g = await api<Guess>(`/api/clients/${clientId}/scope-requests/classify`, { method: "POST", body: JSON.stringify({ text }) });
      setGuess(g);
      setItemKey(g.itemKey);
      setQty(String(g.qty || 1));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ needsApproval: boolean }>(`/api/clients/${clientId}/scope-requests`, {
        method: "POST",
        body: JSON.stringify({ text, itemKey, qty: Number(qty) || 1 }),
      });
      setSent(result.needsApproval ? "extra" : "in");
      setText("");
      setGuess(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  async function decide(id: string, decision: RequestDecision) {
    try {
      await api(`/api/scope-requests/${id}`, { method: "PATCH", body: JSON.stringify({ decision }) });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    }
  }

  return (
    <Card className="space-y-4" data-testid="scope-request-card">
      <div>
        <SectionTitle>Solicitar uma produção</SectionTitle>
        {hasPackage && data ? (
          <p className="t3 text-text-muted">{`Seu pacote em ${monthLabel(data.month, lang)}:`}</p>
        ) : (
          <p className="t3 text-text-muted">Precisa de algo? Descreva e a solicitação vira uma demanda no painel da agência na hora.</p>
        )}
      </div>
      {hasPackage && data && <UsageBars usage={data.usage} />}
      {error && <ErrorBox message={error} />}
      {sent && (
        <p className="rounded-md border border-edge bg-surface-sunken p-3 t3" data-testid="scope-sent" data-kind={sent}>
          {sent === "in"
            ? "Pedido enviado! Cabe no seu pacote e a agência já recebeu."
            : "Esse pedido passa do seu pacote. Aprove o valor abaixo para a agência começar."}
        </p>
      )}
      <Textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setGuess(null);
          setSent(null);
        }}
        placeholder='Ex.: "mais um post para o Dia dos Pais" ou "quero fotos novas do cardápio"...'
        data-testid="scope-text"
      />
      {!guess ? (
        <Button onClick={hasPackage ? next : send} disabled={busy || text.trim().length < 3} data-testid="scope-next">
          {busy ? "Enviando..." : hasPackage ? "Continuar" : "Enviar solicitação"}
        </Button>
      ) : (
        <div className="space-y-3 rounded-lg border border-edge bg-surface-sunken p-3" data-testid="scope-review">
          {guess.source === "ai" && guess.reasoning && <p className="t5 text-text-muted">{guess.reasoning}</p>}
          <div className="grid gap-2 sm:grid-cols-[1fr_90px]">
            <Select aria-label="O que é" value={itemKey} onChange={(e) => setItemKey(e.target.value)} data-testid="scope-item">
              {data?.usage.map((u) => (
                <option key={u.key} value={u.key}>
                  {u.label}
                </option>
              ))}
            </Select>
            <Input aria-label="Quantidade" type="number" min={1} max={50} value={qty} onChange={(e) => setQty(e.target.value)} data-testid="scope-qty" />
          </div>
          {preview && (
            <p className={`t3 ${preview.inPackage ? "" : "font-medium text-caution"}`} data-testid="scope-preview" data-in={preview.inPackage}>
              {preview.inPackage
                ? `Cabe no seu pacote (sobram ${preview.remaining}).`
                : `Isso passa do seu pacote: +${fmtMoney(preview.extraTotal, lang)}. A agência só começa depois que você aprovar.`}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button onClick={send} disabled={busy || !itemKey} data-testid="scope-send">
              {preview && !preview.inPackage ? "Enviar e ver o valor" : "Enviar pedido"}
            </Button>
            <Button variant="ghost" onClick={() => setGuess(null)}>
              Voltar
            </Button>
          </div>
        </div>
      )}
      {data && data.requests.length > 0 && <RequestList requests={data.requests.slice(0, 6)} actor="client" onDecide={decide} />}
    </Card>
  );
}
