export const MAX_REFERENCE_IMAGES = 10;

export function normalizeInputImages(
  images: Array<string | null | undefined>
): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const image of images) {
    if (!image || typeof image !== 'string') {
      continue;
    }

    const value = image.trim();
    if (!value || seen.has(value)) {
      continue;
    }

    seen.add(value);
    normalized.push(value);
  }

  return normalized;
}

export function getPrimaryInputImage(
  inputImages: string[] | null | undefined,
  fallbackInputImage?: string | null
): string | null {
  return (
    normalizeInputImages([...(inputImages ?? []), fallbackInputImage])[0] ??
    null
  );
}

export function parseStoredInputImages(
  rawInputImages: string | null | undefined,
  fallbackInputImage?: string | null
): string[] {
  if (!rawInputImages) {
    return normalizeInputImages([fallbackInputImage]);
  }

  try {
    const parsed = JSON.parse(rawInputImages);
    if (!Array.isArray(parsed)) {
      return normalizeInputImages([fallbackInputImage]);
    }

    return normalizeInputImages([
      ...parsed.filter((value): value is string => typeof value === 'string'),
      fallbackInputImage,
    ]);
  } catch {
    return normalizeInputImages([fallbackInputImage]);
  }
}

export function serializeInputImages(
  inputImages: string[] | null | undefined
): string | null {
  const normalized = normalizeInputImages(inputImages ?? []);
  return normalized.length > 0 ? JSON.stringify(normalized) : null;
}
