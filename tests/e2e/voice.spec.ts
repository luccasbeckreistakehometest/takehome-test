import { test, expect } from "@playwright/test";
import { login, signupViaApi, skipOnboarding } from "./helpers";

test("brand briefing by voice fills the client form", async ({ page }) => {
  await page.addInitScript(() => { (window as unknown as { __ahVoiceTest: boolean }).__ahVoiceTest = true; });
  await login(page, "agencia");
  await skipOnboarding(page);
  await page.goto("/clients/new");
  await page.getByTestId("mode-voice").click();
  await expect(page.getByTestId("voice")).toBeVisible();
  await page.getByTestId("voice-start").click();
  await expect(page.getByTestId("voice-stop")).toBeVisible();

  // thin first turn → the listener asks for what is missing
  await page.evaluate(() => (window as unknown as { __ahVoiceFeed: (t: string) => void }).__ahVoiceFeed("oi, é uma cafeteria"));
  await expect(page.getByTestId("voice-review")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("voice-confirm")).toBeDisabled();

  // sem voz de IA no servidor, a pergunta fica escrita e a escuta volta sozinha
  await expect(page.getByTestId("voice")).toHaveAttribute("data-state", "listening");
  await page.evaluate(() => (window as unknown as { __ahVoiceFeed: (t: string) => void }).__ahVoiceFeed(
    "A marca é o Café Aurora, uma cafeteria artesanal de bairro com padaria própria. Quem compra são moradores de 25 a 45 anos em home office. O objetivo é dobrar o movimento nas manhãs de semana em seis meses, com uns três mil por mês em Instagram e Google.",
  ));
  await expect(page.getByTestId("voice-confirm")).toBeEnabled({ timeout: 20_000 });
  await page.getByTestId("voice-confirm").click();

  // fields are filled for review, then saved like any client
  await expect(page.getByPlaceholder("Ex.: Café Aurora")).toHaveValue("Café Aurora");
  await expect(page.getByText(/Preenchido por voz/)).toBeVisible();
  await page.getByTestId("save-client").click();
  await expect(page.getByTestId("one-time-login")).toBeVisible();
  await page.getByRole("button", { name: "Abrir o cliente" }).click();
  await expect(page).toHaveURL(/\/clients\/(?!new$)[^/]+$/);
  await expect(page.locator("h1").first()).toContainText("Café Aurora");
});

// Marca autônoma: escolhe "Falando" e conversa 3 turnos sem clicar — a troca
// de turno vem do silêncio depois de uma frase completa.
test("self-serve brand speaks the briefing with automatic turn-taking", async ({ page }) => {
  await page.addInitScript(() => { (window as unknown as { __ahVoiceTest: boolean }).__ahVoiceTest = true; });
  await signupViaApi(page.request, "client", "Marca Falante", { industry: "moda" }, "198.51.100.84");
  const me = await (await page.request.get("/api/auth/me")).json();
  await skipOnboarding(page);
  const coinsBefore = (await (await page.request.get("/api/billing")).json()).wallet.coins;

  await page.goto(`/clients/${me.refId}`);
  await page.getByTestId("briefing-talk").click();
  await page.getByTestId("voice-start").click();
  const voice = page.getByTestId("voice");
  await expect(voice).toHaveAttribute("data-state", "listening");
  await expect(page.getByTestId("voice-status")).toHaveText("Ouvindo…");
  const sim = (steps: { speech?: number; silence?: number; final?: string }[]) =>
    page.evaluate((s) => (window as unknown as { __ahVoiceSim: (x: typeof s) => void }).__ahVoiceSim(s), steps);

  // turno 1: pausa curta não encerra; 1,6 s de silêncio encerra
  await sim([{ speech: 1000 }, { final: "oi, é uma loja de roupas" }, { silence: 1000 }]);
  await expect(voice).toHaveAttribute("data-state", "listening");
  await expect(page.getByTestId("voice-review")).toHaveCount(0);
  await sim([{ silence: 700 }]);
  await expect(page.getByTestId("voice-review")).toBeVisible();
  await expect(voice).toHaveAttribute("data-state", "listening");

  // turno 2 (ainda falta coisa)
  await sim([{ speech: 800 }, { final: "vendemos roupas femininas" }, { silence: 1700 }]);
  await expect(page.getByTestId("voice-review").locator("li")).toHaveCount(2);
  await expect(voice).toHaveAttribute("data-state", "listening");

  // turno 3 completa o briefing: a escuta para e o microfone é liberado
  await sim([
    { speech: 1500 },
    { final: "A marca é a Loja Sol, moda feminina confortável para mulheres de 30 a 50 anos que trabalham fora. Queremos vender mais pelo Instagram nos próximos três meses." },
    { silence: 1700 },
  ]);
  await expect(page.getByTestId("voice-confirm")).toBeEnabled();
  await expect(voice).toHaveAttribute("data-state", "review");
  expect(await page.evaluate(() => (window as unknown as { __ahVoiceMic?: string }).__ahVoiceMic)).toBe("closed");
  await expect(voice.getByRole("alert")).toHaveCount(0);

  await page.getByTestId("voice-confirm").click();
  await expect(page.getByTestId("briefing-voice-saved")).toBeVisible();
  const client = await (await page.request.get(`/api/clients/${me.refId}`)).json();
  expect(client.name).toBe("Marca Falante");
  expect(client.description.length).toBeGreaterThan(10);
  expect(client.audience.length).toBeGreaterThan(5);
  // uma conversa = 1 coin, não um por fala
  const coinsAfter = (await (await page.request.get("/api/billing")).json()).wallet.coins;
  expect(coinsBefore - coinsAfter).toBe(1);
});
