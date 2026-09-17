// Captura screenshots reais do sistema (logando em cada papel) para os PDFs
// de venda — cobrindo TODAS as seções. Cliente demo em PT-BR (Ateliê Amora).
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { chromium } from "playwright";

// Senha das contas de demonstração (nunca no código): PITCH_PASSWORD=... node scripts/pitch-screenshots.mjs
const PASSWORD = process.env.PITCH_PASSWORD ?? "";
if (!PASSWORD) {
  console.error("Defina PITCH_PASSWORD com a senha das contas de demonstração.");
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outDir = path.join(root, "pitch", "shots");
fs.mkdirSync(outDir, { recursive: true });

const BASE = "http://localhost:4000";
const AMORA = "951b8eb8-89cb-4a5e-bf4a-5e8197132fd9";
const PRO = "3c574276-5a53-40ad-a59d-0ca8bfa176d2";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function shoot(page, name, url, { waitFor } = {}) {
  await page.goto(BASE + url, { waitUntil: "networkidle" }).catch(() => {});
  if (waitFor) await page.waitForSelector(waitFor, { timeout: 15000 }).catch(() => {});
  await sleep(2200);
  await page.screenshot({ path: path.join(outDir, `${name}.png`) });
  console.log("  ✓", name);
}

async function login(context, username, password) {
  const page = await context.newPage();
  await page.goto(BASE + "/login", { waitUntil: "networkidle" });
  await page.locator("input").first().fill(username);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForLoadState("networkidle").catch(() => {});
  await sleep(1000);
  return page;
}

async function makeContext(browser) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    colorScheme: "dark",
    deviceScaleFactor: 2,
  });
  await context.addInitScript(() => {
    try {
      localStorage.setItem("theme", "dark");
      localStorage.setItem("onboarded_agency", "1");
      localStorage.setItem("onboarded_client", "1");
      localStorage.setItem("onboarded_professional", "1");
    } catch {}
  });
  return context;
}

async function run() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });

  // ---------- AGÊNCIA (seções globais + workspace do cliente demo) ----------
  console.log("Agência:");
  const agCtx = await makeContext(browser);
  const ag = await login(agCtx, "agencia", PASSWORD);
  // Seções globais
  await shoot(ag, "ag-home", "/", { waitFor: "h1" });
  await shoot(ag, "ag-clients", "/clients");
  await shoot(ag, "ag-insights", "/insights", { waitFor: "h1" });
  await shoot(ag, "ag-production", "/production");
  await shoot(ag, "ag-prospecting", "/prospecting", { waitFor: "h1" });
  await shoot(ag, "ag-ideas", `/ideas?audience=client&targetId=${AMORA}`, { waitFor: "h1" });
  await shoot(ag, "ag-agenda", "/agenda");
  await shoot(ag, "ag-messages", "/messages");
  await shoot(ag, "ag-plans", "/plans", { waitFor: "h1" });
  await shoot(ag, "ag-settings", "/settings");
  // Workspace do Ateliê Amora — cada entregável
  const w = (tab) => `/clients/${AMORA}?tab=${tab}`;
  await shoot(ag, "am-dashboard", w("dashboard"), { waitFor: "h1" });
  await shoot(ag, "am-strategy", w("strategy_analysis"));
  await shoot(ag, "am-radar", w("market_pulse"));
  await shoot(ag, "am-campaign", w("campaign_plan"));
  await shoot(ag, "am-roi", w("roi_projection"));
  await shoot(ag, "am-social", w("social_calendar"));
  await shoot(ag, "am-posts", w("post_batch"));
  await shoot(ag, "am-identity", w("visual_identity"));
  await shoot(ag, "am-ofertas", w("product_recs"));
  await shoot(ag, "am-relatorio", w("client_report"));
  await shoot(ag, "am-demandas", w("projects"));
  await shoot(ag, "am-vendas", w("sales"));
  await agCtx.close();

  // ---------- CLIENTE (portal do Ateliê) ----------
  console.log("Cliente:");
  const clCtx = await makeContext(browser);
  const cl = await login(clCtx, "atelie.amora", PASSWORD);
  await shoot(cl, "portal-client", `/portal/client/${AMORA}`, { waitFor: "h1" });
  await clCtx.close();

  // ---------- PROFISSIONAL ----------
  console.log("Profissional:");
  const prCtx = await makeContext(browser);
  const pr = await login(prCtx, "luccas.fotografo", PASSWORD);
  await shoot(pr, "pro-profile", `/professionals/${PRO}`, { waitFor: "h1" });
  await prCtx.close();

  await browser.close();
  console.log("Concluído. Shots em pitch/shots/");
}

run().catch((e) => {
  console.error("ERRO:", e?.message ?? e);
  process.exit(1);
});
