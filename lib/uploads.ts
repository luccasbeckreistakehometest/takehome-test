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
