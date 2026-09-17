import { test, expect } from "@playwright/test";
import { login, skipOnboarding } from "./helpers";
import { readPng } from "./png";
import { readZip } from "../../lib/zip";

const hexToRgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

// Carrossel pronto (IA em modo de teste): 6 slides 1080×1350 na cor da marca,
// editar um slide muda só aquele, ZIP com as imagens + legenda, 3 coins por
// geração e zero no cache e nas re-renderizações.
test("carousel: generate, render in the brand colour, edit one slide, zip, schedule", async ({ page, browser }) => {
  await login(page, "agencia");
  await skipOnboarding(page);
  const client = await (
    await page.request.post("/api/clients", { data: { name: "Carrossel Café", brandColors: "verde #1a7f5a e creme", channels: ["Instagram"] } })
  ).json();
  const coins = async () => (await (await page.request.get("/api/billing")).json()).wallet.coins as number;

  const before = await coins();
  await page.goto(`/clients/${client.id}?tab=carousels`);
  await expect(page.getByTestId("carousel-empty")).toBeVisible();
  await page.getByTestId("carousel-topic").fill("5 erros ao escolher café especial");
  await page.getByTestId("carousel-generate").click();
  await expect(page.getByTestId("carousel-slide")).toHaveCount(6);
  expect(await coins()).toBe(before - 3);

  const list = await (await page.request.get(`/api/clients/${client.id}/carousels`)).json();
  const carousel = list.carousels[0];
  expect(list.palette.primary).toBe("#1a7f5a");
  expect(carousel.content.slides).toHaveLength(6);

  // mesmo pedido de novo: vem do cache, sem cobrar
  const again = await page.request.post(`/api/clients/${client.id}/carousels`, { data: { mode: "ai", topic: "5 erros ao escolher café especial", goal: "", count: 6 } });
  expect(again.status()).toBe(201);
  expect((await again.json()).charged).toBe(false);
  expect(await coins()).toBe(before - 3);

  // modelo "bold": fundo na cor principal da marca
  await page.request.patch(`/api/carousels/${carousel.id}`, { data: { template: "bold" } });
  const slide = await page.request.get(`/api/carousels/${carousel.id}/slide/0`);
  expect(slide.headers()["content-type"]).toBe("image/png");
  const png = readPng(Buffer.from(await slide.body()));
  expect([png.width, png.height]).toEqual([1080, 1350]);
  const [r, g, b] = png.pixel(20, 20);
  const [er, eg, eb] = hexToRgb("#1a7f5a");
  expect(Math.abs(r - er) + Math.abs(g - eg) + Math.abs(b - eb)).toBeLessThan(12);

  // editar o slide 3 pela tela: só o hash dele muda
  await page.reload();
  await page.getByTestId("carousel-tab").waitFor();
  const hashesBefore = await page.getByTestId("carousel-slide").evaluateAll((els) => els.map((e) => e.getAttribute("data-hash")));
  await page.getByTestId("slide-title").nth(2).fill("Torra escura não é sinônimo de qualidade");
  await page.getByTestId("carousel-save").click();
  await expect(page.getByTestId("carousel-slide").nth(2)).not.toHaveAttribute("data-hash", hashesBefore[2]!);
  const hashesAfter = await page.getByTestId("carousel-slide").evaluateAll((els) => els.map((e) => e.getAttribute("data-hash")));
  expect(hashesAfter.filter((h, i) => h !== hashesBefore[i])).toHaveLength(1);
  expect(await coins()).toBe(before - 3);

  // ZIP: 6 PNGs + legenda.txt
  const zip = await page.request.get(`/api/carousels/${carousel.id}/zip`);
  expect(zip.headers()["content-type"]).toBe("application/zip");
  const entries = readZip(Buffer.from(await zip.body()));
  expect(entries.filter((e) => e.name.endsWith(".png"))).toHaveLength(6);
  expect(entries.some((e) => e.name === "legenda.txt")).toBe(true);
  expect(entries.every((e) => e.crcOk)).toBe(true);

  // para o calendário, com as imagens em endereço público assinado
  await page.getByTestId("carousel-schedule").click();
  await expect(page.getByTestId("carousel-scheduled")).toBeVisible();
  const posts = await (await page.request.get(`/api/scheduled-posts?clientId=${client.id}`)).json();
  const post = posts.find((p: { format: string }) => p.format === "Carrossel");
  expect(post.status).toBe("draft");
  const media = JSON.parse(post.mediaJson) as string[];
  expect(media).toHaveLength(6);
  const guest = await browser.newContext();
  const publicPath = new URL(media[0]).pathname + new URL(media[0]).search;
  const publicSlide = await guest.request.get(publicPath);
  expect(publicSlide.status()).toBe(200);
  expect((await guest.request.get(publicPath.replace(/sig=[^&]+/, "sig=forjada"))).status()).toBe(404);
  expect((await guest.request.get(`/api/carousels/${carousel.id}/slide/0`)).status()).toBe(401);
  await guest.close();

  // sem IA: escrito à mão, sem custo
  const manual = await page.request.post(`/api/clients/${client.id}/carousels`, { data: { mode: "manual", topic: "Cardápio de inverno", count: 5 } });
  expect(manual.status()).toBe(201);
  expect((await manual.json()).charged).toBe(false);
  expect(await coins()).toBe(before - 3);

  // outro cliente não abre as imagens deste
  const other = await (await page.request.post("/api/clients", { data: { name: "Outro Carrossel", channels: [] } })).json();
  const otherCtx = await browser.newContext();
  const otherPage = await otherCtx.newPage();
  await login(otherPage, other.login.username, other.login.password);
  expect([403, 404]).toContain((await otherPage.request.get(`/api/carousels/${carousel.id}/slide/0`)).status());
  expect([403, 404]).toContain((await otherPage.request.get(`/api/carousels/${carousel.id}/zip`)).status());
  await otherCtx.close();
});

// Logo em WebP (o renderizador só lê PNG/JPEG): o slide sai com a inicial da
// marca em vez de quebrar, e o ZIP também.
test("carousel renders when the brand logo is WebP", async ({ page }) => {
  await login(page, "agencia");
  await skipOnboarding(page);
  const client = await (await page.request.post("/api/clients", { data: { name: "Logo Webp", channels: ["Instagram"] } })).json();
  const webp = Buffer.from("UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==", "base64");
  const upload = await page.request.post(`/api/clients/${client.id}/assets`, {
    multipart: { kind: "brand", file: { name: "logo.webp", mimeType: "image/webp", buffer: webp } },
  });
  expect(upload.status()).toBe(201);
  expect((await upload.json()).mime).toBe("image/webp");
  const created = await page.request.post(`/api/clients/${client.id}/carousels`, { data: { mode: "manual", topic: "Logo em webp", count: 5 } });
  expect(created.status()).toBe(201);
  const { carousels } = await (await page.request.get(`/api/clients/${client.id}/carousels`)).json();
  const slide = await page.request.get(`/api/carousels/${carousels[0].id}/slide/0`);
  expect(slide.status()).toBe(200);
  expect(readPng(Buffer.from(await slide.body())).width).toBe(1080);
  const zip = await page.request.get(`/api/carousels/${carousels[0].id}/zip`);
  expect(zip.status()).toBe(200);
});
