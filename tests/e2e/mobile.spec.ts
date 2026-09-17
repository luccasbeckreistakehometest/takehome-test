import { devices, test, expect, type Page } from "@playwright/test";
import { login, signupViaApi, skipOnboarding } from "./helpers";

// Celular (Pixel 7, ~412 px): nenhuma tela principal pode rolar para o lado, e
// o menu da conta (com "Sair") existe em todas as telas logadas.

async function expectNoHorizontalOverflow(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle").catch(() => {});
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    const offenders: string[] = [];
    if (doc.scrollWidth > window.innerWidth + 1) {
      for (const el of Array.from(document.body.querySelectorAll<HTMLElement>("*"))) {
        const rect = el.getBoundingClientRect();
        if (rect.right > window.innerWidth + 1 && getComputedStyle(el).position !== "fixed") {
          let scrollParent = el.parentElement;
          let clipped = false;
          while (scrollParent && scrollParent !== document.body) {
            const style = getComputedStyle(scrollParent);
            if (["auto", "scroll", "hidden", "clip"].includes(style.overflowX)) {
              clipped = true;
              break;
            }
            scrollParent = scrollParent.parentElement;
          }
          if (!clipped) offenders.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)}`);
        }
        if (offenders.length > 5) break;
      }
    }
    return { scrollWidth: doc.scrollWidth, width: window.innerWidth, offenders };
  });
  expect(overflow.scrollWidth, `${path} overflows: ${overflow.offenders.join(" | ")}`).toBeLessThanOrEqual(overflow.width + 1);
}

test("public pages fit a phone", async ({ page }) => {
  for (const path of ["/", "/para-agencias", "/para-marcas", "/para-profissionais", "/login", "/criar-conta", "/contato", "/termos", "/privacy", "/reembolso", "/pagina-inexistente"]) {
    await expectNoHorizontalOverflow(page, path);
  }
});

test("agency and admin screens fit a phone and keep the account menu", async ({ page }) => {
  await login(page, "agencia");
  await skipOnboarding(page);
  const client = await (await page.request.post("/api/clients", { data: { name: "Cliente Mobile", channels: ["Instagram"] } })).json();
  for (const path of ["/", "/clients", `/clients/${client.id}`, "/production", "/calendar", "/insights", "/messages", "/prospecting", "/professionals", "/agenda", "/ideas", "/plans", "/settings", "/conta"]) {
    await expectNoHorizontalOverflow(page, path);
  }
  await expect(page.getByTestId("user-menu")).toBeVisible();
  await page.getByTestId("user-menu").click();
  await expect(page.getByTestId("logout")).toBeVisible();

  await page.context().clearCookies();
  await login(page, "admin");
  await expectNoHorizontalOverflow(page, "/admin");
  for (const tab of ["users", "payments", "inbox", "ai"]) {
    await page.getByTestId(`admin-tab-${tab}`).click();
    const width = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(width, `admin tab ${tab}`).toBeLessThanOrEqual(1);
  }
});

test("brand and professional screens fit a phone", async ({ page, browser }) => {
  await signupViaApi(page.request, "client", "Marca no Celular");
  const me = await (await page.request.get("/api/auth/me")).json();
  for (const path of [`/portal/client/${me.refId}`, `/clients/${me.refId}`, `/portal/client/${me.refId}/report`, "/plans", "/conta"]) {
    await expectNoHorizontalOverflow(page, path);
  }
  await expect(page.getByTestId("user-menu")).toBeVisible();

  const pro = await browser.newContext({ ...devices["Pixel 7"], baseURL: "http://localhost:3200", locale: "pt-BR" });
  const proPage = await pro.newPage();
  await signupViaApi(pro.request, "professional", "Designer no Celular");
  const proMe = await (await pro.request.get("/api/auth/me")).json();
  for (const path of [`/professionals/${proMe.refId}`, "/plans", "/conta"]) {
    await expectNoHorizontalOverflow(proPage, path);
  }
  await expect(proPage.getByTestId("user-menu")).toBeVisible();
  await pro.close();
});

// 390 px: todo passo de todo tour mostra um card inteiro na tela (folha
// inferior quando a âncora não aparece no celular).
async function walkTourOnPhone(page: Page, label: string) {
  await page.getByTestId("user-menu").click();
  await page.getByTestId("tour-restart").click();
  const card = page.getByTestId("tour-step");
  await expect(card).toBeVisible();
  for (let guard = 0; guard < 40; guard++) {
    if (!(await card.isVisible())) return guard;
    const step = await card.getAttribute("data-step");
    // a navegação entre páginas termina antes da medida
    await page.waitForTimeout(250);
    const box = await card.boundingBox();
    expect(box, `${label} step ${step}`).not.toBeNull();
    const viewport = page.viewportSize()!;
    expect(box!.y, `${label} step ${step} top`).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height, `${label} step ${step} bottom`).toBeLessThanOrEqual(viewport.height + 1);
    expect(box!.x + box!.width, `${label} step ${step} right`).toBeLessThanOrEqual(viewport.width + 1);
    await expect(card.getByTestId("tour-next")).toBeInViewport();
    const more = card.getByTestId("tour-more");
    if (await more.isVisible()) await more.click();
    else await card.getByTestId("tour-next").click();
    await expect.poll(async () => ((await card.isVisible()) ? await card.getAttribute("data-step") : "gone")).not.toBe(step);
  }
  throw new Error(`${label}: tour did not end`);
}

test.describe("tours at 390 px", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("every step of every role tour renders a visible card", async ({ page, browser }) => {
    await login(page, "agencia");
    await skipOnboarding(page);
    await page.goto("/");
    expect(await walkTourOnPhone(page, "agency")).toBeGreaterThan(20);

    const managed = await (await page.request.post("/api/clients", { data: { name: "Tour Celular Gerenciado", channels: ["Instagram"] } })).json();
    const selfServe = await (await page.request.post("/api/clients", { data: { name: "Tour Celular Autônoma", channels: ["Instagram"] } })).json();
    expect((await page.request.post(`/api/clients/${selfServe.id}/mode`, { data: { selfServe: true } })).status()).toBe(200);

    for (const [label, client, path, steps] of [
      ["managed", managed, `/portal/client/${managed.id}`, 4],
      ["brand", selfServe, `/clients/${selfServe.id}`, 5],
    ] as const) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, baseURL: "http://localhost:3200", locale: "pt-BR" });
      const phone = await context.newPage();
      await login(phone, client.login.username, client.login.password);
      await skipOnboarding(phone);
      await phone.goto(path);
      expect(await walkTourOnPhone(phone, label)).toBe(steps);
      await context.close();
    }

    const proContext = await browser.newContext({ viewport: { width: 390, height: 844 }, baseURL: "http://localhost:3200", locale: "pt-BR" });
    const proPage = await proContext.newPage();
    const pro = await signupViaApi(proContext.request, "professional", "Tour Celular Pro", { professionalRole: "designer", location: "Recife, PE" }, "198.51.100.93");
    await skipOnboarding(proPage);
    await proPage.goto(pro.home.replace(/\?.*$/, ""));
    expect(await walkTourOnPhone(proPage, "professional")).toBe(5);
    await proContext.close();
  });
});
