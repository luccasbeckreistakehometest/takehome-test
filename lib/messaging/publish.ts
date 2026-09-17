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

async function graphPost(url: string, body: Record<string, unknown>): Promise<{ id: string }> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? `IG ${res.status}`);
  return data as { id: string };
}

// Carrossel: um container por imagem (is_carousel_item), o container
// CAROUSEL com os filhos e a publicação. O Graph aceita de 2 a 10 itens.
export async function publishInstagramCarousel(input: { igId: string; token: string; imageUrls: string[]; caption: string }): Promise<string> {
  const urls = input.imageUrls.slice(0, 10);
  if (urls.length < 2) throw new Error("Carrossel precisa de pelo menos 2 imagens");
  const children: string[] = [];
  for (const imageUrl of urls) {
    const child = await graphPost(`${GRAPH}/${input.igId}/media`, { image_url: imageUrl, is_carousel_item: true, access_token: input.token });
    children.push(child.id);
  }
  const container = await graphPost(`${GRAPH}/${input.igId}/media`, {
    media_type: "CAROUSEL",
    children: children.join(","),
    caption: input.caption,
    access_token: input.token,
  });
  const published = await graphPost(`${GRAPH}/${input.igId}/media_publish`, { creation_id: container.id, access_token: input.token });
  return published.id;
}

// Tenta publicar de verdade um post agendado. Retorna:
// - "published" quando de fato publicou na rede,
// - "auto" quando não há caminho real (sem conexão/mídia) e apenas avança a fila.
export async function tryPublishPost(post: {
  agencyId: string;
  channel: string;
  caption: string;
  mediaUrl?: string | null;
  mediaUrls?: string[];
}): Promise<"published" | "auto"> {
  if (post.channel.toLowerCase().includes("instagram")) {
    const conn = getConnection(post.agencyId, "instagram");
    if (conn?.mode === "api" && conn.apiToken && conn.apiAccountId && (post.mediaUrls?.length ?? 0) >= 2) {
      await publishInstagramCarousel({ igId: conn.apiAccountId, token: conn.apiToken, imageUrls: post.mediaUrls!, caption: post.caption });
      return "published";
    }
    const single = post.mediaUrl ?? (post.mediaUrls?.length === 1 ? post.mediaUrls[0] : null);
    if (conn?.mode === "api" && conn.apiToken && conn.apiAccountId && single) {
      await publishInstagramImage({
        igId: conn.apiAccountId,
        token: conn.apiToken,
        imageUrl: post.mediaUrl ?? post.mediaUrls?.[0] ?? "",
        caption: post.caption,
      });
      return "published";
    }
  }
  // Sem integração real disponível: avança a fila (auto-confirma).
  return "auto";
}
