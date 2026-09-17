import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { agencyOnly, isDenied } from "@/lib/guard";

// Serve o print do QR code do WhatsApp Web capturado pelo worker (headless no
// servidor). O front exibe isto para o usuário escanear com o celular.
export async function GET(request: Request) {
  const auth = await agencyOnly();
  if (isDenied(auth)) return auth;
  const profile = new URL(request.url).searchParams.get("profile") || "default";
  const qrPath = path.join(process.cwd(), "data", `messaging-qr-${profile}.png`);
  try {
    const data = fs.readFileSync(qrPath);
    return new NextResponse(new Uint8Array(data), {
      headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "sem QR" }, { status: 404 });
  }
}
