import { test, expect } from "@playwright/test";
import { login, seedClientWithDelivery, skipOnboarding } from "./helpers";

test("public agency page: settings → live page with portfolio, clients and testimonials → lead becomes a prospect", async ({ page }) => {
  await login(page, "agencia");
  await skipOnboarding(page);
  const { client, deliverable } = await seedClientWithDelivery(page.request, "Padaria Vitrine");
  const privateId = await seedPrivateDelivery(page, client.id);

  await page.goto("/settings");
  const card = page.getByTestId("agency-page-card");
  await expect(card).toBeVisible();
  await card.getByTestId("page-slug").fill("Estúdio Sol");
  await card.getByTestId("page-published").check();
  await card.getByTestId("page-headline").fill("Marketing que vende para negócios de bairro");
  await card.getByTestId("page-about").fill("Somos uma agência enxuta que cuida de tudo: conteúdo, tráfego e WhatsApp.");
  await card.getByTestId("page-services").fill("Gestão de redes sociais\nTráfego pago\nAtendimento por WhatsApp com IA");
  await card.getByTestId("testimonial-add").click();
  await card.getByTestId("testimonial-author").fill("Dona Sol");
  await card.getByTestId("testimonial-text").fill("Dobraram o movimento da padaria em dois meses.");
  await card.getByRole("checkbox", { name: "Post do cappuccino · Padaria Vitrine" }).check();
  await card.getByTestId("showcase-option").filter({ hasText: "Padaria Vitrine" }).getByRole("checkbox").check();
  await card.getByTestId("page-save").click();
  await expect(card.getByText("Aplicado ✓")).toBeVisible();
  await expect(card.getByTestId("page-url")).toContainText("/a/estudio-sol");

  // sem login: a página está no ar com tudo o que foi configurado
  await page.context().clearCookies();
  await page.goto("/a/estudio-sol");
  await expect(page.getByTestId("agency-page")).toBeVisible();
  await expect(page.getByTestId("agency-headline")).toHaveText("Marketing que vende para negócios de bairro");
  await expect(page.getByTestId("agency-services")).toContainText("Tráfego pago");
  await expect(page.getByTestId("agency-testimonials")).toContainText("Dona Sol");
  await expect(page.getByTestId("agency-client")).toContainText("Padaria Vitrine");
  const image = page.getByTestId("portfolio-item").locator("img");
  await expect(image).toHaveAttribute("src", `/api/a/estudio-sol/work/${deliverable.id}`);
  const img = await page.request.get(`/api/a/estudio-sol/work/${deliverable.id}`);
  expect(img.status()).toBe(200);
  expect(img.headers()["content-type"]).toBe("image/png");
  // uma entrega não marcada como pública continua privada
  expect((await page.request.get(`/api/a/estudio-sol/work/${privateId}`)).status()).toBe(404);
  await expect(page).toHaveTitle(/Marketing que vende/);
  const og = await page.request.get("/a/estudio-sol/opengraph-image");
  expect(og.status()).toBe(200);
  expect(og.headers()["content-type"]).toContain("image/png");

  // o formulário vira prospect + contato e avisa a agência
  await page.getByTestId("lead-name").fill("Seu Zé da Esquina");
  await page.getByTestId("lead-whatsapp").fill("(41) 99999-1234");
  await page.getByTestId("lead-need").fill("Quero posts para a minha loja de bairro");
  await page.getByTestId("lead-budget").selectOption("1k-3k");
  await page.getByTestId("lead-submit").click();
  await expect(page.getByTestId("lead-sent")).toBeVisible();

  // honeypot preenchido: finge sucesso, não grava nada
  const bot = await page.request.post("/api/a/estudio-sol/lead", {
    data: { name: "Bot Bot", whatsapp: "41999990000", need: "spam spam spam", budgetBand: "nao-sei", website: "http://spam" },
  });
  expect(bot.status()).toBe(200);
  // limite por IP: 5 por hora (o lead real + o honeypot já contaram 2)
  for (let i = 0; i < 3; i++) {
    const ok = await page.request.post("/api/a/estudio-sol/lead", {
      data: { name: `Lead ${i}`, whatsapp: "4199999000" + i, need: "preciso de tráfego pago", budgetBand: "3k-10k" },
    });
    expect(ok.status()).toBe(201);
  }
  const limited = await page.request.post("/api/a/estudio-sol/lead", {
    data: { name: "Lead 9", whatsapp: "41999990009", need: "preciso de tráfego pago", budgetBand: "3k-10k" },
  });
  expect(limited.status()).toBe(429);
  expect(Number(limited.headers()["retry-after"])).toBeGreaterThan(0);
  // validação do formulário
  const bad = await page.request.post("/api/a/estudio-sol/lead", { data: { name: "X", whatsapp: "1", need: "", budgetBand: "" } });
  expect([400, 429]).toContain(bad.status());
  // slug inexistente / página despublicada = 404
  await page.goto("/a/nao-existe");
  await expect(page.getByTestId("agency-page-404")).toBeVisible();
  expect((await page.request.post("/api/a/nao-existe/lead", { data: {} })).status()).toBe(404);

  await login(page, "agencia");
  const prospects = await (await page.request.get("/api/prospects")).json();
  const lead = prospects.prospects.find((p: { name: string }) => p.name === "Seu Zé da Esquina");
  expect(lead).toBeTruthy();
  expect(lead.status).toBe("new");
  expect(lead.whyFit).toContain("Quero posts");
  expect(lead.suggestedApproach).toContain("+41999991234");
  expect(prospects.prospects.some((p: { name: string }) => p.name === "Bot Bot")).toBe(false);
  const activities = await (await page.request.get("/api/activities?audience=agency")).json();
  expect(activities.some((a: { text: string }) => a.text.includes("Novo lead pela página pública: Seu Zé da Esquina"))).toBe(true);
  const contacts = await (await page.request.get("/api/messaging/contacts")).json();
  const list = Array.isArray(contacts) ? contacts : contacts.contacts;
  expect(list.some((c: { phone: string }) => c.phone === "41999991234")).toBe(true);
  const view = await (await page.request.get("/api/agency-page")).json();
  expect(view.leads.length).toBe(4);
  expect(view.leads.some((l: { name: string }) => l.name === "Seu Zé da Esquina")).toBe(true);
  await page.goto("/prospecting");
  await expect(page.getByText("Lead da página pública").first()).toBeVisible();

  // despublicar tira a página do ar
  await page.request.put("/api/agency-page", { data: { config: { published: false } } });
  await page.context().clearCookies();
  await page.goto("/a/estudio-sol");
  await expect(page.getByTestId("agency-page-404")).toBeVisible();
});

// Segunda entrega (não marcada como pública) do mesmo cliente, via API.
async function seedPrivateDelivery(page: import("@playwright/test").Page, clientId: string): Promise<string> {
  const project = await (
    await page.request.post("/api/projects", {
      data: { clientId, title: "Outra demanda", brief: "x", skillsNeeded: [], location: "", budget: "", deadline: "", mode: "internal" },
    })
  ).json();
  const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
  const deliverable = await (
    await page.request.post(`/api/projects/${project.id}/deliverables`, {
      multipart: { title: "Privada", file: { name: "p.png", mimeType: "image/png", buffer: PNG } },
    })
  ).json();
  return deliverable.id as string;
}
