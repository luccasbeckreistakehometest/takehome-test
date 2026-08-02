// Worker de envio pela SESSÃO do usuário (WhatsApp Web) — modelo SERVIDOR.
//
// Arquitetura: em produção o app roda no backend, então o Chromium roda
// HEADLESS no servidor, com um PERFIL PERSISTENTE POR CONTA (userDataDir
// separado). Quando não há login, o worker tira PRINT do QR code do WhatsApp
// Web e salva num arquivo que o front exibe; o usuário escaneia com o celular
// e a sessão fica salva no perfil daquela conta no servidor. Nos próximos
// envios já entra logado, sem QR. Funciona igual em localhost.
//
// NÃO burla detecção de bot (nada de stealth/spoof) — só respeita pausas
// entre envios. Iniciado pela UI (botão "Conectar"), sem terminal.
//
// Args: --channel=whatsapp  --profile=<id da conta>  [--headful]

import path from "path";
import fs from "fs";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const dataDir = path.join(root, "data");

const arg = (name, def) => {
  const found = process.argv.find((a) => a.startsWith(`--${name}=`));
  return found ? found.split("=")[1] : def;
};
const channel = arg("channel", "whatsapp");
const profile = arg("profile", "default");
const headful = process.argv.includes("--headful");

const statusFile = path.join(dataDir, "messaging-worker-status.json");
const qrFile = path.join(dataDir, `messaging-qr-${profile}.png`);
const userDataDir = path.join(dataDir, `messaging-session-${profile}`);

const nowIso = () => new Date().toISOString();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function writeStatus(state, message = "") {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(
      statusFile,
      JSON.stringify({ pid: process.pid, channel, profile, state, message, updatedAt: nowIso() })
    );
  } catch {
    // best-effort
  }
}
function clearQr() {
  try {
    if (fs.existsSync(qrFile)) fs.unlinkSync(qrFile);
  } catch {
    /* ignore */
  }
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: root, stdio: "inherit", shell: process.platform === "win32" });
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} saiu com ${code}`))));
    child.on("error", reject);
  });
}

async function ensurePlaywright() {
  try {
    return (await import("playwright")).chromium;
  } catch {
    writeStatus("installing", "Instalando o motor de automação (uma vez só)…");
    await run("npm", ["install", "-D", "playwright"]);
    writeStatus("installing", "Motor instalado, preparando o navegador…");
    return (await import("playwright")).chromium;
  }
}

async function launchContext(chromium) {
  const opts = { headless: !headful, viewport: { width: 1100, height: 900 } };
  try {
    return await chromium.launchPersistentContext(userDataDir, opts);
  } catch (e) {
    const msg = String(e?.message ?? e);
    if (msg.includes("Executable doesn't exist") || msg.includes("playwright install")) {
      writeStatus("installing", "Baixando o navegador (uma vez só, ~1 min)…");
      await run("npx", ["playwright", "install", "chromium"]);
      writeStatus("starting", "Navegador pronto, abrindo…");
      return await chromium.launchPersistentContext(userDataDir, opts);
    }
    throw e;
  }
}

let shuttingDown = false;
for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, () => {
    shuttingDown = true;
    writeStatus("stopped", "Encerrado.");
    if (sig === "SIGINT") process.exit(0);
  });
}

async function isLoggedIn(page) {
  return page
    .locator('#pane-side, [aria-label="Lista de conversas"], [data-testid="chat-list"]')
    .first()
    .isVisible()
    .catch(() => false);
}

// Captura o QR (canvas do WhatsApp Web) para o front exibir.
async function captureQr(page) {
  try {
    const canvas = page.locator('canvas[aria-label*="Scan"], div[data-ref] canvas, canvas').first();
    if (await canvas.isVisible().catch(() => false)) {
      await canvas.screenshot({ path: qrFile });
      return true;
    }
  } catch {
    /* QR ainda não renderizou */
  }
  return false;
}

async function waitForLogin(page) {
  await page.goto("https://web.whatsapp.com", { waitUntil: "domcontentloaded" }).catch(() => {});
  // Até ~4 min para escanear; re-captura o QR (ele expira e muda)
  for (let i = 0; i < 120 && !shuttingDown; i++) {
    if (await isLoggedIn(page)) {
      clearQr();
      return true;
    }
    const got = await captureQr(page);
    writeStatus(
      "awaiting_login",
      got ? "Escaneie o QR code no app com o WhatsApp do seu celular." : "Carregando o QR code…"
    );
    await sleep(3000);
  }
  return isLoggedIn(page);
}

async function sendWhatsApp(page, phone, body) {
  const url = `https://web.whatsapp.com/send?phone=${phone.replace(/\D/g, "")}&text=${encodeURIComponent(body)}`;
  await page.goto(url, { waitUntil: "domcontentloaded" });
  const sendButton = 'button[aria-label="Enviar"], button[aria-label="Send"], span[data-icon="send"]';
  await page.waitForSelector(sendButton, { timeout: 60000 });
  await sleep(1200);
  await page.click(sendButton);
  await sleep(1500);
}

