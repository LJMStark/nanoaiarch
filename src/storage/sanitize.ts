export const ALLOWED_STORAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

const MIME_EXTENSION_MAP: Record<
  (typeof ALLOWED_STORAGE_MIME_TYPES)[number],
  string
> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export function sanitizeStorageFolder(
  folder: string | null | undefined
): string | undefined {
  if (!folder) {
    return undefined;
  }

  const safeSegments = folder
    .split('/')
    .flatMap((segment) => segment.split('\\'))
    .map((segment) => segment.trim())
    .filter((segment) => segment && segment !== '.' && segment !== '..')
    .map((segment) => segment.replace(/[^a-zA-Z0-9_-]/g, ''))
    .filter(Boolean);

  if (safeSegments.length === 0) {
    return undefined;
  }

  return safeSegments.join('/');
}

export function resolveSafeUploadFilename(
  originalFilename: string | null | undefined,
  mimeType: string
): string {
  const inferredExtension =
    MIME_EXTENSION_MAP[mimeType as keyof typeof MIME_EXTENSION_MAP];
  const normalizedName = originalFilename
    ?.split(/[\\/]/)
    .pop()
    ?.trim()
    ?.toLowerCase();
  const extensionFromName = normalizedName?.match(/\.([a-z0-9]+)$/)?.[1];

  const extension =
    extensionFromName &&
    Object.values(MIME_EXTENSION_MAP).includes(extensionFromName)
      ? extensionFromName
      : inferredExtension;

  return extension ? `upload.${extension}` : 'upload';
}
