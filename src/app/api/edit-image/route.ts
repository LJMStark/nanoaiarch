import type { EditImageRequest } from '@/ai/image/lib/api-types';
import {
  generateRequestId,
  mapModelIdToDuomiModel,
} from '@/ai/image/lib/api-utils';
import {
  editImageWithDuomi,
  generateImageWithDuomi,
} from '@/ai/image/lib/duomi-client';
import {
  createErrorResponse,
  createImageResponse,
  executeImageGeneration,
  verifyRequestContext,
} from '@/ai/image/lib/image-api-helpers';
import { logger } from '@/lib/logger';
import { type NextRequest, NextResponse } from 'next/server';

/**
 * Conversational image editing API
 * Supports multi-turn conversation context for iterative image editing
 */
export async function POST(req: NextRequest) {
  const requestId = generateRequestId();
  const { messages, modelId } = (await req.json()) as EditImageRequest;

  try {
    // Validate request parameters
    if (!messages || messages.length === 0 || !modelId) {
      const error = 'Invalid request parameters';
      logger.api.error(`${error} [requestId=${requestId}]`);
      return NextResponse.json({ error }, { status: 400 });
    }

    // Verify session and credits
    const ctx = await verifyRequestContext(req.headers, modelId, requestId);
    if (ctx instanceof NextResponse) {
      return ctx;
    }

    const startstamp = performance.now();
    const duomiModel = mapModelIdToDuomiModel(modelId);

    logger.api.info(
      `Starting image edit [requestId=${requestId}, userId=${ctx.userId}, model=${modelId}, messageCount=${messages.length}, creditCost=${ctx.creditCost}]`
    );

    // Extract latest user message as prompt
    const userMessages = messages.filter((m) => m.role === 'user');
    if (userMessages.length === 0) {
      return NextResponse.json(
        { error: 'No user message found' },
        { status: 400 }
      );
    }

    const latestUserMessage = userMessages[userMessages.length - 1];
    const prompt = latestUserMessage.content;

    // Collect image URLs from conversation history
    const imageUrls: string[] = [];
    for (const msg of messages) {
      if (msg.image && msg.image.startsWith('http')) {
        imageUrls.push(msg.image);
      }
    }

    // Build generation promise
    let editPromise: ReturnType<typeof editImageWithDuomi>;

    if (imageUrls.length > 0) {
      // Use edit API with images (limit to 5 most recent)
      const limitedImageUrls = imageUrls.slice(-5);
      editPromise = editImageWithDuomi({
        prompt,
        imageUrls: limitedImageUrls,
        model: duomiModel,
        aspectRatio: 'auto',
        imageSize: '1K',
      });
    } else {
      // Fallback to text-to-image
      editPromise = generateImageWithDuomi({
        prompt,
        model: duomiModel,
        aspectRatio: 'auto',
        imageSize: '1K',
      });
    }

    // Execute with timeout and credit consumption
    const result = await executeImageGeneration({
      ctx,
      generatePromise: editPromise,
      operationType: 'edit',
      startstamp,
    });

    return createImageResponse(result);
  } catch (error) {
    return createErrorResponse(error, requestId, modelId, 'edit');
  }
}
