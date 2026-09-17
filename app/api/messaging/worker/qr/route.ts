import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { agencyOnly, forbidden, isDenied } from "@/lib/guard";
import { HOUSE_AGENCY_ID } from "@/lib/tenancy-rules";

// Serve o print do QR code do WhatsApp Web capturado pelo worker (headless no
// servidor). O front exibe isto para o usuário escanear com o celular.
export async function GET(request: Request) {
  const auth = await agencyOnly();
  if (isDenied(auth)) return auth;
  // QR da sessão física da casa: só ela (ou o admin) vê.
  if (auth.role !== "admin" && auth.agencyId !== HOUSE_AGENCY_ID) return forbidden();
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
