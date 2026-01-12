import { logger } from '@/lib/logger';
import { z } from 'zod';

/**
 * Image URL/Base64 format detection and conversion
 */
export function getImageSrc(imageData: string): string {
  return imageData.startsWith('http://') || imageData.startsWith('https://')
    ? imageData
    : `data:image/png;base64,${imageData}`;
}

/**
 * Validate whether string is valid base64
 * Improved validation: checks length, padding, and character set
 */
export function isValidBase64(str: string): boolean {
  if (!str || str.length < 100) return false;

  // Base64 string length must be multiple of 4
  if (str.length % 4 !== 0) return false;

  // Validate character set: only A-Z, a-z, 0-9, +, / and up to 2 padding =
  const base64Pattern = /^[A-Za-z0-9+/]+={0,2}$/;
  return base64Pattern.test(str);
}

/**
 * Validate whether URL is a safe image URL
 * Uses allowlist mechanism, only permitting specific domains
 */
export function isValidImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);

    // Only allow HTTPS protocol
    if (parsed.protocol !== 'https:') {
      logger.ai.warn('[Image Utils] Rejected non-HTTPS URL', { url });
      return false;
    }

    // URL allowlist: permitted image domains
    const allowedDomains = [
      'dmiapi.com',
      'duomiapi.com',
      'cloudfront.net', // AWS CloudFront CDN (Duomi backup)
      'replicate.delivery',
      'oaidalleapiprodscus.blob.core.windows.net', // OpenAI DALL-E
      'cdn.openai.com',
    ];

    // Check if domain is in allowlist (supports subdomains)
    const isAllowed = allowedDomains.some(
      (domain) =>
        parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)
    );

    if (!isAllowed) {
      logger.ai.warn('[Image Utils] Rejected URL from untrusted domain', {
        hostname: parsed.hostname,
      });
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Safely extract image data from API response
 * Supports string and object formats with validation
 */
export function extractImageData(rawImage: unknown): string {
  // Handle string format
  if (typeof rawImage === 'string') {
    return validateAndReturnImage(rawImage);
  }

  // Handle object format
  if (typeof rawImage === 'object' && rawImage !== null) {
    const obj = rawImage as Record<string, unknown>;
    const imageData =
      (obj.url as string) ||
      (obj.value as string) ||
      (obj.data as string) ||
      '';

    if (!imageData) {
      throw new Error('No image data found in object');
    }

    return validateAndReturnImage(imageData);
  }

  throw new Error(
    `Invalid image format: expected string or object, got ${typeof rawImage}`
  );
}

/**
 * Validate and return image data
 * Internal helper function
 */
function validateAndReturnImage(imageData: string): string {
  if (!imageData || !imageData.trim()) {
    throw new Error('Empty image data');
  }

  // Check if URL
  const isUrl =
    imageData.startsWith('http://') || imageData.startsWith('https://');

  if (isUrl) {
    // Validate URL security
    if (!isValidImageUrl(imageData)) {
      throw new Error('Image URL failed security validation');
    }
    return imageData;
  }

  // Check if valid Base64
  if (!isValidBase64(imageData)) {
    throw new Error('Invalid base64 image data');
  }

  return imageData;
}

/**
 * Fetch timeout wrapper
 * Adds timeout control to fetch requests
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 30000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  }
}

// ============================================
// Zod Validation Schemas
// ============================================

/**
 * Image generation parameters validation schema
 */
export const generateImageParamsSchema = z.object({
  prompt: z
    .string()
    .min(1, 'Prompt cannot be empty')
    .max(4000, 'Prompt is too long (max 4000 characters)'),
  model: z.string().optional(),
  aspectRatio: z
    .enum([
      'auto',
      '1:1',
      '2:3',
      '3:2',
      '3:4',
      '4:3',
      '4:5',
      '5:4',
      '9:16',
      '16:9',
      '21:9',
    ])
    .optional(),
  imageSize: z.enum(['1K', '2K', '4K']).optional(),
});

/**
 * Image editing parameters validation schema
 */
export const editImageParamsSchema = z.object({
  prompt: z
    .string()
    .min(1, 'Prompt cannot be empty')
    .max(4000, 'Prompt is too long (max 4000 characters)'),
  imageUrls: z
    .array(z.string().url('Invalid image URL'))
    .min(1, 'At least one reference image is required')
    .max(5, 'Maximum 5 reference images allowed')
    .refine(
      (urls) => urls.every(isValidImageUrl),
      'One or more image URLs failed security validation'
    ),
  model: z.string().optional(),
  aspectRatio: z
    .enum([
      'auto',
      '1:1',
      '2:3',
      '3:2',
      '3:4',
      '4:3',
      '4:5',
      '5:4',
      '9:16',
      '16:9',
      '21:9',
    ])
    .optional(),
  imageSize: z.enum(['1K', '2K', '4K']).optional(),
});

/**
 * Type-safe parameter validation helper functions
 */
export function validateGenerateImageParams<T>(
  params: T
): z.infer<typeof generateImageParamsSchema> {
  return generateImageParamsSchema.parse(params);
}

export function validateEditImageParams<T>(
  params: T
): z.infer<typeof editImageParamsSchema> {
  return editImageParamsSchema.parse(params);
}
