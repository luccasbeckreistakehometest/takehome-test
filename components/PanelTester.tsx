"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { LETTERS, variantScores, type PanelResult, type Persona } from "@/lib/panel-rules";
import { Button, ErrorBox, Tag, Textarea } from "./ui";
import { Icon } from "./icons";

const daysAheadAt10 = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10) + "T10:00";

type Test = { id: string; variants: string[]; personas: Persona[]; generic: boolean; result: PanelResult; demo: boolean; variantPostIds: (string | null)[] };

// "Testar com o público": 2 ou 3 versões lidas por personas da estratégia.
// Simulação para descartar opções fracas — não substitui teste real.
export default function PanelTester({
  clientId,
  initial,
  postId,
  label = "Testar com o público",
  onApply,
}: {
  clientId: string;
  initial: string;
  postId?: string;
  label?: string;
  onApply: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [variants, setVariants] = useState<string[]>([initial, ""]);
  const [test, setTest] = useState<Test | null>(null);
  const [cached, setCached] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [scheduled, setScheduled] = useState<number[]>([]);

  async function run() {
    setBusy(true);
    setError("");
    try {
      const r = await api<{ test: Test; cached: boolean }>(`/api/clients/${clientId}/panel`, {
        method: "POST",
        body: JSON.stringify({ variants: variants.map((v) => v.trim()).filter(Boolean), postId }),
      });
      setTest(r.test);
      setCached(r.cached);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  async function schedule(variant: number) {
    if (!test) return;
    const when = daysAheadAt10(3);
    try {
      await api(`/api/panel/${test.id}/schedule`, { method: "POST", body: JSON.stringify({ variant, scheduledFor: when }) });
      setScheduled((s) => [...s, variant]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => { setVariants([initial, ""]); setOpen(true); }} className="inline-flex items-center gap-1.5 text-xs font-medium text-text hover:underline" data-testid="panel-open">
        <Icon name="users" size={13} /> {label}
      </button>
    );
  }

  const scores = test ? variantScores(test.result, test.variants.length) : [];
  return (
    <div className="space-y-3 rounded-lg border border-edge bg-surface-2 p-3" data-testid="panel-tester">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Painel de público (simulação)</p>
        <button type="button" onClick={() => setOpen(false)} className="text-muted hover:text-foreground" aria-label="Fechar">
          <Icon name="x" size={14} />
        </button>
      </div>
      {variants.map((v, i) => (
        <div key={i}>
          <p className="mb-1 text-xs font-semibold text-muted">{`Versão ${LETTERS[i]}`}</p>
          <Textarea value={v} onChange={(e) => setVariants(variants.map((x, j) => (j === i ? e.target.value : x)))} data-testid="panel-variant" />
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        {variants.length < 3 && (
          <button type="button" className="text-xs text-text hover:underline" onClick={() => setVariants([...variants, ""])}>
            + Versão C
          </button>
        )}
        <Button className="!px-3 !py-1.5 text-xs" onClick={run} disabled={busy || variants.filter((v) => v.trim().length >= 3).length < 2} data-testid="panel-run">
          {busy ? "O painel está lendo..." : "Testar · 2 coins"}
        </Button>
      </div>
      {error && <ErrorBox message={error} />}
      {test && (
        <div className="space-y-2" data-testid="panel-result" data-winner={test.result.winner}>
          <div className="flex flex-wrap gap-1.5">
            {test.generic && <Tag>personas genéricas (sem estratégia)</Tag>}
            {cached && <Tag>mesmo teste de antes — sem custo</Tag>}
            {test.demo && <Tag>exemplo (modo de teste)</Tag>}
          </div>
          <p className="text-sm">
            <strong>{`Vencedora: versão ${LETTERS[test.result.winner]}`}</strong> — {test.result.why}
          </p>
          <p className="text-xs text-muted">{`Ajuste sugerido: ${test.result.fix}`}</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-xs" data-testid="panel-table">
              <thead className="text-muted">
                <tr>
                  <th className="py-1 pr-2">Persona</th>
                  {test.variants.map((_, v) => (
                    <th key={v} className="py-1 pr-2">{`Versão ${LETTERS[v]}`}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-edge">
                {test.personas.map((p) => (
                  <tr key={p.name}>
                    <td className="py-1 pr-2 align-top font-medium">{p.name}</td>
                    {test.variants.map((_, v) => {
                      const cell = test.result.cells.find((c) => c.persona === p.name && c.variant === v);
                      return (
                        <td key={v} className="py-1 pr-2 align-top" data-testid="panel-cell">
                          {cell ? (
                            <>
                              <span className="block">{`para ${cell.stopScroll}/10 · clareza ${cell.clarity}/10 · ${cell.wouldClick ? "clicaria" : "não clicaria"}`}</span>
                              <span className="block text-muted">{`“${cell.quote}”`}</span>
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className="py-1 pr-2">Média</td>
                  {scores.map((s) => (
                    <td key={s.variant} className="py-1 pr-2">{`${s.score} · ${s.clickRate}% clicariam`}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" className="!px-3 !py-1.5 text-xs" onClick={() => onApply(test.variants[test.result.winner])} data-testid="panel-apply">
              Usar a vencedora
            </Button>
            {test.variants.map((_, v) =>
              scheduled.includes(v) ? (
                <span key={v} className="text-xs text-text">{`Versão ${LETTERS[v]} no calendário ✓`}</span>
              ) : (
                <button key={v} type="button" className="text-xs text-text hover:underline" onClick={() => schedule(v)}>
                  {`Agendar versão ${LETTERS[v]} para comparar`}
                </button>
              )
            )}
          </div>
        </div>
      )}
      <p className="text-[11px] text-muted" data-testid="panel-disclaimer">
        Simulação com personas da estratégia — serve pra descartar opções fracas, não substitui teste real. Depois, os cliques reais dizem se o painel acertou.
      </p>
    </div>
  );
}
