import { logger } from '@/lib/logger';
import { z } from 'zod';
import type {
  ConversationHistoryMessage,
  GeminiConversationPart,
} from './workspace-types';

// Official Google Gemini API configuration
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_MODEL: GeminiImageModelId =
  (process.env.GEMINI_DEFAULT_MODEL as GeminiImageModelId) ||
  'gemini-3-pro-image-preview';
const REQUEST_TIMEOUT_MS = 120_000; // 120s - synchronous API, no polling
const LEGACY_GEMINI_THOUGHT_SIGNATURE_TEXT =
  'context_engineering_is_the_way to_go';
// The REST API serializes bytes fields as base64 strings, so the documented
// legacy sentinel must be encoded before being sent as `thoughtSignature`.
const LEGACY_GEMINI_THOUGHT_SIGNATURE = Buffer.from(
  LEGACY_GEMINI_THOUGHT_SIGNATURE_TEXT
).toString('base64');

// Model types
// Nano Banana Pro = gemini-3-pro-image-preview
// Nano Banana 2  = gemini-3.1-flash-image-preview
export type GeminiImageModelId =
  | 'gemini-3-pro-image-preview'
  | 'gemini-3.1-flash-image-preview';

export type GeminiAspectRatio =
  | 'auto'
  | '1:1'
  | '1:4'
  | '1:8'
  | '2:3'
  | '3:2'
  | '3:4'
  | '4:1'
  | '4:3'
  | '4:5'
  | '5:4'
  | '8:1'
  | '9:16'
  | '16:9'
  | '21:9';

export type GeminiImageSize = '1K' | '2K' | '4K';

// ============================================
// Zod Validation Schemas for API Responses
// ============================================

const InlineDataSchema = z.object({
  mime_type: z.string().optional(),
  mimeType: z.string().optional(),
  data: z.string(),
});

const PartSchema = z.object({
  text: z.string().optional(),
  inline_data: InlineDataSchema.optional(),
  inlineData: InlineDataSchema.optional(),
  thoughtSignature: z.string().optional(),
});

const GeminiResponseSchema = z.object({
  candidates: z
    .array(
      z.object({
        content: z.object({
          parts: z.array(PartSchema),
        }),
        finishReason: z.string().optional(),
      })
    )
    .optional(),
  error: z
    .object({
      message: z.string(),
      code: z.number().optional(),
    })
    .optional(),
});

// ============================================
// Public Types
// ============================================

export interface GenerateImageParams {
  prompt: string;
  model?: GeminiImageModelId;
  aspectRatio?: GeminiAspectRatio;
  imageSize?: GeminiImageSize;
  signal?: AbortSignal;
}

export interface EditImageParams {
  prompt: string;
  referenceImages: string[]; // base64 encoded images
  model?: GeminiImageModelId;
  aspectRatio?: GeminiAspectRatio;
  imageSize?: GeminiImageSize;
  signal?: AbortSignal;
}

export type ConversationMessage = ConversationHistoryMessage;

export interface ConversationEditParams {
  messages: ConversationMessage[];
  model?: GeminiImageModelId;
  aspectRatio?: GeminiAspectRatio;
  imageSize?: GeminiImageSize;
  signal?: AbortSignal;
}

export interface GenerateImageResult {
  success: boolean;
  image?: string; // base64 encoded image
  text?: string;
  error?: string;
  modelResponseParts?: GeminiConversationPart[];
}

// ============================================
// Internal Helpers
// ============================================

function getGeminiApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set');
  }
  return apiKey;
}

type ImageConfig = {
  aspectRatio?: string;
  imageSize?: string;
};

function buildImageConfig(
  aspectRatio?: GeminiAspectRatio,
  imageSize?: GeminiImageSize
): ImageConfig {
  const config: ImageConfig = {};
  if (aspectRatio && aspectRatio !== 'auto') {
    config.aspectRatio = aspectRatio;
  }
  if (imageSize) {
    config.imageSize = imageSize;
  }
  return config;
}

