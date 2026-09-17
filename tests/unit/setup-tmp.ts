import { afterAll } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

// Cada arquivo de teste com banco cria um DATA_DIR descartável em $TMPDIR.
// Sem isto eles se acumulam (centenas de megabytes depois de algumas rodadas).
// Só apaga o que o próprio teste criou: dentro do temporário do sistema e com
// o prefixo dos nossos testes.
afterAll(() => {
  const dir = process.env.DATA_DIR;
  if (!dir) return;
  const resolved = path.resolve(dir);
  const roots = [os.tmpdir(), fs.realpathSync(os.tmpdir())];
  if (!roots.some((root) => resolved.startsWith(path.resolve(root) + path.sep))) return;
  if (!/^(marqa|agencyhub)-/.test(path.basename(resolved))) return;
  try {
    (globalThis as { __agencyhubDb?: { close?: () => void } }).__agencyhubDb?.close?.();
  } catch {
    /* banco já fechado */
  }
  fs.rmSync(resolved, { recursive: true, force: true });
});
