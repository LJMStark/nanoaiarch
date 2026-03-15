/**
 * Client-side image compression utility for Gemini API compatibility.
 *
 * All uploaded images are re-encoded through an off-screen Canvas to ensure
 * they stay within Gemini's recommended input constraints:
 *   - Max dimension: 2048px (long edge)
 *   - Format: JPEG at quality 0.85
 *   - Target size: ≤ 3 MB after base64 encoding
 */

// Gemini API recommended max dimension for input images
const MAX_DIMENSION = 2048;
// JPEG quality for initial re-encode
const INITIAL_QUALITY = 0.85;
// Target size in bytes (3MB, leaves headroom for base64 ~33% inflation)
const TARGET_SIZE_BYTES = 3 * 1024 * 1024;
// Minimum quality / scale before giving up
const MIN_QUALITY = 0.1;
const MIN_SCALE = 0.3;

// Supported MIME types
export const ACCEPTED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
] as const;

export function isAcceptedImageType(type: string): boolean {
  return (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(type);
}

/**
 * Compress an image file to a Gemini-compatible base64 string.
 *
 * Always re-encodes through Canvas regardless of file size to guarantee
 * consistent dimensions and format.
 *
 * @returns pure base64 string (no data-URL prefix)
 */
export async function compressImageForApi(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file);

  try {
    return await new Promise<string>((resolve, reject) => {
      const img = new window.Image();

      img.onload = () => {
        try {
          const base64 = iterativeCompress(img);
          resolve(base64);
        } catch (err) {
          reject(err);
        }
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Iteratively compress an HTMLImageElement until it fits the target size.
 *
 * Strategy:
 *  1. Scale down to MAX_DIMENSION if needed
 *  2. Re-encode as JPEG at INITIAL_QUALITY
 *  3. If still too large, progressively lower quality then scale
 */
function iterativeCompress(img: HTMLImageElement): string {
  let { width, height } = img;

  // Step 1: clamp to MAX_DIMENSION
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    const scale = MAX_DIMENSION / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas context not available');
  }

  // Step 2-3: iterative quality / scale reduction
  let quality = INITIAL_QUALITY;
  let sizeScale = 1;
  let base64 = '';

  while (true) {
    const w = Math.round(width * sizeScale);
    const h = Math.round(height * sizeScale);

    canvas.width = w;
    canvas.height = h;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    base64 = dataUrl.split(',')[1] ?? '';
    const sizeBytes = Math.round((base64.length * 3) / 4);

    if (sizeBytes <= TARGET_SIZE_BYTES || quality <= MIN_QUALITY || sizeScale <= MIN_SCALE) {
      break;
    }

    // Lower quality first, then scale
    if (quality > 0.5) {
      quality -= 0.1;
    } else {
      sizeScale -= 0.1;
    }
  }

  return base64;
}
