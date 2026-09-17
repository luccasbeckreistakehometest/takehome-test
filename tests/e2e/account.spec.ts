import { test, expect } from "@playwright/test";
import { adminUserId, login, signupViaApi } from "./helpers";

test("brand signup shows the username, logs in by e-mail, changes password and revokes other sessions", async ({ page, browser }) => {
  await page.goto("/criar-conta?type=client");
  await page.getByTestId("reg-name").fill("Doceria Aurora");
  const email = `doceria.${Date.now()}@example.com`;
  await page.getByTestId("reg-email").fill(email);
  await page.getByTestId("reg-password").fill("senha-da-doceria");
  // sem aceitar os termos o botão fica desabilitado
  await expect(page.getByTestId("reg-submit")).toBeDisabled();
  await page.getByTestId("reg-terms").check();
  await page.getByTestId("reg-submit").click();
  await expect(page).toHaveURL(/\/portal\/client\/[^/?]+\?welcome=1&choose=1/, { timeout: 20_000 });
  await expect(page.getByTestId("welcome-username")).toContainText("doceria.aurora");

  // logout pelo menu da conta
  await page.goto("/conta");
  await page.getByTestId("user-menu").click();
  await page.getByTestId("logout").click();
  await expect(page).toHaveURL(/\/login/);

  // entra com o e-mail em dois "aparelhos"
  await login(page, email, "senha-da-doceria");
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await login(otherPage, "doceria.aurora", "senha-da-doceria");
  expect((await other.request.get("/api/account")).status()).toBe(200);

  // troca de senha: este aparelho continua, o outro cai
  await page.goto("/conta");
  await page.getByLabel("Senha atual").fill("senha-da-doceria");
  await page.getByLabel("Nova senha", { exact: true }).fill("nova-senha-da-doceria");
  await page.getByLabel("Repita a nova senha").fill("nova-senha-da-doceria");
  await page.getByTestId("pw-save").click();
  await expect(page.getByText("Senha trocada.")).toBeVisible();
  expect((await page.request.get("/api/account")).status()).toBe(200);
  expect((await other.request.get("/api/account")).status()).toBe(401);
  await other.close();

  // senha antiga não entra mais; a nova entra
  const oldLogin = await page.request.post("/api/auth/login", { data: { username: email, password: "senha-da-doceria" } });
  expect(oldLogin.status()).toBe(401);

  // baixar meus dados
  const exported = await page.request.get("/api/account/export");
  expect(exported.status()).toBe(200);
  expect(exported.headers()["content-disposition"]).toContain("attachment");
  const data = await exported.json();
  expect(data.account.email).toBe(email);
  expect(JSON.stringify(data)).not.toContain("passwordHash\":\"");

  // excluir a conta (pede EXCLUIR + senha)
  expect((await page.request.delete("/api/account", { data: { confirm: "EXCLUIR", password: "errada" } })).status()).toBe(403);
  const removed = await page.request.delete("/api/account", { data: { confirm: "EXCLUIR", password: "nova-senha-da-doceria" } });
  expect(removed.status()).toBe(200);
  expect((await removed.json()).removedWorkspace).toBe(true);
  expect((await page.request.get("/api/account")).status()).toBe(401);
  const gone = await page.request.post("/api/auth/login", { data: { username: email, password: "nova-senha-da-doceria" } });
  expect(gone.status()).toBe(401);
});

test("'sair de todos os dispositivos' revokes every session", async ({ page, browser }) => {
  const account = await signupViaApi(page.request, "professional", "Fotógrafa Sessões");
  const other = await browser.newContext();
  await login(await other.newPage(), account.email, account.password);
  await page.goto("/conta");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByTestId("logout-all").click();
  await expect(page).toHaveURL(/\/login/);
  expect((await other.request.get("/api/account")).status()).toBe(401);
  await other.close();
});

