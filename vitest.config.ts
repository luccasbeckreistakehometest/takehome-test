import { defineConfig } from "vitest/config";
import path from "node:path";

// Testes unitários da lógica pura (agregação do relatório, regras de
// aprovação, guardrails do atendente, expiração de proposta, buracos do
// calendário). Nada aqui toca o SQLite nem o Next — só funções puras.
export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: { "@": path.resolve(__dirname) },
  },
});
