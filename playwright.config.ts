import { defineConfig, devices } from "@playwright/test";

// E2E contra o dev server real com IA mockada (AI_MOCK=1) e banco descartável.
// O banco é apagado NO PRÓPRIO comando do servidor, antes do boot: o Playwright
// sobe o webServer antes do globalSetup, então um wipe no globalSetup apagava
// o arquivo que o servidor já tinha aberto (os dados iam para um inode órfão
// e sumiam no fim da run). DATA_DIR absoluto evita ambiguidade de cwd.
// Contas seed: admin / agencia (senha e2e-pass).
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  workers: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: { baseURL: "http://localhost:3200", trace: "retain-on-failure", screenshot: "only-on-failure", locale: "pt-BR" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command:
      'rm -rf "$PWD/data/e2e" && AI_MOCK=1 DATA_DIR="$PWD/data/e2e" SEED_PASSWORD=e2e-pass BILLING_ENFORCED=false npx next dev -p 3200',
    url: "http://localhost:3200/login",
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
