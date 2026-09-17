import fs from "fs";
import path from "path";

const uploadsDir = path.join(process.env.DATA_DIR ?? path.join(process.cwd(), "data"), "uploads");

export const ALLOWED_IMAGE_MIMES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;

export type AllowedImageMime = (typeof ALLOWED_IMAGE_MIMES)[number];

// Imagens que o app mostra inline. SVG fica de fora de propósito: é documento
// (pode carregar <script>) e sairia com a origem do app.
export function isInlineImageMime(mime: string | null | undefined): mime is AllowedImageMime {
  return ALLOWED_IMAGE_MIMES.includes(mime as AllowedImageMime);
}

// Tipo real da imagem pela assinatura do arquivo (o `type` do upload vem do
// navegador de quem envia e não prova nada).
export function sniffImageMime(data: Uint8Array): AllowedImageMime | null {
  const b = data;
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) {
    return "image/png";
  }
  if (b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38 && (b[4] === 0x37 || b[4] === 0x39) && b[5] === 0x61) {
    return "image/gif";
  }
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) {
    return "image/webp";
  }
  return null;
}

// Vídeo: MP4/MOV (caixa `ftyp` no byte 4) e WebM (EBML).
export function looksLikeVideo(data: Uint8Array): boolean {
  const b = data;
  if (b.length >= 8 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) return true;
  return b.length >= 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3;
}

// Tipos genéricos que podem ser guardados com o tipo declarado (só servem
// como download). Qualquer outro vira application/octet-stream.
const SAFE_GENERIC_MIMES = new Set([
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
  "application/postscript",
  "application/illustrator",
  "image/vnd.adobe.photoshop",
  "application/vnd.adobe.photoshop",
  "application/octet-stream",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "font/otf",
  "font/ttf",
  "font/woff",
  "font/woff2",
]);

// Tipo gravado para um arquivo genérico da marca: imagem só se os bytes
// provarem; SVG, HTML, XML, JS e desconhecidos viram octet-stream.
export function storedGenericMime(declared: string, data: Uint8Array): string {
  const sniffed = sniffImageMime(data);
  if (sniffed) return sniffed;
  const mime = (declared || "").toLowerCase().split(";")[0].trim();
  return SAFE_GENERIC_MIMES.has(mime) ? mime : "application/octet-stream";
}

// Cabeçalhos de todo arquivo servido pelo app: sem farejar tipo e, se o
// navegador abrir como documento, em sandbox (nenhum script roda).
export const FILE_RESPONSE_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; sandbox",
};

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

export function saveUpload(id: string, mime: string, data: Buffer): void {
  fs.mkdirSync(uploadsDir, { recursive: true });
  fs.writeFileSync(path.join(uploadsDir, `${id}.${EXTENSIONS[mime]}`), data);
}

export function readUpload(id: string, mime: string): Buffer | null {
  const ext = EXTENSIONS[mime];
  if (!ext) return null;
  const filePath = path.join(uploadsDir, `${id}.${ext}`);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath);
}

export function deleteUpload(id: string, mime: string): void {
  const ext = EXTENSIONS[mime];
  if (!ext) return;
  const filePath = path.join(uploadsDir, `${id}.${ext}`);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

// Arquivos genéricos (PSD, AI, PDF, ZIP...) — extensão sanitizada vem do DB
export function sanitizeExt(filename: string): string {
  const ext = (filename.split(".").pop() ?? "bin").toLowerCase();
  return /^[a-z0-9]{1,8}$/.test(ext) ? ext : "bin";
}

export function saveGenericUpload(id: string, ext: string, data: Buffer): void {
  fs.mkdirSync(uploadsDir, { recursive: true });
  fs.writeFileSync(path.join(uploadsDir, `${id}.${ext}`), data);
}

export function readGenericUpload(id: string, ext: string): Buffer | null {
  if (!/^[a-z0-9]{1,8}$/.test(ext)) return null;
  const filePath = path.join(uploadsDir, `${id}.${ext}`);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath);
}

export function deleteGenericUpload(id: string, ext: string): void {
  if (!/^[a-z0-9]{1,8}$/.test(ext)) return;
  const filePath = path.join(uploadsDir, `${id}.${ext}`);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}
