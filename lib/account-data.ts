import { db, getClient } from "./db";
import { getUserById, type User } from "./auth";
import { getProfessional } from "./marketplace-db";
import { anonymiseBillingAccount, exportBillingAccount } from "./billing-db";
import { anonymiseAiUsage } from "./ai-spend";
import { anonymiseInboxForUser, listInboxForUser } from "./contact-db";
import { deleteGenericUpload, deleteUpload } from "./uploads";
import type { AccountType } from "./plans";

// LGPD self-service: "baixar meus dados" (JSON) e "excluir minha conta".
// Tabelas são descobertas pelo esquema (qualquer tabela com clientId /
// professionalId / userId entra), para nenhuma feature nova ficar de fora.

const BILLING_TABLES = new Set(["billing_transactions", "mp_payments", "wallets", "subscriptions", "ai_usage", "ai_errors"]);
const SENSITIVE_COLUMNS = new Set(["passwordHash", "accessToken", "refreshToken", "oauthClientSecret", "token"]);

function tablesWithColumn(column: string): { table: string; notNull: boolean }[] {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all() as {
    name: string;
  }[];
  const out: { table: string; notNull: boolean }[] = [];
  for (const { name } of tables) {
    if (BILLING_TABLES.has(name)) continue;
    const col = (db.prepare(`PRAGMA table_info(${name})`).all() as { name: string; notnull: number }[]).find(
      (c) => c.name === column
    );
    if (col) out.push({ table: name, notNull: col.notnull === 1 });
  }
  return out;
}

function scrub(row: Record<string, unknown>): Record<string, unknown> {
  const copy: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) copy[key] = SENSITIVE_COLUMNS.has(key) ? "[oculto]" : value;
  return copy;
}

function rowsBy(column: string, value: string, skip: string[] = []): Record<string, Record<string, unknown>[]> {
  const out: Record<string, Record<string, unknown>[]> = {};
  for (const { table } of tablesWithColumn(column)) {
    if (skip.includes(table)) continue;
    const rows = db.prepare(`SELECT * FROM ${table} WHERE ${column} = ? LIMIT 5000`).all(value) as Record<string, unknown>[];
    if (rows.length) out[table] = rows.map(scrub);
  }
  return out;
}

function accountFor(user: Pick<User, "role" | "refId">): { accountType: AccountType; accountId: string } | null {
  if (user.role === "agency") return { accountType: "agency", accountId: "agency" };
  if ((user.role === "client" || user.role === "professional") && user.refId) {
    return { accountType: user.role, accountId: user.refId };
  }
  return null;
}

export function exportAccountData(userId: string) {
  const user = getUserById(userId);
  if (!user) return null;
  const data: Record<string, unknown> = {
    exportedAt: new Date().toISOString(),
    format: "Marqa — exportação de dados pessoais (LGPD art. 18)",
    account: {
      username: user.username,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      consentAt: user.consentAt,
      consentVersion: user.consentVersion,
    },
    activity: rowsBy("userId", userId, ["users"]),
    contactMessages: listInboxForUser(userId),
  };
  if (user.role === "client" && user.refId) {
    data.brand = getClient(user.refId);
    data.brandData = rowsBy("clientId", user.refId, ["clients"]);
  }
  if (user.role === "professional" && user.refId) {
    data.professional = getProfessional(user.refId);
    data.professionalData = rowsBy("professionalId", user.refId, ["professionals"]);
  }
  const account = user.role === "agency" ? null : accountFor(user);
  if (account) data.billing = exportBillingAccount(account.accountType, account.accountId);
  return data;
}

export type DeleteOutcome =
  | { ok: true; removedWorkspace: boolean }
  | { ok: false; error: string; status: number };

// Exclui a conta. Marca que se cadastrou sozinha leva junto todo o
// workspace; marca criada por uma agência perde só o login (os dados do
// trabalho são da agência — a pessoa pode pedir à agência). Profissional leva
// o perfil e o portfólio. Lançamentos financeiros ficam, sem vínculo pessoal.
export function deleteAccount(userId: string): DeleteOutcome {
  const user = getUserById(userId);
  if (!user) return { ok: false, error: "Conta não encontrada.", status: 404 };
  if (user.role === "admin") {
    const admins = (db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'admin' AND disabledAt IS NULL").get() as { c: number }).c;
    if (admins <= 1) return { ok: false, error: "Esta é a única conta de admin: crie outra antes de excluir.", status: 409 };
  }
  const files: { id: string; mime?: string; ext?: string }[] = [];
  let removedWorkspace = false;

  db.transaction(() => {
    if (user.role === "client" && user.refId) {
      const client = getClient(user.refId);
      const ownWorkspace = client && (client.source === "self" || user.brandSource === "platform");
      if (client && ownWorkspace) {
        const deliverables = db
          .prepare("SELECT d.id, d.mime FROM deliverables d JOIN projects p ON p.id = d.projectId WHERE p.clientId = ?")
          .all(client.id) as { id: string; mime: string }[];
        files.push(...deliverables);
        const assets = db.prepare("SELECT id, ext FROM client_assets WHERE clientId = ?").all(client.id) as { id: string; ext: string }[];
        files.push(...assets);
        for (const { table } of tablesWithColumn("clientId")) {
          if (table !== "clients") db.prepare(`DELETE FROM ${table} WHERE clientId = ?`).run(client.id);
        }
        db.prepare("DELETE FROM clients WHERE id = ?").run(client.id);
        removedWorkspace = true;
      }
    }
    if (user.role === "professional" && user.refId) {
      const assets = db.prepare("SELECT id, mime FROM professional_assets WHERE professionalId = ?").all(user.refId) as {
        id: string;
        mime: string;
      }[];
      files.push(...assets);
      for (const { table, notNull } of tablesWithColumn("professionalId")) {
        if (table === "professionals") continue;
        if (notNull) db.prepare(`DELETE FROM ${table} WHERE professionalId = ?`).run(user.refId);
        else db.prepare(`UPDATE ${table} SET professionalId = NULL WHERE professionalId = ?`).run(user.refId);
      }
      db.prepare("DELETE FROM professionals WHERE id = ?").run(user.refId);
      removedWorkspace = true;
    }
    const account = accountFor(user);
    if (account && user.role !== "agency" && removedWorkspace) anonymiseBillingAccount(account.accountType, account.accountId);
    if (account) anonymiseAiUsage(account.accountType, user.role === "agency" ? "-" : account.accountId, userId);
    anonymiseInboxForUser(userId);
    for (const { table } of tablesWithColumn("userId")) {
      if (table !== "users" && table !== "contact_messages") db.prepare(`DELETE FROM ${table} WHERE userId = ?`).run(userId);
    }
    db.prepare("DELETE FROM users WHERE id = ?").run(userId);
  }).immediate();

  for (const file of files) {
    try {
      if (file.ext) deleteGenericUpload(file.id, file.ext);
      else if (file.mime) deleteUpload(file.id, file.mime);
    } catch (error) {
      console.error("[lgpd] arquivo não removido:", file.id, error);
    }
  }
  return { ok: true, removedWorkspace };
}
