/**
 * Safely create a base64 image data URL
 * Prevents [object Object] errors by validating the input
 */
export function createBase64ImageUrl(
  imageData: string | null | undefined | object
): string | null {
  // Handle null/undefined
  if (!imageData) {
    return null;
  }

  // Handle objects (should not happen, but防御性编程)
  if (typeof imageData !== 'string') {
    console.error(
      'Expected string for base64 image data, got:',
      typeof imageData,
      imageData
    );
    return null;
  }

  // Empty string
  if (imageData.trim() === '') {
    return null;
  }

  // Already has data URL prefix
  if (imageData.startsWith('data:image/')) {
    return imageData;
  }

  // Create data URL
  return `data:image/png;base64,${imageData}`;
}

/**
 * Validate if a string is a valid base64 image
 */
export function isValidBase64Image(data: unknown): data is string {
  if (typeof data !== 'string') {
    return false;
  }

  if (data.trim() === '') {
    return false;
  }

  // Basic base64 pattern check (alphanumeric + / + = padding)
  const base64Pattern = /^[A-Za-z0-9+/=]+$/;

  // If it has data URL prefix, extract base64 part
  if (data.startsWith('data:image/')) {
    const parts = data.split(',');
    if (parts.length !== 2) {
      return false;
    }
    return base64Pattern.test(parts[1]);
  }

  return base64Pattern.test(data);
}
