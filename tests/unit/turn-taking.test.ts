import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { createTurnState, feedLevel, noteFinal, startAiSpeech, startListening, threshold, type TurnState, type TurnEvent } from "@/lib/turn-taking";

// Alimenta níveis a cada 50 ms de `from` até `to` (exclusive).
function run(state: TurnState, level: number, from: number, to: number): { state: TurnState; events: { at: number; event: TurnEvent }[] } {
  const events: { at: number; event: TurnEvent }[] = [];
  let s = state;
  for (let t = from; t < to; t += 50) {
    const out = feedLevel(s, level, t);
    s = out.state;
    if (out.event) events.push({ at: t, event: out.event });
  }
  return { state: s, events };
}

function calibrated(noise = 0.004): TurnState {
  return run(createTurnState(0), noise, 0, 750).state;
}

describe("turn taking", () => {
  it("calibrates the noise floor and sets an adaptive threshold", () => {
    const s = calibrated(0.01);
    expect(s.phase).toBe("listening");
    expect(s.noiseFloor).toBeCloseTo(0.01);
    expect(threshold(s)).toBeCloseTo(0.025);
    expect(threshold(calibrated(0))).toBe(0.012);
  });

  it("never ends the turn before a final result", () => {
    let s = calibrated();
    s = run(s, 0.2, 750, 2000).state;
    const silent = run(s, 0.001, 2000, 6000);
    expect(silent.events).toEqual([]);
  });

  it("ends the turn after 1600 ms of silence following speech with a final result", () => {
    let s = calibrated();
    s = run(s, 0.2, 750, 2000).state;
    s = noteFinal(s, "a marca se chama café aurora");
    const out = run(s, 0.001, 2000, 4000);
    expect(out.events[0]).toEqual({ at: 3600, event: "end_turn" });
  });

  it("keeps listening when the pause is shorter than 1600 ms", () => {
    let s = calibrated();
    s = noteFinal(run(s, 0.2, 750, 1500).state, "vendemos café especial todo dia");
    let out = run(s, 0.001, 1500, 3000); // 1,5 s de pausa
    expect(out.events).toEqual([]);
    out = run(out.state, 0.2, 3000, 3500); // volta a falar
    expect(run(out.state, 0.001, 3500, 5000).events).toEqual([]);
  });

  it("needs at least three words", () => {
    let s = calibrated();
    s = noteFinal(run(s, 0.2, 750, 1500).state, "oi tudo");
    expect(run(s, 0.001, 1500, 5000).events).toEqual([]);
  });

  it("barges in after 300 ms of speech over the AI voice, not on a blip", () => {
    let s = startAiSpeech(calibrated());
    let out = run(s, 0.2, 1000, 1200); // 200 ms: tosse
    expect(out.events).toEqual([]);
    out = run(out.state, 0.001, 1200, 1400);
    out = run(out.state, 0.2, 1400, 1800);
    expect(out.events[0]).toEqual({ at: 1700, event: "barge_in" });
    expect(out.state.phase).toBe("listening");
    s = startListening(out.state, 2000);
    expect(s.hasFinal).toBe(false);
  });

  it("the voice briefing never uses the browser's robotic voice", () => {
    const roots = ["app", "components", "lib"].map((d) => path.join(__dirname, "../..", d));
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(tsx?|mjs)$/.test(entry.name)) {
          const code = fs.readFileSync(full, "utf8").replace(/\/\/.*$/gm, "");
          if (/speechSynthesis/.test(code)) offenders.push(full);
        }
      }
    };
    roots.forEach(walk);
    expect(offenders).toEqual([]);
  });
});
