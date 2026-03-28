/**
 * Image Display Utilities
 * Common functions for handling image display, download, and sharing
 */

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
 * Fetch image as Blob (supports both URL and base64)
 */
export async function fetchImageBlob(imageData: string): Promise<Blob> {
  const url = imageData.startsWith('http')
    ? imageData
    : `data:image/png;base64,${imageData}`;
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
  title = 'Generated Image'
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
