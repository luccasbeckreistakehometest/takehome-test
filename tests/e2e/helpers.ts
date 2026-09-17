import { expect, type APIRequestContext, type Page } from "@playwright/test";

export async function login(page: Page, username: string, password = "e2e-pass") {
  await page.goto("/login");
  await page.getByLabel("Usuário ou e-mail").fill(username);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
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


export const E2E_META_APP_SECRET = "e2e-meta-app-secret";

let signupSeq = 0;
/** Cadastro pela API (o navegador guarda o cookie da sessão nova). */
export async function signupViaApi(
  request: APIRequestContext,
  role: "client" | "professional",
  name: string,
  extra: Record<string, unknown> = {}
) {
  signupSeq += 1;
  const email = `${name.toLowerCase().replace(/[^a-z0-9]+/g, ".")}.${Date.now()}.${signupSeq}@example.com`;
  const response = await request.post("/api/auth/register", {
    data: { role, name, email, password: "senha-forte-123", acceptTerms: true, ...extra },
  });
  expect(response.status(), await response.text()).toBe(201);
  return { ...(await response.json()), email, password: "senha-forte-123" } as {
    home: string;
    username: string;
    role: string;
    email: string;
    password: string;
  };
}

/** Id do usuário pelo username (via API do admin, com a sessão do admin). */
export async function adminUserId(request: APIRequestContext, username: string): Promise<string> {
  const { users } = (await (await request.get("/api/admin/users")).json()) as { users: { id: string; username: string }[] };
  const found = users.find((u) => u.username === username);
  if (!found) throw new Error(`usuário ${username} não encontrado`);
  return found.id;
}
