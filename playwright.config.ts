import { defineConfig, devices } from "@playwright/test";

// E2E contra o build de produção (next start) com IA mockada (AI_MOCK=1) e
// banco descartável — o next dev consumia memória demais nesta máquina.
// O banco é apagado NO PRÓPRIO comando do servidor, antes do boot: o Playwright
// sobe o webServer antes do globalSetup, então um wipe no globalSetup apagava
// o arquivo que o servidor já tinha aberto (os dados iam para um inode órfão
// e sumiam no fim da run). DATA_DIR absoluto evita ambiguidade de cwd.
// Contas seed: admin / agencia (senha e2e-pass).
//
// Projetos (rodam em série, 1 worker):
//  - chromium: a suíte inteira, cobrança desligada;
//  - enforce-on → enforced → enforce-off: liga o bloqueio por saldo (a mesma
//    checagem de BILLING_ENFORCED=true), dá o plano da agência pelo admin e roda
//    as specs de IA de novo + a de cobrança; depois desliga;
//  - mobile: largura de celular, nenhuma tela principal com rolagem lateral.
// Limites de login/cadastro/IA ficam altos aqui (todos os testes saem do mesmo
// IP); as specs de limite usam X-Forwarded-For próprio ou contas próprias.
const AI_SPECS = [
  "report.spec.ts",
  "campaign.spec.ts",
  "brand-voice.spec.ts",
  "learnings.spec.ts",
  "voice.spec.ts",
];

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  workers: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: { baseURL: "http://localhost:3200", trace: "retain-on-failure", screenshot: "only-on-failure", locale: "pt-BR" },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: [/enforce\.(setup|teardown)\.ts/, /billing-enforced\.spec\.ts/, /mobile\.spec\.ts/],
    },
    {
      name: "enforce-on",
      testMatch: /enforce\.setup\.ts/,
      teardown: "enforce-off",
      dependencies: ["chromium"],
      use: { ...devices["Desktop Chrome"] },
    },
    { name: "enforce-off", testMatch: /enforce\.teardown\.ts/, use: { ...devices["Desktop Chrome"] } },
    {
      name: "enforced",
      dependencies: ["enforce-on"],
      testMatch: [/billing-enforced\.spec\.ts/, ...AI_SPECS.map((file) => new RegExp(file.replace(".", "\\.")))],
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile",
      dependencies: ["enforced"],
      testMatch: /mobile\.spec\.ts/,
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: {
    // build de produção + next start (ver scripts/e2e-server.sh)
    command: "sh scripts/e2e-server.sh",
    url: "http://localhost:3200/api/health",
    reuseExistingServer: false,
    timeout: 900_000,
  },
});
