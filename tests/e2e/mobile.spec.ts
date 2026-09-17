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
