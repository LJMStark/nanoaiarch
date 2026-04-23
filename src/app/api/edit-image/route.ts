import type { EditImageRequest } from '@/ai/image/lib/api-types';
import {
  generateRequestId,
  mapModelIdToGeminiModel,
  validatePrompt,
} from '@/ai/image/lib/api-utils';
import {
  editImageWithConversationGemini,
  generateImageWithGemini,
} from '@/ai/image/lib/gemini-client';
import {
  createErrorResponse,
  createImageResponse,
  executeImageGeneration,
  verifyRequestContext,
} from '@/ai/image/lib/image-api-helpers';
import { DEFAULT_IMAGE_QUALITY } from '@/ai/image/lib/image-constants';
import {
  resolveRequestedImageSize,
  validateConversationMessages,
} from '@/ai/image/lib/request-validation';
import { logger } from '@/lib/logger';
import { applyRateLimit, getRateLimitHeaders } from '@/lib/rate-limit';
import { type NextRequest, NextResponse } from 'next/server';

// Match generate-images route timeout for consistent behavior
export const maxDuration = 150;

/**
 * Conversational image editing API
 * Supports multi-turn conversation context for iterative image editing
 */
export async function POST(req: NextRequest) {
  const requestId = generateRequestId();
  let resolvedModelId = 'unknown';
  let payload: EditImageRequest & {
    imageSize?: string;
  };

  try {
    try {
      payload = (await req.json()) as EditImageRequest & {
        imageSize?: string;
      };
    } catch (error) {
      logger.api.error(
        `Malformed JSON payload [requestId=${requestId}]`,
        error
      );
      return NextResponse.json({ error: '请求体格式错误' }, { status: 400 });
    }

    const { messages, modelId, imageSize } = payload;
    resolvedModelId = modelId;

    // Validate request parameters
    if (!messages || messages.length === 0 || !modelId) {
      const error = '请求参数无效';
      logger.api.error(`${error} [requestId=${requestId}]`);
      return NextResponse.json({ error }, { status: 400 });
    }

    const conversationValidation = validateConversationMessages(messages);
    if (!conversationValidation.valid) {
      return NextResponse.json(
        { error: conversationValidation.error },
        { status: 400 }
      );
    }

    const imageSizeValidation = resolveRequestedImageSize(
      imageSize,
      DEFAULT_IMAGE_QUALITY
    );
    if (!imageSizeValidation.valid) {
      return NextResponse.json(
        { error: imageSizeValidation.error },
        { status: 400 }
      );
    }

    // Verify session and credits
    const ctx = await verifyRequestContext(req.headers, modelId, requestId);
    if (ctx instanceof NextResponse) {
      return ctx;
    }

    const rateLimitResult = await applyRateLimit({
      key: `edit-image:${ctx.userId}`,
      limit: 10,
      windowMs: 60 * 1000,
    });
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: '请求过于频繁，请稍后再试' },
        {
          status: 429,
          headers: getRateLimitHeaders(rateLimitResult),
        }
      );
    }

    const startstamp = performance.now();
    const geminiModel = mapModelIdToGeminiModel(modelId);
    const selectedImageSize = imageSizeValidation.value;

    logger.api.info(
      `Starting image edit [requestId=${requestId}, userId=${ctx.userId}, model=${modelId}, messageCount=${messages.length}, creditCost=${ctx.creditCost}]`
    );

    // Extract latest user message as prompt
    const userMessages = messages.filter((m) => m.role === 'user');
    if (userMessages.length === 0) {
      return NextResponse.json({ error: '没有用户消息' }, { status: 400 });
    }

    const latestUserMessage = userMessages[userMessages.length - 1];
    const prompt = latestUserMessage.content;
    const promptValidation = validatePrompt(prompt);
    if (!promptValidation.valid) {
      return NextResponse.json(
        { error: promptValidation.error || '无效的提示词' },
        { status: 400 }
      );
    }

    // Check if any messages contain images
    const hasImages = messages.some(
      (m) => m.image || (Array.isArray(m.images) && m.images.length > 0)
    );

    let editPromise: ReturnType<typeof editImageWithConversationGemini>;

    if (hasImages) {
      // Use conversation mode with images - pass directly to Gemini API
      editPromise = editImageWithConversationGemini({
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
          image: m.image,
          images: m.images,
        })),
        model: geminiModel,
        aspectRatio: 'auto',
        imageSize: selectedImageSize,
        signal: req.signal,
      });
    } else {
      // Fallback to text-to-image
      editPromise = generateImageWithGemini({
        prompt,
        model: geminiModel,
        aspectRatio: 'auto',
        imageSize: selectedImageSize,
        signal: req.signal,
      });
    }

    // Execute with timeout and credit consumption
    const result = await executeImageGeneration({
      ctx,
      generatePromise: editPromise,
      operationType: 'edit',
      startstamp,
    });

    return createImageResponse(result, getRateLimitHeaders(rateLimitResult));
  } catch (error) {
    return createErrorResponse(error, requestId, resolvedModelId, 'edit');
  }
}
