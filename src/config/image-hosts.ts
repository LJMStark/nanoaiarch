const DEFAULT_IMAGE_HOST_PATTERNS = [
  'avatars.githubusercontent.com',
  'lh3.googleusercontent.com',
  'randomuser.me',
  'res.cloudinary.com',
  'ik.imagekit.io',
  'html.tailus.io',
  'service.firecrawl.dev',
  '*.dmiapi.com',
  '*.duomiapi.com',
  '*.r2.dev',
  '*.cloudfront.net',
  '*.supabase.co',
] as const;

function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase();
}

function parseImageHostPattern(value: string): string | null {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  if (trimmedValue.startsWith('*.')) {
    return normalizeHostname(trimmedValue);
  }

  try {
    const url = new URL(
      trimmedValue.includes('://') ? trimmedValue : `https://${trimmedValue}`
    );
    return normalizeHostname(url.hostname);
  } catch {
    return null;
  }
}

function getConfiguredImageHostPatterns(): string[] {
  const values = [
    process.env.STORAGE_PUBLIC_URL,
    process.env.IMAGE_REMOTE_HOSTS,
    process.env.NEXT_PUBLIC_IMAGE_HOSTS,
  ];

  return values.flatMap((rawValue) => {
    if (!rawValue) {
      return [];
    }

    return rawValue
      .split(',')
      .map(parseImageHostPattern)
      .filter((value): value is string => Boolean(value));
  });
}

export const imageRemoteHostPatterns = Array.from(
  new Set([...DEFAULT_IMAGE_HOST_PATTERNS, ...getConfiguredImageHostPatterns()])
);

export function isAllowedImageHostname(hostname: string): boolean {
  const normalizedHostname = normalizeHostname(hostname);

  return imageRemoteHostPatterns.some((pattern) => {
    const normalizedPattern = normalizeHostname(pattern);

    if (normalizedPattern.startsWith('*.')) {
      const suffix = normalizedPattern.slice(2);
      return (
        normalizedHostname === suffix ||
        normalizedHostname.endsWith(`.${suffix}`)
      );
    }

    return normalizedHostname === normalizedPattern;
  });
}
