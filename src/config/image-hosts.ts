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

export const imageRemoteHostPatterns = DEFAULT_IMAGE_HOST_PATTERNS;

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
