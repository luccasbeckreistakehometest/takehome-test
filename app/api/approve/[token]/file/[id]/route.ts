import { FILE_RESPONSE_HEADERS, isInlineImageMime, readUpload } from "@/lib/uploads";
import { linkFile } from "@/lib/approval-links-db";
import { isApprovalToken } from "@/lib/approval-link-rules";
import { checkLimits, clientIp } from "@/lib/rate-limit";

type Context = { params: Promise<{ token: string; id: string }> };

// Imagem de um item do link de aprovação (só enquanto o link está aberto).
export async function GET(request: Request, { params }: Context) {
  const { token, id } = await params;
  if (!checkLimits([["publicReadPerIp", clientIp(request)]]).ok) return new Response("Muitas tentativas", { status: 429 });
  const file = isApprovalToken(token) ? linkFile(token, id) : null;
  if (!file || !isInlineImageMime(file.mime)) return new Response("Não encontrado", { status: 404 });
  const data = readUpload(file.id, file.mime);
  if (!data) return new Response("Não encontrado", { status: 404 });
  return new Response(new Uint8Array(data), {
    headers: {
      ...FILE_RESPONSE_HEADERS,
      "Content-Type": file.mime,
      "Cache-Control": "private, max-age=600",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
