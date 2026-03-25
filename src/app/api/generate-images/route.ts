import { updateAssistantMessage } from '@/actions/project-message';
import type { GenerateImageRequest } from '@/ai/image/lib/api-types';
import {
  generateRequestId,
  mapAspectRatioToGemini,
  mapModelIdToGeminiModel,
  validatePrompt,
} from '@/ai/image/lib/api-utils';
import {
  editImageWithConversationGemini,
  editImageWithGemini,
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
  validateReferenceImages,
} from '@/ai/image/lib/request-validation';
import { logger } from '@/lib/logger';
import { applyRateLimit, getRateLimitHeaders } from '@/lib/rate-limit';
import { type NextRequest, NextResponse } from 'next/server';

// Set maximum execution time for image generation (150 seconds)
export const maxDuration = 150;

export async function POST(req: NextRequest) {
  const requestId = generateRequestId();
  let resolvedModelId = 'unknown';
  let payload: GenerateImageRequest & {
    aspectRatio?: string;
    imageSize?: '1K' | '2K' | '4K';
    conversationHistory?: Array<{
      role: 'user' | 'model';
      content: string;
      image?: string;
    }>;
  };

  try {
    try {
      payload = (await req.json()) as GenerateImageRequest & {
        aspectRatio?: string;
        imageSize?: '1K' | '2K' | '4K';
        conversationHistory?: Array<{
          role: 'user' | 'model';
          content: string;
          image?: string;
        }>;
      };
    } catch (error) {
      logger.api.error(
        `Malformed JSON payload [requestId=${requestId}]`,
        error
      );
      return NextResponse.json({ error: '请求体格式错误' }, { status: 400 });
    }

    const {
      prompt,
      modelId,
      referenceImage,
      referenceImages,
      aspectRatio,
      imageSize,
      conversationHistory,
      projectId,
      assistantMessageId,
    } = payload;
    resolvedModelId = modelId;

    // Validate model ID
    if (!modelId) {
      const error = '缺少模型 ID';
      logger.api.error(`${error} [requestId=${requestId}]`);
      return NextResponse.json({ error }, { status: 400 });
    }

    // Validate prompt
    const promptValidation = validatePrompt(prompt);
    if (!promptValidation.valid) {
      logger.api.error(
        `Invalid prompt [requestId=${requestId}]: ${promptValidation.error}`
      );
      return NextResponse.json(
        { error: promptValidation.error },
        { status: 400 }
      );
    }

    const imageSizeValidation = resolveRequestedImageSize(
      imageSize,
      DEFAULT_IMAGE_QUALITY
    );
    if (!imageSizeValidation.valid) {
      logger.api.error(
        `Invalid imageSize [requestId=${requestId}]: ${imageSize}`
      );
      return NextResponse.json(
        { error: imageSizeValidation.error },
        { status: 400 }
      );
    }

    const referenceValidation = validateReferenceImages(
      referenceImage,
      referenceImages
    );
    if (!referenceValidation.valid) {
      return NextResponse.json(
        { error: referenceValidation.error },
        { status: 400 }
      );
    }

    // Validate conversation history payload
    if (conversationHistory) {
      const historyValidation =
        validateConversationMessages(conversationHistory);
      if (!historyValidation.valid) {
        return NextResponse.json(
          { error: historyValidation.error },
          { status: 400 }
        );
      }
    }

    // Verify session and credits
    const ctx = await verifyRequestContext(req.headers, modelId, requestId);
    if (ctx instanceof NextResponse) {
      return ctx;
    }

    const rateLimitResult = applyRateLimit({
      key: `generate-images:${ctx.userId}`,
      limit: 10,
      windowMs: 60 * 1000,
    });
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: '请求过于频繁，请稍后再试',
        },
        {
          status: 429,
          headers: getRateLimitHeaders(rateLimitResult),
        }
      );
    }

    const startstamp = performance.now();
    const geminiModel = mapModelIdToGeminiModel(modelId);
    const geminiAspectRatio = mapAspectRatioToGemini(aspectRatio);
    const selectedImageSize = imageSizeValidation.value;

    logger.api.info(
      `Starting image generation [requestId=${requestId}, userId=${ctx.userId}, model=${modelId}, geminiModel=${geminiModel}, creditCost=${ctx.creditCost}]`
    );

    // Collect all reference images (base64)
    const allReferenceImages = referenceImages?.length
      ? referenceImages
      : referenceImage
        ? [referenceImage]
        : [];

    // Build generation promise based on context
    let generatePromise: ReturnType<typeof generateImageWithGemini>;

    if (
      conversationHistory &&
      conversationHistory.length > 0 &&
      conversationHistory.some((m) => m.image)
    ) {
      // Multi-turn conversation mode with images
      // Gemini API supports inline_data directly - no S3 upload needed
      const messages = conversationHistory.map((msg) => ({
        role: msg.role,
        content: msg.content,
        image: msg.image,
      }));

      // Add current reference images to the latest user message if any
      if (allReferenceImages.length > 0) {
        const lastUserIdx = messages.findLastIndex((m) => m.role === 'user');
        if (lastUserIdx >= 0 && allReferenceImages[0]) {
          messages[lastUserIdx] = {
            ...messages[lastUserIdx],
            image: allReferenceImages[0],
          };
        }
      }

      logger.api.info(
        `[requestId=${requestId}] Using conversation mode with ${messages.length} messages`
      );

      generatePromise = editImageWithConversationGemini({
        messages,
        model: geminiModel,
        aspectRatio: geminiAspectRatio,
        imageSize: selectedImageSize,
        signal: req.signal,
      });
    } else if (allReferenceImages.length > 0) {
      // Image editing mode - pass base64 directly to Gemini API
      logger.api.info(
        `[requestId=${requestId}] Using edit API with ${allReferenceImages.length} reference images`
      );
      generatePromise = editImageWithGemini({
        prompt,
        referenceImages: allReferenceImages,
        model: geminiModel,
        aspectRatio: geminiAspectRatio,
        imageSize: selectedImageSize,
        signal: req.signal,
      });
    } else {
      // Text-to-image generation
      generatePromise = generateImageWithGemini({
        prompt,
        model: geminiModel,
        aspectRatio: geminiAspectRatio,
        imageSize: selectedImageSize,
        signal: req.signal,
      });
    }

    // Execute with timeout and credit consumption
    const result = await executeImageGeneration({
      ctx: {
        ...ctx,
        messageId: assistantMessageId,
      },
      generatePromise,
      operationType: 'generation',
      startstamp,
    });

    const rateLimitHeaders = getRateLimitHeaders(rateLimitResult);

    if (projectId && assistantMessageId) {
      if (req.signal.aborted) {
        return NextResponse.json(
          { error: '生成已取消' },
          { status: 499, headers: rateLimitHeaders }
        );
      }

      const generationTime = Math.round(performance.now() - startstamp);
      const persistedMessage = result.image
        ? await updateAssistantMessage(assistantMessageId, {
            content: result.text ?? '',
            outputImage: result.image,
            creditsUsed: result.creditsUsed,
            generationTime,
            status: 'completed',
            errorMessage: null,
          })
        : await updateAssistantMessage(assistantMessageId, {
            content: result.error || '生成失败',
            status: 'failed',
            errorMessage: result.error || '生成失败',
          });

      if (!persistedMessage.success || !persistedMessage.data) {
        logger.api.error(
          `Failed to persist assistant message from route [requestId=${requestId}, projectId=${projectId}, assistantMessageId=${assistantMessageId}]`,
          persistedMessage.error
        );
        return NextResponse.json(
          {
            error: persistedMessage.error || '保存生成结果失败',
          },
          {
            status: 500,
            headers: rateLimitHeaders,
          }
        );
      }

      return NextResponse.json(
        {
          message: {
            ...persistedMessage.data,
            createdAt:
              persistedMessage.data.createdAt instanceof Date
                ? persistedMessage.data.createdAt.toISOString()
                : new Date(persistedMessage.data.createdAt).toISOString(),
          },
          error: result.error,
          creditsUsed: result.creditsUsed,
        },
        {
          status: 200,
          headers: rateLimitHeaders,
        }
      );
    }

    const response = createImageResponse(result);
    for (const [header, value] of Object.entries(rateLimitHeaders)) {
      response.headers.set(header, value);
    }

    return response;
  } catch (error) {
    return createErrorResponse(error, requestId, resolvedModelId, 'generation');
  }
}
