import {
  GEMINI_MODEL_IDS,
  type GeminiModelId,
  isVertexImagenModel,
} from './provider-config';

/**
 * 请求超时时间（55 秒）
 * 略低于运行时最大执行时间，以便优雅地终止请求
 */
export const TIMEOUT_MILLIS = 55 * 1000;

/**
 * 带超时的 Promise 包装器
 */
export const withTimeout = <T>(
  promise: Promise<T>,
  timeoutMillis: number = TIMEOUT_MILLIS
): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Request timed out')), timeoutMillis)
    ),
  ]);
};

/**
 * 生成安全的请求 ID
 */
export const generateRequestId = (): string => {
  return crypto.randomUUID().slice(0, 8);
};

/**
 * Gemini 模型 Key 类型
 */
export type GeminiModelKey = 'forma' | 'gemini-flash';

/**
 * 将 Forma AI 模型 ID 映射到 Gemini 客户端的模型 key
 * 注意：Vertex AI Imagen 模型不需要映射，直接使用 modelId
 */
export const mapModelIdToGeminiKey = (modelId: string): GeminiModelKey => {
  // Vertex AI Imagen 模型不走这个映射
  if (isVertexImagenModel(modelId)) {
    return 'forma'; // 返回默认值，实际不会使用
  }

  if (modelId === 'forma' || modelId === GEMINI_MODEL_IDS.forma) {
    return 'forma';
  }
  if (modelId === 'forma-pro' || modelId === GEMINI_MODEL_IDS['forma-pro']) {
    return 'gemini-flash';
  }
  // 默认使用 forma
  return 'forma';
};

/**
 * Prompt 验证
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

export function validateBase64Image(base64: string | undefined | null): ImageValidationResult {
  if (!base64) {
    return { valid: true }; // No image is valid
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
 * 客户端调用图片生成 API
 */
export interface GenerateImageParams {
  prompt: string;
  referenceImage?: string;
  aspectRatio?: string;
  model?: string;
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
        modelId: params.model || 'gemini-2.0-flash-exp',
        referenceImage: params.referenceImage,
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
    console.error('Generate image error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
