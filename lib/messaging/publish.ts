import { getConnection } from "../messaging-db";

// Publicação real no Instagram via Graph API (content publishing): cria o
// container de mídia e publica. Exige conta Business conectada (token+igId em
// Conexões) e uma URL pública da imagem. Sem isso, o scheduler apenas
// auto-confirma o post (avança a fila) — hospedagem de mídia é infra de deploy.

const GRAPH = "https://graph.facebook.com/v21.0";

export async function publishInstagramImage(input: {
  igId: string;
  token: string;
  imageUrl: string;
  caption: string;
}): Promise<string> {
  // 1) cria container
  const createRes = await fetch(`${GRAPH}/${input.igId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image_url: input.imageUrl,
      caption: input.caption,
      access_token: input.token,
    }),
  });
  const created = await createRes.json();
  if (!createRes.ok) throw new Error(created?.error?.message ?? `IG media ${createRes.status}`);
  // 2) publica o container
  const pubRes = await fetch(`${GRAPH}/${input.igId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: created.id, access_token: input.token }),
  });
  const published = await pubRes.json();
  if (!pubRes.ok) throw new Error(published?.error?.message ?? `IG publish ${pubRes.status}`);
  return published.id as string;
}

// Tenta publicar de verdade um post agendado. Retorna:
// - "published" quando de fato publicou na rede,
// - "auto" quando não há caminho real (sem conexão/mídia) e apenas avança a fila.
export async function tryPublishPost(post: {
  channel: string;
  caption: string;
  mediaUrl?: string | null;
}): Promise<"published" | "auto"> {
  if (post.channel.toLowerCase().includes("instagram")) {
    const conn = getConnection("instagram");
    if (conn?.mode === "api" && conn.apiToken && conn.apiAccountId && post.mediaUrl) {
      await publishInstagramImage({
        igId: conn.apiAccountId,
        token: conn.apiToken,
        imageUrl: post.mediaUrl,
        caption: post.caption,
      });
      return "published";
    }
  }
  // Sem integração real disponível: avança a fila (auto-confirma).
  return "auto";
}
