import { randomUUID } from "crypto";
import { db } from "./db";

// Thread de comentários genérica por entregável. Diferente das anotações de
// imagem (pins com x/y em marketplace-db), estes comentários funcionam para
// QUALQUER tipo de entregável — texto ou imagem — como uma conversa simples.

export type CommentAuthor = "client" | "agency" | "professional";

export type DeliverableComment = {
  id: string;
  deliverableId: string;
  author: CommentAuthor; // papel de quem comentou
  authorName: string; // rótulo exibível (ex.: "Agência")
  body: string;
  createdAt: string;
};

db.exec(`
  CREATE TABLE IF NOT EXISTS deliverable_comments (
    id TEXT PRIMARY KEY,
    deliverableId TEXT NOT NULL,
    author TEXT NOT NULL DEFAULT 'agency',
    authorName TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL,
    createdAt TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_deliverable_comments ON deliverable_comments(deliverableId, createdAt);
`);

const now = () => new Date().toISOString();

export function listComments(deliverableId: string): DeliverableComment[] {
  return db
    .prepare(
      "SELECT * FROM deliverable_comments WHERE deliverableId = ? ORDER BY createdAt ASC"
    )
    .all(deliverableId) as DeliverableComment[];
}

export function createComment(input: {
  deliverableId: string;
  author: CommentAuthor;
  authorName: string;
  body: string;
}): DeliverableComment {
  const comment: DeliverableComment = {
    ...input,
    id: randomUUID(),
    createdAt: now(),
  };
  db.prepare(
    `INSERT INTO deliverable_comments (id, deliverableId, author, authorName, body, createdAt)
     VALUES (@id, @deliverableId, @author, @authorName, @body, @createdAt)`
  ).run(comment);
  return comment;
}

export function deleteComment(id: string): boolean {
  const result = db.prepare("DELETE FROM deliverable_comments WHERE id = ?").run(id);
  return result.changes > 0;
}
