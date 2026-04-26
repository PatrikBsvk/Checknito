/**
 * Client-side komprese obrázku před uploadem do Supabase Storage.
 *
 * - Resize na max. stranu `maxDimension` (zachová poměr stran)
 * - Re-encode do JPEG s danou `quality`
 * - Zachová EXIF rotaci (iOS/Android fotky jsou často otočené přes metadata)
 * - Pokud by komprese byla větší než originál (malá PNG ikona apod.),
 *   vrátí originální soubor.
 *
 * Typické výsledky:
 *   - iPhone foto 4000×3000 (6 MB HEIC/JPEG) → ~1600×1200 (~500–800 KB)
 *   - Android 12 MPx        (4 MB JPEG)      → ~1600×1200 (~400–700 KB)
 */
interface CompressOptions {
  /** Maximální delší strana v px. Default 1600. */
  maxDimension?: number;
  /** JPEG quality 0–1. Default 0.82 (vizuálně nerozeznatelné od originálu). */
  quality?: number;
}

export async function compressImage(
  file: File,
  opts: CompressOptions = {},
): Promise<File> {
  const { maxDimension = 1600, quality = 0.82 } = opts;

  // Safety net — pokud by náhodou prošel něco, co není obrázek, vrať to
  if (!file.type.startsWith('image/')) return file;

  // createImageBitmap je rychlejší než <img> a zvládá EXIF rotaci
  // (bez `imageOrientation` by se iOS fotky zobrazily položené na bok).
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch (err) {
    console.warn('[compress] createImageBitmap selhal, vracím originál', err);
    return file;
  }

  const { width: w, height: h } = bitmap;
  const scale = Math.min(1, maxDimension / Math.max(w, h));
  const targetW = Math.round(w * scale);
  const targetH = Math.round(h * scale);

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    return file;
  }

  ctx.drawImage(bitmap, 0, 0, targetW, targetH);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', quality),
  );
  if (!blob) return file;

  // Edge case: pokud je „komprimovaná" verze větší (malý zdroj, nebo už
  // agresivně stlačený JPEG), nezhoršuj to — vrať originál.
  if (blob.size >= file.size) return file;

  const baseName = file.name.replace(/\.[^.]+$/, '') || 'photo';
  return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
}
