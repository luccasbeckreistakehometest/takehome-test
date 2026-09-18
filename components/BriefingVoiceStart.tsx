"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { Client } from "@/lib/types";
import type { VoiceBriefing as Briefing } from "@/lib/voice-briefing";
import VoiceBriefing from "./VoiceBriefing";
import { Icon } from "./icons";

// "Como prefere contar sobre sua marca?" — falando (briefing de voz com troca
// de turno automática) ou escrevendo. Aparece enquanto o briefing está ralo.
export default function BriefingVoiceStart({
  client,
  onSaved,
  onWrite,
}: {
  client: Client;
  onSaved: (client: Client) => void;
  onWrite: () => void;
}) {
  const [talking, setTalking] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function apply(b: Briefing) {
    setError("");
    try {
      // só preenche o que estava vazio: nada que a pessoa escreveu é apagado
      const merged = { ...client } as Client & Record<string, unknown>;
      for (const [key, value] of Object.entries(b.fields)) {
        const current = merged[key];
        const empty = Array.isArray(current) ? current.length === 0 : !String(current ?? "").trim();
        if (empty && (Array.isArray(value) ? value.length > 0 : String(value ?? "").trim())) merged[key] = value;
      }
      const updated = await api<Client>(`/api/clients/${client.id}`, { method: "PUT", body: JSON.stringify(merged) });
      setTalking(false);
      setSaved(true);
      onSaved(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar");
    }
  }

  if (talking) {
    return (
      <div className="space-y-2" data-testid="briefing-voice-start">
        <VoiceBriefing confirmLabel="Salvar no briefing" onConfirm={(b) => void apply(b)} onTypeInstead={() => { setTalking(false); onWrite(); }} />
        {error && <p className="t3 text-negative" role="alert">{error}</p>}
      </div>
    );
  }
  return (
    <div className="rounded-md border border-edge bg-surface-sunken p-5" data-testid="briefing-voice-start">
      {saved ? (
        <p className="t3 font-medium" data-testid="briefing-voice-saved">Briefing salvo. Confira os campos na aba Briefing quando quiser.</p>
      ) : (
        <>
          <p className="d4">Como prefere contar sobre sua marca?</p>
          <p className="t3 measure-lede mt-2 text-text-muted">Fale como numa conversa: quando você para, a IA entende que é a vez dela e pergunta o que faltar.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => setTalking(true)} className="t3 inline-flex items-center gap-2 rounded-sm border border-edge bg-surface px-4 py-2 font-medium transition-colors duration-[var(--dur-1)] hover:bg-surface-sunken" data-testid="briefing-talk" data-tour="briefing-talk">
              <Icon name="mic" size={16} /> Falando
            </button>
            <button type="button" onClick={onWrite} className="inline-flex items-center gap-2 rounded-md border border-edge bg-surface px-4 py-2 t3" data-testid="briefing-write">
              <Icon name="edit" size={16} /> Escrevendo
            </button>
          </div>
        </>
      )}
    </div>
  );
}
