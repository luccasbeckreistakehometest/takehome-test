import { test, expect } from "@playwright/test";
import { login, skipOnboarding } from "./helpers";

function localKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

test("content calendar: posts per day, gaps hint, status change without dragging, quick add", async ({ page }) => {
  await login(page, "agencia");
  await skipOnboarding(page);
  const client = await (await page.request.post("/api/clients", { data: { name: "Calendarco", industry: "moda" } })).json();
  const today = new Date();
  const inTwoDays = new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000);
  const draft = await (
    await page.request.post("/api/scheduled-posts", {
      data: { clientId: client.id, title: "Reels bastidores", channel: "Instagram", caption: "", hashtags: [], scheduledFor: `${localKey(inTwoDays)}T10:00`, status: "draft" },
    })
  ).json();

  await page.goto("/calendar");
  await expect(page.getByTestId("calendar-page")).toBeVisible();
  await page.getByTestId("calendar-client").selectOption(client.id);
  const chip = page.getByTestId("calendar-post").filter({ hasText: "Reels bastidores" });
  await expect(chip).toHaveAttribute("data-status", "draft");
  // buracos: o mês tem dias futuros sem conteúdo
  await expect(page.getByTestId("calendar-gaps")).toBeVisible();
  const gapCount = Number(await page.getByTestId("gap-count").innerText());
  expect(gapCount).toBeGreaterThan(0);

  // rascunho → agendado sem arrastar
  await chip.click();
  await expect(page.getByTestId("post-panel")).toBeVisible();
  await page.getByTestId("post-schedule").click();
  await expect(page.getByTestId("calendar-post").filter({ hasText: "Reels bastidores" })).toHaveAttribute("data-status", "scheduled");
  await page.getByTestId("post-publish").click();
  await expect(page.getByTestId("calendar-post").filter({ hasText: "Reels bastidores" })).toHaveAttribute("data-status", "published");
  const updated = await (await page.request.get(`/api/scheduled-posts?clientId=${client.id}`)).json();
  expect(updated.find((p: { id: string }) => p.id === draft.id).status).toBe("published");
  await page.getByTestId("post-close").click();
  await expect(page.getByTestId("post-panel")).toBeHidden();

  // novo post pelo calendário preenche um buraco
  await page.getByTestId("calendar-add").click();
  await page.getByTestId("quick-client").selectOption(client.id);
  await page.getByTestId("quick-title").fill("Post do gap");
  await page.getByTestId("quick-save").click();
  await expect(page.getByTestId("calendar-post").filter({ hasText: "Post do gap" })).toBeVisible();
  expect(Number(await page.getByTestId("gap-count").innerText())).toBeLessThanOrEqual(gapCount);

  // visão semanal mostra a semana atual
  await page.getByTestId("view-week").click();
  await expect(page.getByTestId("calendar-day")).toHaveCount(7);
});
