/**
 * Image Display Utilities
 * Common functions for handling image display, download, and sharing
 */

const IMAGE_PROXY_ROUTE = '/api/image/proxy';

/**
 * Convert image data to displayable src
 * Handles both URLs and base64 data
 */
export function getImageSrc(imageData: string): string {
  if (imageData.startsWith('http://') || imageData.startsWith('https://')) {
    return imageData;
  }
  return `data:image/png;base64,${imageData}`;
}

/**
 * Decode a freshly generated image into the browser's cache so the first
 * on-screen paint doesn't expose the bg-muted placeholder while a large
 * base64 data URI is still being decoded. Resolves on load/error/timeout so
 * callers never block generation state flipping for long.
 */
export function preloadImage(imageData: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !imageData) {
      resolve();
      return;
    }

    const img = new window.Image();
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      resolve();
    };

    const timeoutId = window.setTimeout(done, 1500);
    img.onload = done;
    img.onerror = done;
    img.src = getImageSrc(imageData);
  });
}

export function buildImageProxyUrl(url: string): string {
  const searchParams = new URLSearchParams({ url });
  return `${IMAGE_PROXY_ROUTE}?${searchParams.toString()}`;
}

function resolveImageFetchUrl(imageData: string): string {
  if (imageData.startsWith('http://') || imageData.startsWith('https://')) {
    return buildImageProxyUrl(imageData);
  }

  if (imageData.startsWith('data:')) {
    return imageData;
  }

  return `data:image/png;base64,${imageData}`;
}

/**
 * Fetch image as Blob (supports both URL and base64)
 */
export async function fetchImageBlob(imageData: string): Promise<Blob> {
  const url = resolveImageFetchUrl(imageData);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }
  return response.blob();
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = blobUrl;
  link.download = filename;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Revoke after the click has been handed off to the browser.
  window.setTimeout(() => {
    URL.revokeObjectURL(blobUrl);
  }, 0);
}

/**
 * Download image to user's device
 */
export async function downloadImage(
  imageData: string,
  filename = 'image.png'
): Promise<void> {
  const blob = await fetchImageBlob(imageData);
  triggerBlobDownload(blob, filename);
}

/**
 * Share image using native share API or clipboard fallback
 */
export async function shareImage(
  imageData: string,
  title = '生成的图像'
): Promise<void> {
  const blob = await fetchImageBlob(imageData);
  const file = new File([blob], 'generation.png', { type: 'image/png' });

  if (navigator.share && navigator.canShare({ files: [file] })) {
    await navigator.share({
      files: [file],
      title,
    });
  } else {
    // Fallback: copy to clipboard
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
  }
}
