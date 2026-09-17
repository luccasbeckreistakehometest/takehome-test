import { test, expect } from "@playwright/test";
import { login, seedClientWithDelivery, skipOnboarding } from "./helpers";

test("client pulse: prompt after approval, monthly and NPS in the portal; agency sees trend, risk and the report numbers", async ({ page }) => {
  await login(page, "agencia");
  await skipOnboarding(page);
  const { client, project } = await seedClientWithDelivery(page.request, "Pulseco");
  await page.request.patch(`/api/projects/${project.id}`, { data: { status: "client_approval" } });
  const other = await (await page.request.post("/api/clients", { data: { name: "Riscoco", industry: "moda" } })).json();

  // o cliente aprova no portal e a pergunta "como foi?" aparece na hora
  await login(page, client.login.username, client.login.password);
  await page.goto(`/portal/client/${client.id}`);
  await expect(page.getByTestId("portal-deliverable")).toBeVisible();
  // antes da aprovação só o pulso do mês é devido
  await expect(page.getByTestId("pulse-prompt")).toHaveAttribute("data-kind", "monthly");
  await page.getByTestId("approve-deliverable").click();
  await expect(page.getByTestId("approval-timeline")).toBeVisible();
  const prompt = page.getByTestId("pulse-prompt");
  await expect(prompt).toHaveAttribute("data-kind", "approval");
  await expect(prompt).toContainText("Post do cappuccino");
  await prompt.getByTestId("pulse-face").filter({ hasText: "😀" }).click();
  await prompt.getByTestId("pulse-comment").fill("Ficou lindo, obrigado!");
  await prompt.getByTestId("pulse-send").click();
  // depois vem o pulso do mês…
  await expect(page.getByTestId("pulse-prompt")).toHaveAttribute("data-kind", "monthly");
  await page.getByTestId("pulse-face").filter({ hasText: "😐" }).click();
  await page.getByTestId("pulse-send").click();
  // …e o NPS do trimestre
  await expect(page.getByTestId("pulse-prompt")).toHaveAttribute("data-kind", "nps");
  await page.getByTestId("nps-score").filter({ hasText: /^9$/ }).click();
  await page.getByTestId("pulse-send").click();
  await expect(page.getByTestId("pulse-thanks")).toBeVisible();
  await expect(page.getByTestId("pulse-prompt")).toBeHidden();

  // uma resposta por entrega / mês / trimestre
  const again = await page.request.post(`/api/clients/${client.id}/pulse`, { data: { kind: "monthly", score: 3 } });
  expect(again.status()).toBe(409);
  const badScore = await page.request.post(`/api/clients/${client.id}/pulse`, { data: { kind: "nps", score: 11 } });
  expect(badScore.status()).toBe(400);
  const view = await (await page.request.get(`/api/clients/${client.id}/pulse`)).json();
  expect(view.recent.map((p: { kind: string; score: number }) => `${p.kind}:${p.score}`).sort()).toEqual(["approval:3", "monthly:2", "nps:9"]);
  expect(view.risk.level).toBe("ok");
  expect(view.risk.latestNps).toBe(9);

  // um cliente não responde pelo outro
  const denied = await page.request.post(`/api/clients/${other.id}/pulse`, { data: { kind: "monthly", score: 1 } });
  expect(denied.status()).toBe(403);

  // o segundo cliente responde 😞 → em risco, e a agência é avisada
  await login(page, other.login.username, other.login.password);
  const sad = await page.request.post(`/api/clients/${other.id}/pulse`, { data: { kind: "monthly", score: 1, comment: "Atrasou tudo este mês" } });
  expect(sad.status()).toBe(201);

  // visão da agência: Hoje mostra só quem está em risco; Insights mostra todos
  await login(page, "agencia");
  const overview = await (await page.request.get("/api/pulse/overview")).json();
  const risky = overview.atRisk.find((c: { id: string }) => c.id === other.id);
  expect(risky.risk.level).toBe("risk");
  expect(risky.risk.flags[0].reason).toBe("unhappy_recent");
  expect(overview.atRisk.some((c: { id: string }) => c.id === client.id)).toBe(false);
  await page.goto("/");
  const home = page.getByTestId("pulse-overview");
  await expect(home).toHaveAttribute("data-mode", "home");
  await expect(home.getByTestId("pulse-row").filter({ hasText: "Riscoco" })).toHaveAttribute("data-level", "risk");
  await expect(home.getByTestId("pulse-row").filter({ hasText: "Pulseco" })).toHaveCount(0);
  const activities = await (await page.request.get("/api/activities?audience=agency")).json();
  expect(activities.some((a: { text: string }) => a.text.includes("Riscoco respondeu 😞"))).toBe(true);
  await page.goto("/insights");
  const full = page.getByTestId("pulse-overview");
  await expect(full.getByTestId("pulse-row").filter({ hasText: "Pulseco" })).toHaveAttribute("data-level", "ok");
  await expect(full.getByTestId("pulse-row").filter({ hasText: "Pulseco" })).toContainText("NPS 9");

  // dentro do cliente e no relatório mensal
  await page.goto(`/clients/${client.id}`);
  await expect(page.getByTestId("client-pulse-latest")).toHaveText("😐");
  await expect(page.getByTestId("client-pulse")).toContainText("Ficou lindo");
  const month = new Date().toISOString().slice(0, 7);
  const report = await (await page.request.get(`/api/clients/${client.id}/report?month=${month}`)).json();
  expect(report.data.satisfaction).toMatchObject({ hasData: true, responses: 2, happy: 1, neutral: 1, sad: 0 });
  expect(report.data.satisfaction.nps.score).toBe(100);
  await page.goto(`/clients/${client.id}/report`);
  await expect(page.getByTestId("report-satisfaction")).toContainText("Ficou lindo");
});
