import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

const ALLOWED_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

export function getUploadsRoot(): string {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
}

export function ensureUploadsRoot(): string {
  const root = getUploadsRoot();
  fs.mkdirSync(root, { recursive: true });
  return root;
}

export function publicUploadPath(merchantId: string, filename: string): string {
  return `/api/uploads/${merchantId}/${filename}`;
}

/**
 * Persist an uploaded image buffer under uploads/{merchantId}/…
 * Returns a public path served by Express static at /api/uploads.
 */
export async function saveMerchantImage(opts: {
  merchantId: string;
  buffer: Buffer;
  mimeType: string;
  originalName?: string;
}): Promise<{ filename: string; url: string; mimeType: string; size: number }> {
  const extFromMime = ALLOWED_MIME[opts.mimeType.toLowerCase()];
  if (!extFromMime) {
    throw new Error("Only JPEG, PNG, WebP, or GIF images are allowed");
  }
  if (!opts.buffer?.length) {
    throw new Error("Empty file");
  }
  if (opts.buffer.length > 12 * 1024 * 1024) {
    throw new Error("Image must be 12 MB or smaller");
  }

  const root = ensureUploadsRoot();
  const dir = path.join(root, opts.merchantId);
  fs.mkdirSync(dir, { recursive: true });

  const filename = `${randomUUID()}${extFromMime}`;
  const fullPath = path.join(dir, filename);
  await fs.promises.writeFile(fullPath, opts.buffer);

  return {
    filename,
    url: publicUploadPath(opts.merchantId, filename),
    mimeType: opts.mimeType,
    size: opts.buffer.length,
  };
}

export function isAllowedImageMime(mime: string): boolean {
  return !!ALLOWED_MIME[String(mime || "").toLowerCase()];
}
