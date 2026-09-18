"use client";

import { useEffect, useRef, useState } from "react";
import { readUiLang } from "@/lib/i18n";
import type { VoiceBriefing as Briefing } from "@/lib/voice-briefing";
import {
  createTurnState,
  feedLevel,
  MAX_VOICE_TURNS,
  noteFinal,
  startAiSpeech,
  startListening,
  type TurnState,
} from "@/lib/turn-taking";
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
type TestWindow = {
  __ahVoiceTest?: boolean;
  __ahVoiceFeed?: (t: string) => void;
  __ahVoiceSim?: (steps: { speech?: number; silence?: number; final?: string }[]) => void;
  __ahVoiceMic?: "open" | "closed";
};
const testWindow = () => window as unknown as TestWindow;

const LABELS: Record<string, string> = { name: "Nome da marca", industry: "Segmento", description: "Sobre a empresa", audience: "Público-alvo", goals: "Objetivos" };

type Phase = "idle" | "listening" | "thinking" | "speaking" | "review";

// Briefing de marca falado, com troca de turno automática: a pessoa fala,
// para, e a IA entende que é a vez dela (silêncio depois de uma frase
// completa). Enquanto a voz da IA toca, o microfone não transcreve; falar por
// cima interrompe. "Terminei de falar" continua como reserva.
export default function VoiceBriefing({
  onConfirm,
  onTypeInstead,
  confirmLabel = "Usar no cadastro",
}: {
  onConfirm: (b: Briefing, id: string) => void;
  onTypeInstead: () => void;
  confirmLabel?: string;
}) {
  const lang = readUiLang();
  const [supported, setSupported] = useState(true);
  const [phase, setPhaseState] = useState<Phase>("idle");
  const [interim, setInterim] = useState("");
  const [heard, setHeard] = useState("");
  const [turns, setTurns] = useState<string[]>([]);
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [briefingId, setBriefingId] = useState<string | undefined>();
  const [followUp, setFollowUp] = useState<string | null>(null);
  const [error, setError] = useState("");
  const rec = useRef<Rec | null>(null);
  const buffer = useRef("");
  const interimRef = useRef("");
  const phaseRef = useRef<Phase>("idle");
  const turn = useRef<TurnState | null>(null);
  const mic = useRef<{ stream: MediaStream | null; ctx: AudioContext | null; timer: number | null }>({ stream: null, ctx: null, timer: null });
  const session = useRef<{ briefingId?: string; briefing: Briefing | null; turns: number }>({ briefing: null, turns: 0 });
  const simClock = useRef(0);
  const opener = lang === "en"
    ? "Tell me about the brand: what it's called, what it sells, who buys it, and what you want marketing to achieve. When you pause, it's my turn."
    : "Me conta da marca: como se chama, o que vende, quem compra e o que você quer que o marketing alcance. Quando você parar de falar, é a minha vez.";
  const prompt = followUp ?? opener;

  const setPhase = (next: Phase) => {
    phaseRef.current = next;
    setPhaseState(next);
  };

  useEffect(() => {
    const id = requestAnimationFrame(() => setSupported(!!getRec() || !!testWindow().__ahVoiceTest));
    return () => cancelAnimationFrame(id);
  }, []);

  // A voz vem do servidor (ElevenLabs / OpenAI TTS), nunca do sintetizador do
  // navegador: sem provedor, a pergunta aparece escrita e a escuta segue.
  const audio = useRef<HTMLAudioElement | null>(null);
  const [voiceOn, setVoiceOn] = useState(false);
  // o laço do microfone roda num intervalo: lê a flag por ref (sem closure velha)
  const voiceOnRef = useRef(false);
  useEffect(() => {
    let frame = 0;
    fetch("/api/voice/speak")
      .then((r) => r.json())
      .then((j) => {
        voiceOnRef.current = !!j.provider;
        frame = requestAnimationFrame(() => setVoiceOn(!!j.provider));
      })
      .catch(() => {});
    return () => cancelAnimationFrame(frame);
  }, []);
  const hush = () => {
    try {
      audio.current?.pause();
    } catch {
      /* nada tocando */
    }
    audio.current = null;
  };

  function stopRecognition() {
    if (rec.current) rec.current.onend = null;
    try {
      rec.current?.stop();
    } catch {
      /* já parado */
    }
    rec.current = null;
  }

  function stopMic() {
    stopRecognition();
    const m = mic.current;
    if (m.timer !== null) window.clearInterval(m.timer);
    m.stream?.getTracks().forEach((t) => t.stop());
    void m.ctx?.close().catch(() => {});
    mic.current = { stream: null, ctx: null, timer: null };
    testWindow().__ahVoiceMic = "closed";
  }

  // microfone e voz liberados ao sair da tela
  useEffect(() => () => {
    stopMic();
    hush();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onLevel(rms: number, now: number) {
    const state = turn.current;
    if (!state || phaseRef.current === "thinking" || phaseRef.current === "review" || phaseRef.current === "idle") return;
    const out = feedLevel(state, rms, now);
    turn.current = out.state;
    if (out.event === "end_turn" && phaseRef.current === "listening") void finishTurn();
    if (out.event === "barge_in" && phaseRef.current === "speaking") {
      hush();
      resumeListening(now);
    }
  }

  function startRecognition() {
    buffer.current = "";
    interimRef.current = "";
    setInterim("");
    setHeard("");
    const Ctor = getRec();
    if (!Ctor) return;
    const r = new Ctor();
    rec.current = r;
    r.lang = lang === "en" ? "en-US" : "pt-BR";
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let finals = "";
      let live = "";
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i];
        const t = res[0]?.transcript ?? "";
        if (res.isFinal) finals += t + " ";
        else live += t;
      }
      buffer.current = finals.trim();
      interimRef.current = live;
      setInterim(live);
      setHeard(finals.trim());
      if (turn.current) turn.current = noteFinal(turn.current, buffer.current);
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setError("O microfone foi bloqueado. Libere na barra de endereço ou digite o briefing.");
        stopMic();
        setPhase("idle");
      }
    };
    r.onend = () => {
      try {
        r.start();
      } catch {
        /* encerrado */
      }
    };
    try {
      r.start();
    } catch {
      setError("Seu navegador não faz reconhecimento de voz.");
    }
  }

  function resumeListening(now = performance.now()) {
    if (turn.current) turn.current = startListening(turn.current, now);
    startRecognition();
    setPhase("listening");
  }

  async function openMic(): Promise<boolean> {
    if (testWindow().__ahVoiceTest) {
      // teste: sem microfone de verdade, ruído de fundo já medido
      turn.current = { ...createTurnState(simClock.current), phase: "listening", noiseFloor: 0.004 };
      testWindow().__ahVoiceMic = "open";
      return true;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const data = new Float32Array(analyser.fftSize);
      turn.current = createTurnState(performance.now());
      const timer = window.setInterval(() => {
        analyser.getFloatTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
        onLevel(Math.sqrt(sum / data.length), performance.now());
      }, 50);
      mic.current = { stream, ctx, timer };
      testWindow().__ahVoiceMic = "open";
      return true;
    } catch {
      setError("Não consegui abrir o microfone. Libere o acesso ou digite o briefing.");
      return false;
    }
  }

  async function start() {
    setError("");
    hush();
    if (session.current.turns >= MAX_VOICE_TURNS) {
      setError("Chegamos ao limite de conversa deste briefing. Revise os campos ou complete digitando.");
      return;
    }
    if (!mic.current.stream && !(await openMic())) return;
    resumeListening();
  }

  // Fala a pergunta; quando a voz termina, volta a escutar sozinho.
  async function speakThen(text: string, then: "listen" | "stop") {
    hush();
    stopRecognition();
    const listen = () => {
      if (then === "listen" && session.current.turns < MAX_VOICE_TURNS) resumeListening();
      else stopMic();
    };
    if (!voiceOnRef.current) {
      listen();
      return;
    }
    if (turn.current) turn.current = startAiSpeech(turn.current);
    setPhase("speaking");
    try {
      const r = await fetch("/api/voice/speak", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, lang }) });
      if (r.status !== 200) {
        listen();
        return;
      }
      const url = URL.createObjectURL(await r.blob());
      const a = new Audio(url);
      audio.current = a;
      a.onended = () => {
        URL.revokeObjectURL(url);
        if (audio.current === a) {
          audio.current = null;
          listen();
        }
      };
      await a.play();
    } catch {
      // autoplay bloqueado: a pergunta está na tela
      listen();
    }
  }

  async function replay() {
    if (!voiceOnRef.current) return;
    await speakThen(prompt, phaseRef.current === "review" ? "stop" : "listen");
  }

  async function finishTurn() {
    if (phaseRef.current !== "listening") return;
    stopRecognition();
    const text = (buffer.current + " " + interimRef.current).trim();
    setInterim("");
    if (text.length < 3) {
      resumeListening();
      return;
    }
    session.current.turns += 1;
    setTurns((t) => [...t, text]);
    setPhase("thinking");
    try {
      const r = await fetch("/api/voice/briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: text, lang, briefingId: session.current.briefingId, prior: session.current.briefing }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Não consegui entender. Tente de novo.");
      session.current.briefing = j.briefing;
      session.current.briefingId = j.briefingId;
      setBriefing(j.briefing);
      setBriefingId(j.briefingId);
      const needsMore = j.briefing.missing.length > 0 && j.briefing.followUp;
      if (needsMore && session.current.turns < MAX_VOICE_TURNS) {
        setFollowUp(j.briefing.followUp);
        await speakThen(j.briefing.followUp, "listen");
      } else {
        setPhase("review");
        stopMic();
        await speakThen(needsMore ? j.briefing.followUp : lang === "en" ? "I have what I need." : "Tenho o que preciso.", "stop");
        setPhase("review");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
      stopMic();
      setPhase("idle");
    }
  }

  // Ganchos de teste: transcrição direta (encerra o turno) e simulação de
  // fala/silêncio com relógio virtual (troca de turno sem clique).
  useEffect(() => {
    const w = testWindow();
    w.__ahVoiceFeed = (t: string) => {
      buffer.current = t;
      if (turn.current) turn.current = noteFinal(turn.current, t);
      void finishTurn();
    };
    w.__ahVoiceSim = (steps) => {
      for (const step of steps) {
        if (step.final !== undefined) {
          buffer.current = step.final;
          setHeard(step.final);
          if (turn.current) turn.current = noteFinal(turn.current, step.final);
        }
        const ms = step.speech ?? step.silence ?? 0;
        const level = step.speech ? 0.2 : 0.001;
        for (let t = 0; t < ms; t += 50) {
          simClock.current += 50;
          onLevel(level, simClock.current);
        }
      }
    };
    return () => {
      delete w.__ahVoiceFeed;
      delete w.__ahVoiceSim;
    };
  });

  const complete = !!briefing && briefing.missing.length === 0;
  const status = phase === "listening" ? "Ouvindo…" : phase === "thinking" ? "Pensando…" : phase === "speaking" ? "Falando…" : "";

  if (!supported) {
    return (
      <Card>
        <p className="t3 text-text-muted" data-testid="voice-unsupported">Seu navegador não suporta voz — use Chrome, Edge ou Safari. Você pode digitar o briefing.</p>
        <Button type="button" className="mt-3" onClick={onTypeInstead}>Digitar o briefing</Button>
      </Card>
    );
  }

  return (
    <Card>
      <div data-testid="voice" data-state={phase}>
        <p className="t6 text-text-muted">Briefing falado</p>
        <h2 className="d4 mt-1">Conte sobre a marca</h2>
        <div className="mt-4 rounded-md border border-edge bg-surface-sunken p-4 t3 leading-relaxed" data-testid="voice-prompt">“{prompt}”</div>
        <div className="mt-2 flex items-center gap-3 t5">
          {voiceOn ? (
            <button type="button" onClick={() => void replay()} className="font-semibold text-text hover:underline" data-testid="voice-replay">▶ Ouvir</button>
          ) : (
            <span className="text-text-muted">Só texto neste servidor (voz da IA não configurada).</span>
          )}
          <span className="text-text-muted">{`${turns.length}/${MAX_VOICE_TURNS} falas`}</span>
        </div>

        <div className="mt-5 flex flex-col items-center gap-3">
          {phase === "listening" || phase === "speaking" ? (
            <>
              <button
                type="button"
                onClick={() => (phase === "speaking" ? (hush(), resumeListening()) : void finishTurn())}
                className="relative grid size-16 place-items-center rounded-full bg-text text-canvas shadow-e1"
                aria-label={phase === "speaking" ? "Interromper e falar" : "Terminei de falar"}
                data-testid="voice-stop"
              >
                <span className={`absolute inset-0 rounded-full bg-surface-sunken ${phase === "listening" ? "animate-ping" : ""}`} />
                <Icon name="mic" size={24} />
              </button>
              <p className="t3 font-medium text-text" data-testid="voice-status">{status}</p>
              <p className="min-h-5 max-w-lg text-center t3 text-text-muted" aria-live="polite">{(heard + " " + interim).trim()}</p>
              {phase === "listening" && (
                <>
                  <p className="t5 text-text-muted">Quando você parar de falar, a IA entende que é a vez dela.</p>
                  <Button type="button" variant="ghost" onClick={() => void finishTurn()}>Terminei de falar</Button>
                </>
              )}
            </>
          ) : phase === "thinking" ? (
            <p className="t3 text-text-muted" data-testid="voice-thinking">Pensando…</p>
          ) : (
            <Button type="button" onClick={() => void start()} data-testid="voice-start">
              {phase === "review" ? "Falar mais" : "Começar a falar"}
            </Button>
          )}
          {error && <p className="t3 text-negative" role="alert">{error}</p>}
        </div>

        {briefing && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2" data-testid="voice-review">
            <div>
              <p className="t6 text-text-muted">O que eu ouvi</p>
              <ul className="mt-2 space-y-2 t3 text-text-muted">{turns.map((t, i) => <li key={i} className="rounded-lg bg-surface-sunken px-3 py-2">“{t}”</li>)}</ul>
            </div>
            <div>
              <p className="t6 text-text-muted">O que eu entendi</p>
              <p className="mt-2 t3">{briefing.summary}</p>
              <dl className="mt-3 space-y-1 t3">
                {(Object.keys(LABELS) as (keyof typeof LABELS)[]).map((k) => briefing.fields[k as keyof typeof briefing.fields] ? (
                  <div key={k} className="flex gap-3"><dt className="w-32 shrink-0 text-text-muted">{LABELS[k]}</dt><dd>{String(briefing.fields[k as keyof typeof briefing.fields])}</dd></div>
                ) : null)}
                {briefing.fields.channels.length > 0 && <div className="flex gap-3"><dt className="w-32 shrink-0 text-text-muted">Canais</dt><dd>{briefing.fields.channels.join(", ")}</dd></div>}
              </dl>
              {briefing.missing.length > 0 && <p className="mt-3 t3 text-caution">Ainda falta: {briefing.missing.map((m) => LABELS[m] ?? m).join(", ")}</p>}
              {complete && <p className="mt-3 t3 text-positive">Tenho o que preciso.</p>}
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-edge pt-4">
          <button type="button" onClick={() => { stopMic(); hush(); onTypeInstead(); }} className="t3 text-text-muted hover:text-text" data-testid="voice-type-instead">Prefiro digitar</button>
          {briefing && (
            <Button type="button" disabled={!complete || !briefingId} onClick={() => { stopMic(); hush(); onConfirm(briefing, briefingId!); }} data-testid="voice-confirm">
              {confirmLabel}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
