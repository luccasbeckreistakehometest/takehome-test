import { spawn } from "child_process";
import fs from "fs";
import path from "path";

// Gerencia o processo do worker de sessão (WhatsApp Web) a partir do servidor,
// para o usuário controlar tudo por BOTÃO — sem terminal. Como o app roda na
// máquina do próprio usuário, spawnar o worker abre o navegador de login na
// tela dele. O worker publica estado em data/messaging-worker-status.json.

const root = process.cwd();
const statusFile = path.join(root, "data", "messaging-worker-status.json");
const logFile = path.join(root, "data", "messaging-worker.log");
const scriptPath = path.join(root, "scripts", "messaging-worker.mjs");

export type WorkerState =
  | "idle"
  | "starting"
  | "installing"
  | "awaiting_login"
  | "connected"
  | "draining"
  | "stopped"
  | "error";

export type WorkerStatus = {
  running: boolean;
  pid: number | null;
  channel: string | null;
  state: WorkerState;
  message: string;
  updatedAt: string | null;
};

type RawStatus = {
  pid?: number;
  channel?: string;
  state?: WorkerState;
  message?: string;
  updatedAt?: string;
};

function readRaw(): RawStatus | null {
  try {
    return JSON.parse(fs.readFileSync(statusFile, "utf8")) as RawStatus;
  } catch {
    return null;
  }
}

function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function getWorkerStatus(): WorkerStatus {
  const raw = readRaw();
  if (!raw) {
    return { running: false, pid: null, channel: null, state: "idle", message: "", updatedAt: null };
  }
  const running = raw.pid ? pidAlive(raw.pid) : false;
  let state: WorkerState = raw.state ?? "idle";
  // Processo morto mas status "vivo" → normaliza para parado
  if (!running && !["stopped", "error", "idle"].includes(state)) {
    state = "stopped";
  }
  return {
    running,
    pid: raw.pid ?? null,
    channel: raw.channel ?? null,
    state,
    message: raw.message ?? "",
    updatedAt: raw.updatedAt ?? null,
  };
}

export function startWorker(channel = "whatsapp"): WorkerStatus {
  const current = getWorkerStatus();
  if (current.running) return current;

  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  const out = fs.openSync(logFile, "a");
  const child = spawn(process.execPath, [scriptPath, `--channel=${channel}`], {
    cwd: root,
    detached: true,
    stdio: ["ignore", out, out],
  });
  child.unref();

  // Status inicial imediato para a UI já mostrar "iniciando"
  fs.writeFileSync(
    statusFile,
    JSON.stringify({
      pid: child.pid,
      channel,
      state: "starting",
      message: "Iniciando o assistente de envio…",
      updatedAt: new Date().toISOString(),
    })
  );
  return getWorkerStatus();
}

export function stopWorker(): WorkerStatus {
  const raw = readRaw();
  if (raw?.pid && pidAlive(raw.pid)) {
    try {
      process.kill(raw.pid, "SIGTERM");
    } catch {
      // já morreu
    }
  }
  fs.writeFileSync(
    statusFile,
    JSON.stringify({
      pid: null,
      channel: raw?.channel ?? "whatsapp",
      state: "stopped",
      message: "Encerrado.",
      updatedAt: new Date().toISOString(),
    })
  );
  return getWorkerStatus();
}