test("signup requires e-mail, consent and a real password; duplicate e-mails are refused", async ({ request }) => {
  const base = { role: "client", name: "Marca Sem Aceite", password: "senha-forte-123" };
  const noEmail = await request.post("/api/auth/register", { data: { ...base, acceptTerms: true } });
  expect(noEmail.status()).toBe(400);
  const noConsent = await request.post("/api/auth/register", { data: { ...base, email: "sem.aceite@example.com" } });
  expect(noConsent.status()).toBe(400);
  const weak = await request.post("/api/auth/register", {
    data: { ...base, email: "fraca@example.com", password: "1234", acceptTerms: true },
  });
  expect(weak.status()).toBe(400);
  const first = await request.post("/api/auth/register", {
    data: { ...base, email: "unica@example.com", acceptTerms: true },
  });
  expect(first.status()).toBe(201);
  const dup = await request.post("/api/auth/register", {
    data: { ...base, name: "Outra", email: "UNICA@example.com", acceptTerms: true },
  });
  expect(dup.status()).toBe(409);
  // honeypot
  const bot = await request.post("/api/auth/register", {
    data: { ...base, email: "robo@example.com", acceptTerms: true, website: "http://spam" },
  });
  expect(bot.status()).toBe(400);
});

test("agency signup is open (access page redirects to it); access requests still reach the admin inbox", async ({ page }) => {
  await page.goto("/pedir-acesso");
  await expect(page).toHaveURL(/\/criar-conta\?type=agency$/);
  await expect(page.getByTestId("reg-name")).toBeVisible();
  // o formulário de pedido de acesso (usado quando AGENCY_SELF_SIGNUP=false) continua chegando ao admin
  const sent = await page.request.post("/api/contact", {
    data: {
      kind: "access_request",
      name: "Rita Agência",
      email: "rita@agencia-nova.example.com",
      company: "Agência Nova",
      message: "Atendemos 12 clientes de varejo e queremos organizar a produção.",
    },
    headers: { "x-forwarded-for": "198.51.100.77" },
  });
  expect(sent.status()).toBe(201);

  await login(page, "admin");
  await page.goto("/admin");
  await page.getByTestId("admin-tab-inbox").click();
  const inbox = page.getByTestId("admin-inbox");
  await expect(inbox).toContainText("Rita Agência");
  await expect(inbox).toContainText("pedido de acesso");
  await inbox.getByLabel("Status da mensagem de Rita Agência").selectOption("done");
  await expect(inbox.getByLabel("Status da mensagem de Rita Agência")).toHaveValue("done");
});

test("login is rate-limited per account and disabled accounts cannot sign in", async ({ page }) => {
  const target = `ninguem.${Date.now()}`;
  let last = 0;
  for (let i = 0; i < 9; i++) {
    last = (await page.request.post("/api/auth/login", { data: { username: target, password: "errada-123" } })).status();
  }
  expect(last).toBe(429);

  const account = await signupViaApi(page.request, "professional", "Conta Desativada");
  await page.context().clearCookies();
  await login(page, "admin");
  const id = await adminUserId(page.request, account.username);
  expect((await page.request.post(`/api/admin/users/${id}`, { data: { action: "disable" } })).status()).toBe(200);
  const denied = await page.request.post("/api/auth/login", { data: { username: account.email, password: account.password } });
  expect(denied.status()).toBe(403);
  // admin redefine a senha: senha provisória mostrada uma vez e troca obrigatória
  await page.request.post(`/api/admin/users/${id}`, { data: { action: "enable" } });
  const reset = await (await page.request.post(`/api/admin/users/${id}`, { data: { action: "reset_password" } })).json();
  expect(reset.password).toMatch(/^[A-Za-z2-9]{4}-[A-Za-z2-9]{4}-[A-Za-z2-9]{4}$/);
  const fresh = await page.request.post("/api/auth/login", { data: { username: account.username, password: reset.password } });
  expect(fresh.status()).toBe(200);
  expect((await fresh.json()).home).toBe("/conta?trocar=1");
});

test("contact form stores the message, is rate-limited per IP and ignores bots", async ({ request }) => {
  const ip = `198.51.100.${Math.floor(Math.random() * 200) + 20}`;
  const message = { name: "Carla", email: "carla@example.com", topic: "pagamento", message: "Paguei e o plano não apareceu ainda." };
  const first = await request.post("/api/contact", { data: message, headers: { "x-forwarded-for": ip } });
  expect(first.status()).toBe(201);
  const bot = await request.post("/api/contact", { data: { ...message, fax: "123" }, headers: { "x-forwarded-for": `${ip}1` } });
  expect(bot.status()).toBe(201); // finge sucesso
  let status = 0;
  for (let i = 0; i < 5; i++) {
    status = (await request.post("/api/contact", { data: message, headers: { "x-forwarded-for": ip } })).status();
  }
  expect(status).toBe(429);
  const invalid = await request.post("/api/contact", { data: { ...message, email: "x" }, headers: { "x-forwarded-for": "203.0.113.77" } });
  expect(invalid.status()).toBe(400);
});
