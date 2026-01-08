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
  } = (await req.json()) as GenerateImageRequest & {
    aspectRatio?: string;
    imageSize?: '1K' | '2K' | '4K';
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
    const allReferenceImages: string[] = [];
    if (referenceImages && referenceImages.length > 0) {
      allReferenceImages.push(...referenceImages);
    } else if (referenceImage) {
      allReferenceImages.push(referenceImage);
    }

    // Build generation promise based on reference images
    let generatePromise: ReturnType<typeof generateImageWithDuomi>;

    if (allReferenceImages.length > 0) {
      // Upload base64 images to S3
      const imageUrls: string[] = [];
      for (let i = 0; i < allReferenceImages.length; i++) {
        const img = allReferenceImages[i];
        if (img.startsWith('http')) {
          imageUrls.push(img);
        } else {
          try {
            const url = await uploadBase64ToS3(img, i);
            imageUrls.push(url);
            logger.api.info(
              `[requestId=${requestId}] Uploaded reference image ${i + 1}/${allReferenceImages.length}`
            );
          } catch (uploadError) {
            logger.api.error(
              `[requestId=${requestId}] Failed to upload reference image ${i + 1}:`,
              uploadError
            );
          }
        }
      }

      if (imageUrls.length > 0) {
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
        // Fallback to text-to-image if all uploads failed
        logger.api.warn(
          `[requestId=${requestId}] All reference images failed to upload, falling back to text-to-image`
        );
        generatePromise = generateImageWithDuomi({
          prompt,
          model: duomiModel,
          aspectRatio: duomiAspectRatio,
          imageSize: selectedImageSize,
        });
      }
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
