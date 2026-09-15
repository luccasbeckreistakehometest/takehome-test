import { defineConfig, devices } from "@playwright/test";

// E2E contra o dev server real com IA mockada (AI_MOCK=1) e banco descartável
// (DATA_DIR=data/e2e, limpo no global-setup). Contas seed: admin / agencia.
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  workers: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  globalSetup: "./tests/e2e/global-setup.ts",
  use: { baseURL: "http://localhost:3200", trace: "retain-on-failure", screenshot: "only-on-failure", locale: "pt-BR" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "AI_MOCK=1 DATA_DIR=data/e2e SEED_PASSWORD=e2e-pass BILLING_ENFORCED=false npx next dev -p 3200",
    url: "http://localhost:3200/login",
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
