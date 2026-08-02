import { getGeneration } from "@/lib/db";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  const { id } = await params;
  const generation = getGeneration(id);
  if (!generation || generation.type !== "landing_page") {
    return new Response("Landing page não encontrada", { status: 404 });
  }

  const headers: Record<string, string> = {
    "Content-Type": "text/html; charset=utf-8",
  };
  if (new URL(request.url).searchParams.get("download") === "1") {
    const slug = generation.title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    headers["Content-Disposition"] = `attachment; filename="${slug || "landing-page"}.html"`;
  }
  return new Response(generation.content, { headers });
}
