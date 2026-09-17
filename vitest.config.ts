import { defineConfig } from "vitest/config";
import path from "node:path";

// Testes unitários da lógica pura (agregação do relatório, regras de
// aprovação, guardrails do atendente, expiração de proposta, buracos do
// calendário). Nada aqui toca o SQLite nem o Next — só funções puras.
export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    // apaga o DATA_DIR temporário de cada arquivo no fim
    setupFiles: ["tests/unit/setup-tmp.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname) },
  },
});
