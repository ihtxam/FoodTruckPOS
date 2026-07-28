/**
 * Compress an image file in the browser when it exceeds maxBytes.
 * Targets JPEG output for photos; keeps GIF untouched; falls back to original on failure.
 */
export async function compressImageIfNeeded(
  file: File,
  opts: { maxBytes?: number; maxWidth?: number; targetBytes?: number } = {}
): Promise<File> {
  const maxBytes = opts.maxBytes ?? 500 * 1024;
  const targetBytes = opts.targetBytes ?? 350 * 1024;
  const maxWidth = opts.maxWidth ?? 1600;

  if (!file.type.startsWith('image/') || file.type === 'image/gif') {
    return file;
  }
  if (file.size <= maxBytes) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    try {
      let width = bitmap.width;
      let height = bitmap.height;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return file;
      ctx.drawImage(bitmap, 0, 0, width, height);

      let quality = 0.82;
      let blob: Blob | null = null;
      for (let i = 0; i < 8; i += 1) {
        blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, 'image/jpeg', quality)
        );
        if (!blob) break;
        if (blob.size <= targetBytes || quality <= 0.45) break;
        quality -= 0.08;
        if (blob.size > targetBytes * 1.6 && width > 900) {
          width = Math.round(width * 0.85);
          height = Math.round(height * 0.85);
          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(bitmap, 0, 0, width, height);
        }
      }

      if (!blob || blob.size >= file.size) {
        return file;
      }

      const base = file.name.replace(/\.[^.]+$/, '') || 'image';
      return new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
    } finally {
      bitmap.close();
    }
  } catch {
    return file;
  }
}
