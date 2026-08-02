// Worker de envio pela SESSÃO PRÓPRIA do usuário (WhatsApp Web / Instagram).
//
// Filosofia: este worker dirige uma sessão que VOCÊ loga manualmente, para
// enviar mensagens que VOCÊ compôs, aos SEUS contatos. Ele NÃO tenta burlar
// detecção de bot (nada de stealth/spoof de fingerprint) — isso viola o ToS
// e é o caminho mais rápido para banir sua conta. O que ele faz é respeitar
// pausas entre mensagens para não parecer rajada e não tomar rate-limit.
//
// Uso:
//   npm i -D playwright && npx playwright install chromium
//   npm run messaging-worker
// Na primeira vez, escaneie o QR (WhatsApp) ou logue (Instagram). A sessão
// fica salva em data/messaging-session e persiste entre execuções.

import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

let Database, chromium;
try {
  Database = (await import("better-sqlite3")).default;
  ({ chromium } = await import("playwright"));
} catch {
  console.error(
    "\nFalta dependência. Rode:\n  npm i -D playwright && npx playwright install chromium\n"
  );
  process.exit(1);
}

const db = new Database(path.join(root, "data", "agencyhub.db"));
const userDataDir = path.join(root, "data", "messaging-session");

const nowIso = () => new Date().toISOString();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function dueSessionMessages() {
  return db
    .prepare(
      `SELECT * FROM message_outbox
       WHERE mode = 'session'
         AND (status = 'queued' OR (status = 'scheduled' AND scheduledFor <= ?))
       ORDER BY createdAt ASC`
    )
    .all(nowIso());
}

function setStatus(id, status, error = "") {
  db.prepare(
    "UPDATE message_outbox SET status = ?, error = ?, sentAt = ? WHERE id = ?"
  ).run(status, error, status === "sent" ? nowIso() : null, id);
}

async function sendWhatsApp(page, phone, body) {
  const url = `https://web.whatsapp.com/send?phone=${phone.replace(/\D/g, "")}&text=${encodeURIComponent(body)}`;
  await page.goto(url, { waitUntil: "domcontentloaded" });
  // Espera a caixa de conversa (login/carregamento pode demorar na 1ª vez)
  const sendButton = 'button[aria-label="Enviar"], button[data-tab="11"], span[data-icon="send"]';
  await page.waitForSelector(sendButton, { timeout: 60000 });
  await sleep(1200);
  await page.click(sendButton);
  await sleep(1500);
}

async function run() {
  const messages = dueSessionMessages();
  if (messages.length === 0) {
    console.log("Fila vazia. Nada a enviar.");
    process.exit(0);
  }
  console.log(`${messages.length} mensagem(ns) na fila (modo sessão).`);

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    viewport: { width: 1100, height: 800 },
  });
  const page = context.pages()[0] ?? (await context.newPage());

  for (const msg of messages) {
    if (msg.channel !== "whatsapp") {
      // IG DM por sessão é frágil e muda de layout com frequência — deixamos
      // como não suportado aqui em vez de fingir que funciona.
      setStatus(msg.id, "failed", "IG por sessão ainda não suportado — use a API oficial.");
      continue;
    }
    try {
      setStatus(msg.id, "sending");
      console.log(`→ ${msg.toAddress}: ${msg.body.slice(0, 40)}...`);
      await sendWhatsApp(page, msg.toAddress, msg.body);
      setStatus(msg.id, "sent");
      console.log("  ✓ enviada");
      // Pausa entre envios (12–25s) para não disparar rate-limit
      await sleep(12000 + Math.floor(Math.random() * 13000));
    } catch (e) {
      setStatus(msg.id, "failed", String(e?.message ?? e).slice(0, 200));
      console.log("  ✗ falhou:", e?.message ?? e);
    }
  }

  console.log("Concluído. Fechando em 5s...");
  await sleep(5000);
  await context.close();
  process.exit(0);
}

run();
