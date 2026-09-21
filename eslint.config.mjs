import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Artefatos GERADOS (todos já no .gitignore). O relatório HTML do
    // Playwright sozinho traz ~2.600 problemas de um bundle minificado e
    // esconde a linha de base real do código-fonte.
    "playwright-report/**",
    "test-results/**",
    "data/**",
  ]),
]);

export default eslintConfig;
