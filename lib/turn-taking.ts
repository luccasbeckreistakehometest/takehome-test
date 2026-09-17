// Troca de turno automática no briefing falado (puro, sem áudio): decide
// quando a pessoa terminou de falar e quando ela interrompeu a voz da IA,
// a partir do volume do microfone (RMS a cada ~50 ms) e dos resultados finais
// do reconhecimento de fala.

export const TURN_DEFAULTS = {
  calibrationMs: 700, // ruído de fundo medido no começo
  noiseFactor: 2.5, // limiar = ruído × fator
  minThreshold: 0.012, // sala silenciosa: limiar mínimo
  silenceMs: 1600, // silêncio depois da fala que encerra o turno
  bargeInMs: 300, // falar por cima da IA por este tempo interrompe a voz
  minWords: 3,
  adapt: 0.05, // o ruído de fundo se ajusta devagar durante o silêncio
} as const;

export type TurnConfig = { [K in keyof typeof TURN_DEFAULTS]: number };

export type TurnPhase = "calibrating" | "listening" | "ai_speaking";

export type TurnState = {
  phase: TurnPhase;
  startedAt: number;
  calibration: number[];
  noiseFloor: number;
  silenceSince: number | null;
  heardVoice: boolean;
  hasFinal: boolean;
  words: number;
  aboveSince: number | null; // fala por cima da IA
};

export type TurnEvent = "end_turn" | "barge_in" | null;

export function createTurnState(now: number, config: TurnConfig = TURN_DEFAULTS): TurnState {
  void config;
  return { phase: "calibrating", startedAt: now, calibration: [], noiseFloor: 0, silenceSince: null, heardVoice: false, hasFinal: false, words: 0, aboveSince: null };
}

export function threshold(state: Pick<TurnState, "noiseFloor">, config: TurnConfig = TURN_DEFAULTS): number {
  return Math.max(config.minThreshold, state.noiseFloor * config.noiseFactor);
}

const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

// Resultado final do reconhecimento (o texto acumulado do turno).
export function noteFinal(state: TurnState, text: string): TurnState {
  const words = countWords(text);
  return { ...state, hasFinal: words > 0, words };
}

// A IA começou a falar: o reconhecimento pausa (não transcreve o próprio eco).
export function startAiSpeech(state: TurnState): TurnState {
  return { ...state, phase: "ai_speaking", aboveSince: null };
}

// A voz da IA terminou (ou foi interrompida): novo turno de escuta, com o
// ruído de fundo já calibrado.
export function startListening(state: TurnState, now: number): TurnState {
  return {
    ...state,
    phase: state.noiseFloor > 0 || state.calibration.length > 0 ? "listening" : "calibrating",
    startedAt: now,
    silenceSince: null,
    heardVoice: false,
    hasFinal: false,
    words: 0,
    aboveSince: null,
  };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

// Um novo nível de volume. Devolve o estado seguinte e, quando for o caso, o
// evento: fim do turno (silêncio depois da fala, com texto final suficiente)
// ou interrupção da voz da IA.
export function feedLevel(state: TurnState, rms: number, now: number, config: TurnConfig = TURN_DEFAULTS): { state: TurnState; event: TurnEvent } {
  const level = Number.isFinite(rms) && rms > 0 ? rms : 0;
  if (state.phase === "calibrating") {
    const calibration = [...state.calibration, level];
    if (now - state.startedAt < config.calibrationMs) return { state: { ...state, calibration }, event: null };
    return { state: { ...state, calibration, noiseFloor: median(calibration), phase: "listening", silenceSince: null }, event: null };
  }
  const limit = threshold(state, config);
  if (state.phase === "ai_speaking") {
    if (level < limit) return { state: { ...state, aboveSince: null }, event: null };
    const aboveSince = state.aboveSince ?? now;
    if (now - aboveSince >= config.bargeInMs) return { state: startListening({ ...state, aboveSince: null }, now), event: "barge_in" };
    return { state: { ...state, aboveSince }, event: null };
  }
  // escutando
  if (level >= limit) return { state: { ...state, heardVoice: true, silenceSince: null }, event: null };
  const noiseFloor = state.noiseFloor + (level - state.noiseFloor) * config.adapt;
  const silenceSince = state.silenceSince ?? now;
  const next = { ...state, noiseFloor, silenceSince };
  const ready = state.hasFinal && state.words >= config.minWords;
  if (ready && now - silenceSince >= config.silenceMs) return { state: next, event: "end_turn" };
  return { state: next, event: null };
}

export const MAX_VOICE_TURNS = 12;
