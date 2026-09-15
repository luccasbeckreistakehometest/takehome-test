"use client";

import { useEffect, useRef, useState } from "react";
import { readUiLang } from "@/lib/i18n";
import type { VoiceBriefing as Briefing } from "@/lib/voice-briefing";
import { Button, Card } from "./ui";
import { Icon } from "./icons";

// Web Speech API não está no lib do TS; declaramos só o que usamos.
type Rec = { lang: string; continuous: boolean; interimResults: boolean; start(): void; stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null };
type RecCtor = new () => Rec;
const getRec = (): RecCtor | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

const LABELS: Record<string, string> = { name: "Nome da marca", industry: "Segmento", description: "Sobre a empresa", audience: "Público-alvo", goals: "Objetivos" };

// Briefing de marca falado. Quem fala é o dono do negócio ou a agência; cada
// turno vai ao servidor, que devolve o que entendeu e UMA pergunta do que
// falta. Ao confirmar, os campos caem no formulário para revisão e salvamento.
export default function VoiceBriefing({ onConfirm, onTypeInstead }: { onConfirm: (b: Briefing, id: string) => void; onTypeInstead: () => void }) {
  const lang = readUiLang();
  const [supported, setSupported] = useState(true);
  const [phase, setPhase] = useState<"idle" | "listening" | "thinking" | "review">("idle");
  const [interim, setInterim] = useState("");
  const [turns, setTurns] = useState<string[]>([]);
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [briefingId, setBriefingId] = useState<string | undefined>();
  const [followUp, setFollowUp] = useState<string | null>(null);
  const [error, setError] = useState("");
  const rec = useRef<Rec | null>(null);
  const buffer = useRef("");
  const opener = lang === "en"
    ? "Tell me about the brand: what it's called, what it sells, who buys it, and what you want marketing to achieve. Take your time."
    : "Me conta da marca: como se chama, o que vende, quem compra, e o que você quer que o marketing alcance. Sem pressa.";
  const prompt = followUp ?? opener;

  useEffect(() => {
    const id = requestAnimationFrame(() => setSupported(!!getRec() || !!(window as unknown as { __ahVoiceTest?: boolean }).__ahVoiceTest));
    return () => cancelAnimationFrame(id);
  }, []);

  // A voz vem do servidor (ElevenLabs / OpenAI TTS), nunca do sintetizador do
  // navegador: sem provedor, a pergunta aparece escrita e não é falada.
  const audio = useRef<HTMLAudioElement | null>(null);
  const [voiceOn, setVoiceOn] = useState(false);
  useEffect(() => {
    fetch("/api/voice/speak").then((r) => r.json()).then((j) => { const id = requestAnimationFrame(() => setVoiceOn(!!j.provider)); return () => cancelAnimationFrame(id); }).catch(() => {});
  }, []);
  const hush = () => { try { audio.current?.pause(); } catch { /* nada tocando */ } audio.current = null; };
  const speak = async (text: string) => {
    hush();
    try {
      const r = await fetch("/api/voice/speak", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, lang }) });
      if (r.status !== 200) return;
      const url = URL.createObjectURL(await r.blob());
      const a = new Audio(url); audio.current = a;
      a.onended = () => URL.revokeObjectURL(url);
      await a.play();
    } catch { /* autoplay bloqueado ou sem áudio: o texto está na tela */ }
  };
  useEffect(() => { if (voiceOn && !followUp) void speak(opener); return hush; /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [voiceOn, lang]);

  useEffect(() => {
    // gancho de teste: o Playwright injeta a transcrição no lugar do microfone
    (window as unknown as { __ahVoiceFeed?: (t: string) => void }).__ahVoiceFeed = (t: string) => { buffer.current = t; void finishTurn(); };
    return () => { delete (window as unknown as { __ahVoiceFeed?: unknown }).__ahVoiceFeed; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [briefingId, briefing, turns]);

  function start() {
    setError(""); hush();
    const Ctor = getRec();
    if (!Ctor) { setPhase("listening"); return; }
    const r = new Ctor(); rec.current = r;
    r.lang = lang === "en" ? "en-US" : "pt-BR"; r.continuous = true; r.interimResults = true;
    buffer.current = "";
    r.onresult = (e) => {
      let finals = "", live = "";
      for (let i = 0; i < e.results.length; i++) { const res = e.results[i]; const t = res[0]?.transcript ?? ""; if (res.isFinal) finals += t + " "; else live += t; }
      buffer.current = finals.trim(); setInterim(live);
    };
    r.onerror = (e) => { if (e.error === "not-allowed" || e.error === "service-not-allowed") { setError("O microfone foi bloqueado. Libere na barra de endereço ou digite o briefing."); setPhase("idle"); } };
    r.onend = () => { try { r.start(); } catch { /* encerrado */ } };
    try { r.start(); setPhase("listening"); } catch { setError("Seu navegador não faz reconhecimento de voz."); }
  }

  async function finishTurn() {
    if (rec.current) rec.current.onend = null;
    try { rec.current?.stop(); } catch { /* já parado */ }
    const text = (buffer.current + " " + interim).trim();
    setInterim("");
    if (text.length < 3) { setPhase("idle"); return; }
    setTurns((t) => [...t, text]);
    setPhase("thinking");
    try {
      const r = await fetch("/api/voice/briefing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transcript: text, lang, briefingId, prior: briefing }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Não consegui entender. Tente de novo.");
      setBriefing(j.briefing); setBriefingId(j.briefingId);
      if (j.briefing.missing.length && j.briefing.followUp) { setFollowUp(j.briefing.followUp); void speak(j.briefing.followUp); }
      else void speak(lang === "en" ? "I have what I need." : "Tenho o que preciso.");
      setPhase("review");
    } catch (e) { setError(e instanceof Error ? e.message : "Erro"); setPhase("idle"); }
  }

  const complete = !!briefing && briefing.missing.length === 0;

  if (!supported) {
    return (
      <Card>
        <p className="text-sm text-muted">Seu navegador não faz reconhecimento de voz — Chrome, Edge ou Safari fazem.</p>
        <Button type="button" className="mt-3" onClick={onTypeInstead}>Digitar o briefing</Button>
      </Card>
    );
  }

  return (
    <Card>
      <div data-testid="voice">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">Briefing falado</p>
        <h2 className="mt-1 font-[family-name:var(--font-display)] text-xl font-semibold">Conte sobre a marca</h2>
        <div className="mt-4 rounded-xl border border-edge bg-surface-2 p-4 text-sm leading-relaxed" data-testid="voice-prompt">“{prompt}”</div>
        <div className="mt-2 flex items-center gap-3 text-xs">
          {voiceOn ? <button type="button" onClick={() => void speak(prompt)} className="font-semibold text-accent hover:underline" data-testid="voice-replay">▶ Ouvir</button> : <span className="text-muted">Só texto neste servidor (voz da IA não configurada).</span>}
        </div>

        <div className="mt-5 flex flex-col items-center gap-3">
          {phase === "listening" ? (
            <>
              <button type="button" onClick={finishTurn} className="relative grid size-16 place-items-center rounded-full bg-accent text-accent-ink shadow-lg" aria-label="Terminei" data-testid="voice-stop">
                <span className="absolute inset-0 animate-ping rounded-full bg-accent/40" />
                <Icon name="mic" size={24} />
              </button>
              <p className="text-sm font-medium text-accent">Ouvindo…</p>
              <p className="min-h-5 max-w-lg text-center text-sm text-muted" aria-live="polite">{(buffer.current + " " + interim).trim()}</p>
              <Button type="button" onClick={finishTurn}>Terminei</Button>
            </>
          ) : phase === "thinking" ? (
            <p className="text-sm text-muted" data-testid="voice-thinking">Entendendo…</p>
          ) : (
            <Button type="button" onClick={start} data-testid="voice-start">{phase === "review" ? "Falar mais" : "Começar a falar"}</Button>
          )}
          {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
        </div>

        {briefing && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2" data-testid="voice-review">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted">O que eu ouvi</p>
              <ul className="mt-2 space-y-2 text-sm text-muted">{turns.map((t, i) => <li key={i} className="rounded-lg bg-surface-2 px-3 py-2">“{t}”</li>)}</ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted">O que eu entendi</p>
              <p className="mt-2 text-sm">{briefing.summary}</p>
              <dl className="mt-3 space-y-1 text-sm">
                {(Object.keys(LABELS) as (keyof typeof LABELS)[]).map((k) => briefing.fields[k as keyof typeof briefing.fields] ? (
                  <div key={k} className="flex gap-3"><dt className="w-32 shrink-0 text-muted">{LABELS[k]}</dt><dd>{String(briefing.fields[k as keyof typeof briefing.fields])}</dd></div>
                ) : null)}
                {briefing.fields.channels.length > 0 && <div className="flex gap-3"><dt className="w-32 shrink-0 text-muted">Canais</dt><dd>{briefing.fields.channels.join(", ")}</dd></div>}
              </dl>
              {briefing.missing.length > 0 && <p className="mt-3 text-sm text-amber-400">Ainda falta: {briefing.missing.map((m) => LABELS[m] ?? m).join(", ")}</p>}
              {complete && <p className="mt-3 text-sm text-emerald-400">Tenho o que preciso.</p>}
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-edge pt-4">
          <button type="button" onClick={onTypeInstead} className="text-sm text-muted hover:text-foreground">Prefiro digitar</button>
          {briefing && <Button type="button" disabled={!complete || !briefingId} onClick={() => onConfirm(briefing, briefingId!)} data-testid="voice-confirm">Usar no cadastro</Button>}
        </div>
      </div>
    </Card>
  );
}
