import { DEFAULT_IMAGE_QUALITY } from '@/ai/image/components/ImageQualitySelect';
import type { GenerateImageRequest } from '@/ai/image/lib/api-types';
import {
  generateRequestId,
  mapAspectRatioToDuomi,
  mapModelIdToDuomiModel,
  validatePrompt,
} from '@/ai/image/lib/api-utils';
import {
  editImageWithDuomi,
  editImageWithConversationDuomi,
  generateImageWithDuomi,
} from '@/ai/image/lib/duomi-client';
import {
  createErrorResponse,
  createImageResponse,
  executeImageGeneration,
  verifyRequestContext,
} from '@/ai/image/lib/image-api-helpers';
import { logger } from '@/lib/logger';
import { uploadFile } from '@/storage';
import { type NextRequest, NextResponse } from 'next/server';

// Set maximum execution time for image generation (150 seconds)
// This allows enough time for Duomi API polling (max 110s) plus buffer
export const maxDuration = 150;

/**
 * Uploads a base64 image to S3 and returns the URL
 */
async function uploadBase64ToS3(
  base64: string,
  index: number
): Promise<string> {
  const buffer = Buffer.from(base64, 'base64');
  const result = await uploadFile(
    buffer,
    `ref-${Date.now()}-${index}.jpg`,
    'image/jpeg',
    'reference-images'
  );
  return result.url;
}

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
      const error = 'Model ID is required';
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

    // Validate imageSize
    const validImageSizes = ['1K', '2K', '4K'];
    if (imageSize && !validImageSizes.includes(imageSize)) {
      logger.api.error(
        `Invalid imageSize [requestId=${requestId}]: ${imageSize}`
      );
      return NextResponse.json(
        { error: 'Invalid image size. Must be 1K, 2K, or 4K' },
        { status: 400 }
      );
    }

    // Verify session and credits
    const ctx = await verifyRequestContext(req.headers, modelId, requestId);
    if (ctx instanceof NextResponse) {
      return ctx;
    }

    const startstamp = performance.now();
    const duomiModel = mapModelIdToDuomiModel(modelId);
    const duomiAspectRatio = mapAspectRatioToDuomi(aspectRatio);
    const selectedImageSize = imageSize || DEFAULT_IMAGE_QUALITY;

    logger.api.info(
      `Starting image generation [requestId=${requestId}, userId=${ctx.userId}, model=${modelId}, duomiModel=${duomiModel}, creditCost=${ctx.creditCost}]`
    );

    // Collect all reference images
    const allReferenceImages =
      referenceImages?.length ? referenceImages
      : referenceImage ? [referenceImage]
      : [];

    // Build generation promise based on reference images
    let generatePromise: ReturnType<typeof generateImageWithDuomi>;

    if (
      conversationHistory &&
      conversationHistory.length > 0 &&
      conversationHistory.some((m) => m.image)
    ) {
      // Multi-turn conversation mode: upload any base64 images in history to S3
      const processedMessages = await Promise.all(
        conversationHistory.map(async (msg, i) => {
          if (!msg.image) return msg;
          if (msg.image.startsWith('http')) return msg;
          // Upload base64 image to S3
          const url = await uploadBase64ToS3(msg.image, i);
          return { ...msg, image: url };
        })
      );

      // Also upload current reference images if any
      if (allReferenceImages.length > 0) {
        const uploadedRefs = await Promise.all(
          allReferenceImages.map(async (img, i) => {
            if (img.startsWith('http')) return img;
            return uploadBase64ToS3(img, i);
          })
        );
        // Add current reference images as part of the latest user message context
        const lastUserIdx = processedMessages.findLastIndex(
          (m) => m.role === 'user'
        );
        if (lastUserIdx >= 0 && uploadedRefs[0]) {
          processedMessages[lastUserIdx] = {
            ...processedMessages[lastUserIdx],
            image: uploadedRefs[0],
          };
        }
      }

      logger.api.info(
        `[requestId=${requestId}] Using conversation mode with ${processedMessages.length} messages`
      );

      generatePromise = editImageWithConversationDuomi({
        messages: processedMessages,
        model: duomiModel,
        aspectRatio: duomiAspectRatio,
        imageSize: selectedImageSize,
      });
    } else if (allReferenceImages.length > 0) {
      // Upload base64 images to S3 in parallel for better performance
      const uploadPromises = allReferenceImages.map((img, i) => {
        if (img.startsWith('http')) {
          return Promise.resolve({ success: true, url: img, index: i });
        }

        return uploadBase64ToS3(img, i)
          .then((url) => ({ success: true, url, index: i }))
          .catch((uploadError) => {
            logger.api.error(
              `[requestId=${requestId}] Failed to upload reference image ${i + 1}:`,
              uploadError
            );
            return {
              success: false,
              error:
                uploadError instanceof Error
                  ? uploadError.message
                  : 'Upload failed',
              index: i,
            };
          });
      });

      const uploadResults = await Promise.all(uploadPromises);

      // Separate successful and failed uploads
      const successfulUploads = uploadResults.filter(
        (result): result is { success: true; url: string; index: number } =>
          result.success
      );
      const failedUploads = uploadResults.filter(
        (result): result is { success: false; error: string; index: number } =>
          !result.success
      );

      // Log upload summary
      logger.api.info(
        `[requestId=${requestId}] Upload summary: ${successfulUploads.length}/${allReferenceImages.length} successful`
      );

      if (successfulUploads.length === 0) {
        // All uploads failed
        logger.api.error(
          `[requestId=${requestId}] All reference images failed to upload`
        );
        return NextResponse.json(
          {
            error: 'Failed to upload reference images. Please try again.',
            details: failedUploads.map(
              (f) => `Image ${f.index + 1}: ${f.error}`
            ),
          },
          { status: 500 }
        );
      }

      // Warn about partial failures
      if (failedUploads.length > 0) {
        logger.api.warn(
          `[requestId=${requestId}] Partial upload failure: ${failedUploads.length} images failed`,
          { failedIndices: failedUploads.map((f) => f.index) }
        );
      }

      const imageUrls = successfulUploads.map((r) => r.url);

      logger.api.info(
        `[requestId=${requestId}] Using edit API with ${imageUrls.length} reference images`
      );
      generatePromise = editImageWithDuomi({
        prompt,
        imageUrls,
        model: duomiModel,
        aspectRatio: duomiAspectRatio,
        imageSize: selectedImageSize,
      });
    } else {
      // Text-to-image generation
      generatePromise = generateImageWithDuomi({
        prompt,
        model: duomiModel,
        aspectRatio: duomiAspectRatio,
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

    return createImageResponse(result);
  } catch (error) {
    return createErrorResponse(error, requestId, modelId, 'generation');
  }
}