function extractImageFromResponse(data: unknown): GenerateImageResult {
  const parseResult = GeminiResponseSchema.safeParse(data);
  if (!parseResult.success) {
    logger.ai.error('[Gemini] Invalid response structure:', parseResult.error);
    return { success: false, error: 'Gemini API 返回格式异常' };
  }

  const response = parseResult.data;

  if (response.error) {
    return { success: false, error: response.error.message };
  }

  if (!response.candidates || response.candidates.length === 0) {
    return { success: false, error: '未生成任何内容，请重试' };
  }

  const candidate = response.candidates[0];

  if (candidate.finishReason === 'SAFETY') {
    return {
      success: false,
      error: '内容不符合安全规范，请修改描述后重试',
    };
  }

  if (
    candidate.finishReason === 'RECITATION' ||
    candidate.finishReason === 'PROHIBITED_CONTENT'
  ) {
    return {
      success: false,
      error: '内容受限，请修改描述后重试',
    };
  }

  const { parts } = candidate.content;
  let imageBase64: string | undefined;
  let text: string | undefined;
  const modelResponseParts: GeminiConversationPart[] = [];

  for (const part of parts) {
    if (part.text) {
      text = part.text;
      modelResponseParts.push({
        type: 'text',
        text: part.text,
        thoughtSignature: part.thoughtSignature,
      });
    }
    const inlineData = part.inline_data ?? part.inlineData;
    if (inlineData?.data) {
      imageBase64 = inlineData.data;
      modelResponseParts.push({
        type: 'image',
        mimeType: inlineData.mime_type ?? inlineData.mimeType,
        thoughtSignature: part.thoughtSignature,
      });
    }
  }

  if (!imageBase64) {
    return {
      success: false,
      error: '未生成图片，请尝试其他描述',
      text,
      modelResponseParts:
        modelResponseParts.length > 0 ? modelResponseParts : undefined,
    };
  }

  return {
    success: true,
    image: imageBase64,
    text,
    modelResponseParts:
      modelResponseParts.length > 0 ? modelResponseParts : undefined,
  };
}

/**
 * Convert URL image to base64 for Gemini API inline_data
 */
async function urlToBase64(url: string, signal?: AbortSignal): Promise<string> {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }
  const buffer = await response.arrayBuffer();
  return Buffer.from(buffer).toString('base64');
}

async function resolveImageData(
  image: string,
  signal?: AbortSignal
): Promise<string> {
  if (image.startsWith('http')) {
    return urlToBase64(image, signal);
  }

  return image;
}

function createTextPart(
  text: string,
  thoughtSignature?: string
): Record<string, string> {
  return thoughtSignature ? { text, thoughtSignature } : { text };
}

async function createImagePart(
  image: string,
  signal?: AbortSignal,
  options?: {
    mimeType?: string;
    thoughtSignature?: string;
  }
): Promise<Record<string, unknown>> {
  const data = await resolveImageData(image, signal);

  return {
    inlineData: {
      mimeType: options?.mimeType || 'image/jpeg',
      data,
    },
    ...(options?.thoughtSignature
      ? { thoughtSignature: options.thoughtSignature }
      : {}),
  };
}

async function buildModelMessageParts(
  message: ConversationMessage,
  signal?: AbortSignal
): Promise<Array<Record<string, unknown>>> {
  if (message.parts && message.parts.length > 0) {
    const builtParts: Array<Record<string, unknown>> = [];
    let imageUsed = false;

    for (const part of message.parts) {
      if (part.type === 'text') {
        builtParts.push(createTextPart(part.text, part.thoughtSignature));
        continue;
      }

      if (imageUsed || !message.image) {
        logger.ai.warn('[Gemini] Missing image source for stored model part');
        continue;
      }

      try {
        builtParts.push(
          await createImagePart(message.image, signal, {
            mimeType: part.mimeType,
            thoughtSignature:
              part.thoughtSignature || LEGACY_GEMINI_THOUGHT_SIGNATURE,
          })
        );
        imageUsed = true;
      } catch (error) {
        logger.ai.warn(
          `[Gemini] Failed to resolve stored model image, skipping [role=${message.role}]`,
          { error: error instanceof Error ? error.message : String(error) }
        );
      }
    }

    if (builtParts.length > 0) {
      return builtParts;
    }
  }

  const legacyParts: Array<Record<string, unknown>> = [];

  if (message.content) {
    legacyParts.push(
      createTextPart(message.content, LEGACY_GEMINI_THOUGHT_SIGNATURE)
    );
  }

  if (message.image) {
    try {
      legacyParts.push(
        await createImagePart(message.image, signal, {
          thoughtSignature: LEGACY_GEMINI_THOUGHT_SIGNATURE,
        })
      );
    } catch (error) {
      logger.ai.warn(
        '[Gemini] Failed to resolve legacy model image, skipping',
        {
          error: error instanceof Error ? error.message : String(error),
        }
      );
    }
  }

  return legacyParts;
}