async function main() {
  writeStatus("starting", "Preparando…");
  if (channel !== "whatsapp") {
    writeStatus("error", "Só WhatsApp tem modo sessão. Instagram usa a API oficial.");
    return;
  }

  let chromium, db;
  try {
    chromium = await ensurePlaywright();
    db = (await import("better-sqlite3")).default;
    db = new db(path.join(dataDir, "agencyhub.db"));
  } catch (e) {
    writeStatus("error", `Falha ao preparar: ${String(e?.message ?? e).slice(0, 160)}`);
    return;
  }

  const markSession = (ready) => {
    try {
      db.prepare(
        `INSERT INTO channel_connections (channel, mode, apiToken, apiAccountId, sessionReady, updatedAt)
         VALUES ('whatsapp', 'session', '', '', ?, ?)
         ON CONFLICT(channel) DO UPDATE SET sessionReady = ?, updatedAt = ?`
      ).run(ready ? 1 : 0, nowIso(), ready ? 1 : 0, nowIso());
    } catch {
      /* tabela pode não existir */
    }
  };

  const context = await launchContext(chromium);
  const page = context.pages()[0] ?? (await context.newPage());

  if (!(await waitForLogin(page))) {
    writeStatus("error", "Login não concluído. Feche e tente conectar de novo.");
    clearQr();
    await context.close().catch(() => {});
    return;
  }
  clearQr();
  markSession(true);
  writeStatus("connected", "Conectado. Enviando mensagens da fila automaticamente.");

  const due = () =>
    db
      .prepare(
        `SELECT * FROM message_outbox
         WHERE channel = 'whatsapp' AND mode = 'session'
           AND (status = 'queued' OR (status = 'scheduled' AND scheduledFor <= ?))
         ORDER BY createdAt ASC`
      )
      .all(nowIso());
  const setMsg = (id, status, error = "") =>
    db
      .prepare("UPDATE message_outbox SET status = ?, error = ?, sentAt = ? WHERE id = ?")
      .run(status, error, status === "sent" ? nowIso() : null, id);

  while (!shuttingDown) {
    const messages = due();
    for (const msg of messages) {
      if (shuttingDown) break;
      try {
        setMsg(msg.id, "sending");
        writeStatus("draining", `Enviando para ${msg.toAddress}…`);
        await sendWhatsApp(page, msg.toAddress, msg.body);
        setMsg(msg.id, "sent");
        await sleep(12000 + Math.floor(Math.random() * 13000));
      } catch (e) {
        setMsg(msg.id, "failed", String(e?.message ?? e).slice(0, 200));
      }
    }
    if (!shuttingDown) {
      writeStatus("connected", "Conectado. Aguardando novas mensagens na fila.");
      await sleep(8000);
    }
  }

  markSession(false);
  await context.close().catch(() => {});
  writeStatus("stopped", "Encerrado.");
}

main();
