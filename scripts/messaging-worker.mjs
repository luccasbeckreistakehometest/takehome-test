// Worker de envio pela SESSÃO PRÓPRIA do usuário (WhatsApp Web).
//
// Filosofia: dirige uma sessão que VOCÊ loga manualmente, para enviar
// mensagens que VOCÊ compôs, aos SEUS contatos. NÃO burla detecção de bot
// (nada de stealth/spoof de fingerprint) — isso viola o ToS e bane a conta.
// Só respeita pausas entre envios para não parecer rajada.
//
// Este worker é iniciado pela UI (botão "Conectar") — o usuário NÃO precisa
// de terminal. Ele: auto-instala o Playwright se faltar, abre o WhatsApp Web
// para login (QR), e fica drenando a fila. Publica status em
// data/messaging-worker-status.json para a interface acompanhar ao vivo.

import path from "path";
import fs from "fs";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const statusFile = path.join(root, "data", "messaging-worker-status.json");
const userDataDir = path.join(root, "data", "messaging-session");

const channelArg = process.argv.find((a) => a.startsWith("--channel="));
const channel = channelArg ? channelArg.split("=")[1] : "whatsapp";

const nowIso = () => new Date().toISOString();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Publica o estado atual para a UI ler (via /api/messaging/worker).
function writeStatus(state, message = "") {
  try {
    fs.mkdirSync(path.dirname(statusFile), { recursive: true });
    fs.writeFileSync(
      statusFile,
      JSON.stringify({ pid: process.pid, channel, state, message, updatedAt: nowIso() })
    );
  } catch {
    // status é best-effort
  }
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: root, stdio: "inherit", shell: process.platform === "win32" });
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} saiu com ${code}`))));
    child.on("error", reject);
  });
}

// Garante Playwright + Chromium instalados (usuário não usa terminal).
async function ensurePlaywright() {
  try {
    return (await import("playwright")).chromium;
  } catch {
    writeStatus("installing", "Instalando o motor de automação (uma vez só)…");
    await run("npm", ["install", "-D", "playwright"]);
    await run("npx", ["playwright", "install", "chromium"]);
    writeStatus("installing", "Motor instalado, abrindo…");
    return (await import("playwright")).chromium;
  }
}

async function loadDb() {
  const Database = (await import("better-sqlite3")).default;
  return new Database(path.join(root, "data", "agencyhub.db"));
}

let shuttingDown = false;
process.on("SIGTERM", () => {
  shuttingDown = true;
  writeStatus("stopped", "Encerrado.");
});
process.on("SIGINT", () => {
  shuttingDown = true;
  writeStatus("stopped", "Encerrado.");
  process.exit(0);
});

async function isLoggedIn(page) {
  // Logado: painel de conversas presente. Sem login: tela de QR.
  const loggedIn = await page
    .locator('#pane-side, [aria-label="Lista de conversas"], [data-testid="chat-list"]')
    .first()
    .isVisible()
    .catch(() => false);
  return loggedIn;
}

async function waitForLogin(page) {
  writeStatus("awaiting_login", "Escaneie o QR do WhatsApp Web na janela que abriu.");
  await page.goto("https://web.whatsapp.com", { waitUntil: "domcontentloaded" }).catch(() => {});
  // Espera até 3 min o usuário escanear o QR
  for (let i = 0; i < 90 && !shuttingDown; i++) {
    if (await isLoggedIn(page)) return true;
    await sleep(2000);
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
    db = await loadDb();
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
      // tabela pode não existir ainda — ignora
    }
  };

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    viewport: { width: 1100, height: 800 },
  });
  const page = context.pages()[0] ?? (await context.newPage());

  if (!(await waitForLogin(page))) {
    writeStatus("error", "Login não concluído. Feche e tente conectar de novo.");
    await context.close().catch(() => {});
    return;
  }
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

  // Loop contínuo: drena a fila e fica de prontidão (inclui agendados).
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
