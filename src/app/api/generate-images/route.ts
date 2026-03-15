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
import {
  applyRateLimit,
  getRateLimitHeaders,
  getRateLimitIdentifier,
} from '@/lib/rate-limit';
import { type NextRequest, NextResponse } from 'next/server';

// Set maximum execution time for image generation (150 seconds)
export const maxDuration = 150;

export async function POST(req: NextRequest) {
  const requestId = generateRequestId();
  const {
    prompt,
    modelId,
    referenceImage,
    referenceImages,
    aspectRatio,
    imageSize,
    conversationHistory,
  } = (await req.json()) as GenerateImageRequest & {
    aspectRatio?: string;
    imageSize?: '1K' | '2K' | '4K';
    conversationHistory?: Array<{
      role: 'user' | 'model';
      content: string;
      image?: string;
    }>;
  };

  try {
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
      key: `generate-images:${ctx.userId}:${getRateLimitIdentifier(req.headers, ctx.userId)}`,
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
      });
    } else {
      // Text-to-image generation
      generatePromise = generateImageWithGemini({
        prompt,
        model: geminiModel,
        aspectRatio: geminiAspectRatio,
        imageSize: selectedImageSize,
      });
    }

    // Execute with timeout and credit consumption
    const result = await executeImageGeneration({
      ctx,
      generatePromise,
      operationType: 'generation',
      startstamp,
    });

    const response = createImageResponse(result);
    const rateLimitHeaders = getRateLimitHeaders(rateLimitResult);
    for (const [header, value] of Object.entries(rateLimitHeaders)) {
      response.headers.set(header, value);
    }

    return response;
  } catch (error) {
    return createErrorResponse(error, requestId, modelId, 'generation');
  }
}
