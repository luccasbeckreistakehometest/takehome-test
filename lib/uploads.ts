import fs from "fs";
import path from "path";

const uploadsDir = path.join(process.cwd(), "data", "uploads");

export const ALLOWED_IMAGE_MIMES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;

export type AllowedImageMime = (typeof ALLOWED_IMAGE_MIMES)[number];

const EXTENSIONS: Record<AllowedImageMime, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};

export function saveUpload(id: string, mime: AllowedImageMime, data: Buffer): void {
  fs.mkdirSync(uploadsDir, { recursive: true });
  fs.writeFileSync(path.join(uploadsDir, `${id}.${EXTENSIONS[mime]}`), data);
}

export function readUpload(id: string, mime: string): Buffer | null {
  const ext = EXTENSIONS[mime as AllowedImageMime];
  if (!ext) return null;
  const filePath = path.join(uploadsDir, `${id}.${ext}`);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath);
}

export function deleteUpload(id: string, mime: string): void {
  const ext = EXTENSIONS[mime as AllowedImageMime];
  if (!ext) return;
  const filePath = path.join(uploadsDir, `${id}.${ext}`);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}
