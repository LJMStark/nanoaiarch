import {
  DEFAULT_IMAGE_QUALITY,
  type ImageQuality,
} from '@/ai/image/components/ImageQualitySelect';
import { logger } from '@/lib/logger';
import type { DuomiAspectRatio, DuomiModelId } from './duomi-client';

/**
 * Request timeout duration (120 seconds)
 * Duomi API is asynchronous task-based, requiring longer wait times
 */
export const TIMEOUT_MILLIS = 120 * 1000;

/**
 * Promise wrapper with timeout support
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMillis: number = TIMEOUT_MILLIS
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Request timed out')), timeoutMillis)
    ),
  ]);
}

/**
 * Generate a safe request ID
 */
export function generateRequestId(): string {
  return crypto.randomUUID().slice(0, 8);
}

/**
 * Duomi model key type - only 'forma' (gemini-3-pro-image-preview)
 */
export type DuomiModelKey = 'forma';

/**
 * Map frontend model ID to Duomi API model ID
 * Currently only one model: gemini-3-pro-image-preview (nano-banana-pro)
 */
export function mapModelIdToDuomiModel(_modelId: string): DuomiModelId {
  return 'gemini-3-pro-image-preview';
}

/**
 * Map frontend aspect ratio to Duomi API format
 */
export function mapAspectRatioToDuomi(aspectRatio?: string): DuomiAspectRatio {
  const mapping: Record<string, DuomiAspectRatio> = {
    '1:1': '1:1',
    '16:9': '16:9',
    '9:16': '9:16',
    '4:3': '4:3',
    '3:4': '3:4',
    '3:2': '3:2',
    '2:3': '2:3',
    '21:9': '21:9',
  };
  return mapping[aspectRatio || ''] || 'auto';
}

// Backward compatibility: retain GeminiModelKey type alias
export type GeminiModelKey = DuomiModelKey;

/**
 * Backward compatibility: map to Gemini key (returns Duomi key)
 * Currently only one model: forma
 */
export function mapModelIdToGeminiKey(_modelId: string): DuomiModelKey {
  return 'forma';
}

/**
 * Prompt validation constants and utilities
 */
const MAX_PROMPT_LENGTH = 4000;
const BLOCKED_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /disregard\s+(all\s+)?previous/i,
  /forget\s+(all\s+)?previous/i,
];

export interface PromptValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Image size validation
 */
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_IMAGE_SIZE_MB = 10;

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
  sizeBytes?: number;
}

export function validateBase64Image(
  base64: string | undefined | null
): ImageValidationResult {
  if (!base64) {
    return { valid: true }; // No image is valid
  }

  // Ensure base64 is a string
  if (typeof base64 !== 'string') {
    return {
      valid: false,
      error: 'Invalid image data: expected base64 string',
    };
  }

  // Skip validation for URLs (they don't need size validation here)
  if (base64.startsWith('http://') || base64.startsWith('https://')) {
    // Validate URL format
    try {
      new URL(base64);
      return { valid: true };
    } catch {
      return {
        valid: false,
        error: 'Invalid URL format',
      };
    }
  }

  // Calculate approximate size from base64
  // Base64 encoded size is roughly 4/3 of original, so original = base64.length * 3/4
  const paddingCount = (base64.match(/=/g) || []).length;
  const sizeBytes = Math.floor((base64.length * 3) / 4) - paddingCount;

  if (sizeBytes > MAX_IMAGE_SIZE_BYTES) {
    const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `Image size (${sizeMB}MB) exceeds maximum allowed size of ${MAX_IMAGE_SIZE_MB}MB`,
      sizeBytes,
    };
  }

  return { valid: true, sizeBytes };
}

export function validatePrompt(prompt: string): PromptValidationResult {
  if (!prompt || prompt.trim().length === 0) {
    return { valid: false, error: 'Prompt is required' };
  }

  if (prompt.length > MAX_PROMPT_LENGTH) {
    return {
      valid: false,
      error: `Prompt exceeds maximum length of ${MAX_PROMPT_LENGTH} characters`,
    };
  }

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(prompt)) {
      return { valid: false, error: 'Invalid prompt content detected' };
    }
  }

  return { valid: true };
}

/**
 * Client-side image generation API call
 */
export interface GenerateImageParams {
  prompt: string;
  referenceImage?: string;
  referenceImages?: string[]; // Multi-image reference (base64 array, max 5 images)
  aspectRatio?: string;
  model?: string;
  imageSize?: ImageQuality;
}

export interface GenerateImageResult {
  success: boolean;
  image?: string;
  text?: string;
  error?: string;
  creditsUsed?: number;
}

export async function generateImage(
  params: GenerateImageParams
): Promise<GenerateImageResult> {
  try {
    const response = await fetch('/api/generate-images', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: params.prompt,
        modelId: params.model || 'forma',
        referenceImage: params.referenceImage,
        referenceImages: params.referenceImages,
        aspectRatio: params.aspectRatio,
        imageSize: params.imageSize || DEFAULT_IMAGE_QUALITY,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || 'Failed to generate image',
      };
    }

    if (data.image) {
      return {
        success: true,
        image: data.image,
        text: data.text,
        creditsUsed: data.creditsUsed,
      };
    }

    return {
      success: false,
      error: data.error || 'No image generated',
    };
  } catch (error) {
    logger.ai.error('Generate image error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
