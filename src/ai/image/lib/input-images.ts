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

export function resolveInputImages(
  inputImages: Array<string | null | undefined> | null | undefined,
  fallbackInputImage?: string | null
): string[] {
  return normalizeInputImages([...(inputImages ?? []), fallbackInputImage]);
}

export function getPrimaryInputImage(
  inputImages: string[] | null | undefined,
  fallbackInputImage?: string | null
): string | null {
  return resolveInputImages(inputImages, fallbackInputImage)[0] ?? null;
}

export function getOptionalInputImages(
  inputImages: Array<string | null | undefined> | null | undefined,
  fallbackInputImage?: string | null
): string[] | undefined {
  const resolvedInputImages = resolveInputImages(
    inputImages,
    fallbackInputImage
  );

  return resolvedInputImages.length > 0 ? resolvedInputImages : undefined;
}

export function parseStoredInputImages(
  rawInputImages: string | null | undefined,
  fallbackInputImage?: string | null
): string[] {
  if (!rawInputImages) {
    return resolveInputImages([], fallbackInputImage);
  }

  try {
    const parsed = JSON.parse(rawInputImages);
    if (!Array.isArray(parsed)) {
      return resolveInputImages([], fallbackInputImage);
    }

    return resolveInputImages(
      parsed.filter((value): value is string => typeof value === 'string'),
      fallbackInputImage
    );
  } catch {
    return resolveInputImages([], fallbackInputImage);
  }
}

export function serializeInputImages(
  inputImages: string[] | null | undefined
): string | null {
  const normalized = resolveInputImages(inputImages);
  return normalized.length > 0 ? JSON.stringify(normalized) : null;
}
