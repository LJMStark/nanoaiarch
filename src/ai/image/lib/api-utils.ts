import {
  DEFAULT_IMAGE_QUALITY,
  type ImageQuality,
} from '@/ai/image/lib/image-constants';
import { logger } from '@/lib/logger';
import type {
  GenerateImageResponse,
  PersistedAssistantMessagePayload,
} from './api-types';
import type { GeminiAspectRatio, GeminiImageModelId } from './gemini-client';
import { GEMINI_MODEL_IDS, type GeminiModelId } from './provider-config';
import type { ConversationHistoryMessage } from './workspace-types';

/**
 * Request timeout duration (120 seconds)
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
  return crypto.randomUUID();
}

/**
 * Map frontend model ID (forma/flash) to Gemini API model ID
 */
export function mapModelIdToGeminiModel(modelId: string): GeminiImageModelId {
  const id = modelId as GeminiModelId;
  if (id in GEMINI_MODEL_IDS) {
    return GEMINI_MODEL_IDS[id];
  }
  return GEMINI_MODEL_IDS.forma;
}

/**
 * Map frontend aspect ratio to Gemini API format
 */
export function mapAspectRatioToGemini(
  aspectRatio?: string
): GeminiAspectRatio {
  const mapping: Record<string, GeminiAspectRatio> = {
    '1:1': '1:1',
    '1:4': '1:4',
    '1:8': '1:8',
    '2:3': '2:3',
    '3:2': '3:2',
    '3:4': '3:4',
    '4:1': '4:1',
    '4:3': '4:3',
    '4:5': '4:5',
    '5:4': '5:4',
    '8:1': '8:1',
    '9:16': '9:16',
    '16:9': '16:9',
    '21:9': '21:9',
  };
  return mapping[aspectRatio || ''] || 'auto';
}

// Keep backward-compatible type alias
export type GeminiModelKey = GeminiModelId;

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

function getAllowedImageFetchHosts(): Set<string> {
  const hosts = new Set<string>();
  const rawHosts = process.env.IMAGE_ALLOWED_FETCH_HOSTS?.trim();

  if (rawHosts) {
    for (const host of rawHosts
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)) {
      hosts.add(host);
    }
  }

  for (const [envKey, envValue] of [
    ['STORAGE_PUBLIC_URL', process.env.STORAGE_PUBLIC_URL],
    ['STORAGE_ENDPOINT', process.env.STORAGE_ENDPOINT],
  ] as const) {
    if (!envValue?.trim()) {
      continue;
    }

    try {
      hosts.add(new URL(envValue).hostname.toLowerCase());
    } catch (error) {
      logger.ai.warn(`[Image Validation] Ignoring invalid ${envKey}`, {
        value: envValue,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return hosts;
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
      error: '无效的图片数据',
    };
  }

  // Skip validation for URLs (they don't need size validation here)
  if (base64.startsWith('http://') || base64.startsWith('https://')) {
    try {
      const url = new URL(base64);
      const allowedHosts = getAllowedImageFetchHosts();

      if (!allowedHosts.has(url.hostname.toLowerCase())) {
        return {
          valid: false,
          error: '图片来源未被允许',
        };
      }

      return { valid: true };
    } catch {
      return {
        valid: false,
        error: '无效的链接格式',
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
      error: `图片大小（${sizeMB}MB）超过最大限制 ${MAX_IMAGE_SIZE_MB}MB`,
      sizeBytes,
    };
  }

  return { valid: true, sizeBytes };
}

export function validatePrompt(prompt: string): PromptValidationResult {
  if (!prompt || prompt.trim().length === 0) {
    return { valid: false, error: '请输入提示词' };
  }

  if (prompt.length > MAX_PROMPT_LENGTH) {
    return {
      valid: false,
      error: `提示词超过最大长度 ${MAX_PROMPT_LENGTH} 字符`,
    };
  }

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(prompt)) {
      return { valid: false, error: '提示词包含无效内容' };
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
  referenceImages?: string[]; // Multi-image reference (base64 array, max 10 images)
  aspectRatio?: string;
  model?: string;
  imageSize?: ImageQuality;
  signal?: AbortSignal;
  conversationHistory?: ConversationHistoryMessage[];
  projectId?: string;
  assistantMessageId?: string;
}

export interface GenerateImageResult {
  success: boolean;
  image?: string;
  text?: string;
  error?: string;
  creditsUsed?: number;
  message?: PersistedAssistantMessagePayload;
}

const CLIENT_TIMEOUT_MS = 150 * 1000;

export async function generateImage(
  params: GenerateImageParams
): Promise<GenerateImageResult> {
  const internalController = new AbortController();
  const timeoutId = setTimeout(
    () => internalController.abort(),
    CLIENT_TIMEOUT_MS
  );
  const handleAbort = () => internalController.abort();

  // If external signal provided, forward its abort to the internal controller
  if (params.signal) {
    if (params.signal.aborted) {
      clearTimeout(timeoutId);
      return { success: false, error: '生成已取消' };
    }
    params.signal.addEventListener('abort', handleAbort, { once: true });
  }

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
        conversationHistory: params.conversationHistory,
        projectId: params.projectId,
        assistantMessageId: params.assistantMessageId,
      }),
      signal: internalController.signal,
    });

    clearTimeout(timeoutId);
    params.signal?.removeEventListener('abort', handleAbort);
    const data = (await response.json()) as GenerateImageResponse;

    if (data.message) {
      return {
        success: data.message.status === 'completed',
        image: data.message.outputImage ?? undefined,
        text: data.message.content || data.text,
        error: data.error || data.message.errorMessage || undefined,
        creditsUsed: data.creditsUsed ?? data.message.creditsUsed ?? undefined,
        message: data.message,
      };
    }

    if (!response.ok) {
      return {
        success: false,
        error: data.error || '图片生成失败',
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
      error: data.error || '未生成图片，请尝试其他描述',
    };
  } catch (error) {
    clearTimeout(timeoutId);
    params.signal?.removeEventListener('abort', handleAbort);
    if (error instanceof Error && error.name === 'AbortError') {
      const wasCancelled = params.signal?.aborted;
      if (wasCancelled) {
        return { success: false, error: '生成已取消' };
      }
      logger.ai.error('Generate image timeout');
      return {
        success: false,
        error: '请求超时，请重试',
      };
    }
    logger.ai.error('Generate image error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
    };
  }
}