async function buildConversationMessageParts(
  message: ConversationMessage,
  signal?: AbortSignal
): Promise<Array<Record<string, unknown>>> {
  if (message.role === 'model') {
    return buildModelMessageParts(message, signal);
  }

  const parts: Array<Record<string, unknown>> = [];

  if (message.content) {
    parts.push(createTextPart(message.content));
  }

  const images =
    Array.isArray(message.images) && message.images.length > 0
      ? message.images
      : message.image
        ? [message.image]
        : [];

  for (const image of images) {
    try {
      parts.push(await createImagePart(image, signal));
    } catch (error) {
      logger.ai.warn('[Gemini] Failed to resolve user image, skipping', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return parts;
}

/**
 * Core API call to Gemini generateContent endpoint
 */
async function callGeminiApi(
  model: string,
  requestBody: Record<string, unknown>,
  signal?: AbortSignal
): Promise<GenerateImageResult> {
  const apiKey = getGeminiApiKey();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const handleAbort = () => controller.abort();

  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener('abort', handleAbort, { once: true });
    }
  }

  try {
    logger.ai.debug(`[Gemini] Calling API [model=${model}]`);

    const response = await fetch(
      `${GEMINI_API_BASE}/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', handleAbort);

    if (!response.ok) {
      const errorText = await response.text();
      logger.ai.error(`[Gemini] API error: ${response.status} - ${errorText}`);
      return {
        success: false,
        error: `Gemini API 错误 (${response.status})，请稍后重试`,
      };
    }

    const data = await response.json();
    return extractImageFromResponse(data);
  } catch (error) {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', handleAbort);
    if (error instanceof Error && error.name === 'AbortError') {
      if (signal?.aborted) {
        logger.ai.info('[Gemini] Request aborted by caller');
        return { success: false, error: '生成已取消' };
      }

      logger.ai.error('[Gemini] Request timeout');
      return { success: false, error: '请求超时，请重试' };
    }
    logger.ai.error('[Gemini] Request error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
    };
  }
}

// ============================================
// Public API: Text-to-Image
// ============================================

export async function generateImageWithGemini(
  params: GenerateImageParams
): Promise<GenerateImageResult> {
  const model = params.model || DEFAULT_MODEL;
  const imageConfig = buildImageConfig(params.aspectRatio, params.imageSize);

  logger.ai.info(`[Gemini] Text-to-image [model=${model}]`);

  const requestBody: Record<string, unknown> = {
    contents: [
      {
        parts: [{ text: params.prompt }],
      },
    ],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig,
    },
  };

  return callGeminiApi(model, requestBody, params.signal);
}

// ============================================
// Public API: Image Editing (with reference images)
// ============================================

export async function editImageWithGemini(
  params: EditImageParams
): Promise<GenerateImageResult> {
  const model = params.model || DEFAULT_MODEL;
  const imageConfig = buildImageConfig(params.aspectRatio, params.imageSize);

  logger.ai.info(
    `[Gemini] Image edit [model=${model}, imageCount=${params.referenceImages.length}]`
  );

  // Build parts: reference images first, then text prompt (per official API docs)
  const parts: Array<Record<string, unknown>> = [];

  for (const imageBase64 of params.referenceImages) {
    parts.push(
      await createImagePart(imageBase64, params.signal, {
        mimeType: 'image/jpeg',
      })
    );
  }

  parts.push({ text: params.prompt });

  const requestBody: Record<string, unknown> = {
    contents: [{ parts }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig,
    },
  };

  return callGeminiApi(model, requestBody, params.signal);
}

// ============================================
// Public API: Conversational Image Editing
// ============================================

export async function editImageWithConversationGemini(
  params: ConversationEditParams
): Promise<GenerateImageResult> {
  const model = params.model || DEFAULT_MODEL;
  const imageConfig = buildImageConfig(params.aspectRatio, params.imageSize);

  logger.ai.info(
    `[Gemini] Conversation edit [model=${model}, messageCount=${params.messages.length}]`
  );

  // Build multi-turn contents
  const contents: Array<Record<string, unknown>> = [];

  for (const msg of params.messages) {
    let parts: Array<Record<string, unknown>> = [];

    try {
      parts = await buildConversationMessageParts(msg, params.signal);
    } catch (error) {
      logger.ai.warn(
        `[Gemini] Failed to build conversation message, skipping [role=${msg.role}]`,
        { error: error instanceof Error ? error.message : String(error) }
      );
    }

    if (parts.length > 0) {
      contents.push({ role: msg.role, parts });
    }
  }

  if (contents.length === 0) {
    return { success: false, error: '没有有效的对话内容' };
  }

  const hasUserMessage = contents.some((c) => c.role === 'user');
  if (!hasUserMessage) {
    return { success: false, error: '没有用户消息' };
  }

  const requestBody: Record<string, unknown> = {
    contents,
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig,
    },
  };

  return callGeminiApi(model, requestBody, params.signal);
}
