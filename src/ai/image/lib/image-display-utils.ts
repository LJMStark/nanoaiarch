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
  return response.blob();
}

/**
 * Download image to user's device
 */
export async function downloadImage(
  imageData: string,
  filename = 'image.png'
): Promise<void> {
  const blob = await fetchImageBlob(imageData);
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(blobUrl);
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
