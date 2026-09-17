import { expect, type APIRequestContext, type Page } from "@playwright/test";

export async function login(page: Page, username: string, password = "e2e-pass") {
  await page.goto("/login");
  await page.getByPlaceholder("ex.: agencia").fill(username);
  await page.getByPlaceholder("••••••••").fill(password);
  await page.getByRole("button", { name: /entrar/i }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

/** Marca o tour como concluído para specs que não são sobre ele. */
export async function skipOnboarding(page: Page) {
  await page.request.post("/api/onboarding", { data: { completed: true, event: "e2e_skip" } });
}

// 1x1 PNG — o upload de entrega exige imagem
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
);

/** Cliente + demanda interna + 1 entrega (imagem) via API — base das specs de relatório/aprovação. */
export async function seedClientWithDelivery(request: APIRequestContext, name: string) {
  const client = await (
    await request.post("/api/clients", {
      data: { name, industry: "cafeteria", description: "Café de bairro", channels: ["Instagram"], country: "Brasil" },
    })
  ).json();
  const project = await (
    await request.post("/api/projects", {
      data: { clientId: client.id, title: "Posts do feed", brief: "3 posts para o Instagram", skillsNeeded: ["Social media design"], location: "", budget: "", deadline: "", mode: "internal" },
    })
  ).json();
  const deliverable = await (
    await request.post(`/api/projects/${project.id}/deliverables`, {
      multipart: { title: "Post do cappuccino", file: { name: "post.png", mimeType: "image/png", buffer: PNG } },
    })
  ).json();
  return { client, project, deliverable };
}

