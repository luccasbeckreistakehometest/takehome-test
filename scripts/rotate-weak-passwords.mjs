#!/usr/bin/env node
// Troca a senha de toda conta (fora o admin e a "agencia") cuja senha ainda é
// uma senha conhecida: SEED_PASSWORD e as senhas listadas em LEGACY_PASSWORDS
// (uma por linha; passe pelo ambiente na hora de rodar — NUNCA grave senhas
// neste arquivo, o repositório é público).
//
// Uso (dentro do container, onde o banco está em DATA_DIR ou /app/data):
//   node scripts/rotate-weak-passwords.mjs                   # só conta (dry-run)
//   node scripts/rotate-weak-passwords.mjs --apply --out /app/data/.rotated.txt
//
// Com --apply, cada conta afetada ganha uma senha provisória aleatória (troca
// obrigatória no próximo login) e todas as sessões dela caem. Usuário e senha
// nova vão SÓ para o arquivo de --out (criado com permissão 600; o script
// recusa sobrescrever). Nada de senha é impresso na tela.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const outIndex = args.indexOf("--out");
const outFile = outIndex >= 0 ? args[outIndex + 1] : null;

const dataDir = process.env.DATA_DIR || (fs.existsSync("/app/data") ? "/app/data" : path.join(process.cwd(), "data"));
const dbPath = path.join(dataDir, "agencyhub.db");
if (!fs.existsSync(dbPath)) {
  console.error(`Banco não encontrado em ${dbPath}`);
  process.exit(1);
}
if (apply && !outFile) {
  console.error("Com --apply, informe --out <arquivo> (as senhas novas vão só para lá).");
  process.exit(1);
}
if (apply && fs.existsSync(outFile)) {
  console.error(`${outFile} já existe; mova ou apague antes de rodar de novo.`);
  process.exit(1);
}

const candidates = [process.env.SEED_PASSWORD ?? "", ...(process.env.LEGACY_PASSWORDS ?? "").split(/\r?\n/)]
  .map((p) => p.trim())
  .filter((p) => p.length > 0);
if (candidates.length === 0) {
  console.error("Nenhuma senha candidata: defina SEED_PASSWORD e/ou LEGACY_PASSWORDS no ambiente.");
  process.exit(1);
}

const KEY_LENGTH = 32;
const scrypt = (password, salt) =>
  new Promise((resolve, reject) =>
    crypto.scrypt(password, salt, KEY_LENGTH, (error, key) => (error ? reject(error) : resolve(key)))
  );

async function matches(password, stored) {
  const [salt, hash] = String(stored ?? "").split(":");
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  if (expected.length !== KEY_LENGTH) return false;
  const candidate = await scrypt(password, salt);
  return crypto.timingSafeEqual(candidate, expected);
}

const ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function randomPassword() {
  const groups = [];
  for (let g = 0; g < 3; g++) {
    let part = "";
    for (let i = 0; i < 4; i++) part += ALPHABET[crypto.randomInt(ALPHABET.length)];
    groups.push(part);
  }
  return groups.join("-");
}

const db = new Database(dbPath);
db.pragma("busy_timeout = 5000");
const columns = db.prepare("PRAGMA table_info(users)").all().map((c) => c.name);
for (const needed of ["sessionVersion", "mustChangePassword", "passwordChangedAt"]) {
  if (!columns.includes(needed)) {
    console.error(`A coluna users.${needed} não existe: suba a versão nova do app uma vez antes de rodar este script.`);
    process.exit(1);
  }
}

const users = db
  .prepare("SELECT id, username, role, passwordHash FROM users WHERE role != 'admin' AND username != 'agencia'")
  .all();

const weak = [];
for (const user of users) {
  for (const candidate of candidates) {
    if (await matches(candidate, user.passwordHash)) {
      weak.push(user);
      break;
    }
  }
}

const byRole = weak.reduce((acc, u) => ({ ...acc, [u.role]: (acc[u.role] ?? 0) + 1 }), {});
console.log(`Contas verificadas: ${users.length}. Com senha conhecida: ${weak.length} ${JSON.stringify(byRole)}.`);
if (!apply) {
  console.log("Dry-run: nada foi alterado. Rode com --apply --out <arquivo> para trocar.");
  process.exit(0);
}

const now = new Date().toISOString();
const lines = [];
const update = db.prepare(
  "UPDATE users SET passwordHash = ?, mustChangePassword = 1, passwordChangedAt = ?, sessionVersion = sessionVersion + 1 WHERE id = ?"
);
const rotated = [];
for (const user of weak) {
  const password = randomPassword();
  const salt = crypto.randomBytes(12).toString("hex");
  const hash = `${salt}:${(await scrypt(password, salt)).toString("hex")}`;
  rotated.push({ id: user.id, hash });
  lines.push(`${user.username}\t${password}`);
}
// Grava o arquivo ANTES de trocar no banco: se a escrita falhar, nada muda.
fs.writeFileSync(outFile, `${lines.join("\n")}\n`, { mode: 0o600, flag: "wx" });
db.transaction(() => {
  for (const row of rotated) update.run(row.hash, now, row.id);
})();
console.log(`Senhas trocadas: ${rotated.length}. Credenciais novas em ${outFile} (permissão 600).`);
