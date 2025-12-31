import { DEFAULT_IMAGE_QUALITY } from '@/ai/image/components/ImageQualitySelect';
import type { GenerateImageRequest } from '@/ai/image/lib/api-types';
import {
  TIMEOUT_MILLIS,
  generateRequestId,
  mapAspectRatioToDuomi,
  mapModelIdToDuomiModel,
  validatePrompt,
  withTimeout,
} from '@/ai/image/lib/api-utils';
import { getCreditCost } from '@/ai/image/lib/credit-costs';
import {
  editImageWithDuomi,
  generateImageWithDuomi,
} from '@/ai/image/lib/duomi-client';
import type { GeminiModelId } from '@/ai/image/lib/provider-config';
import { consumeCredits, hasEnoughCredits } from '@/credits/credits';
import { auth } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { uploadFile } from '@/storage';
import { type NextRequest, NextResponse } from 'next/server';

/**
 * 将 base64 图片上传到 S3 获取 URL
 */
async function uploadBase64ToS3(
  base64: string,
  index: number
): Promise<string> {
  // 转换 base64 为 Buffer
  const buffer = Buffer.from(base64, 'base64');

  // 上传到 S3
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
    // 验证请求参数
    if (!modelId) {
      const error = 'Model ID is required';
      logger.api.error(`${error} [requestId=${requestId}]`);
      return NextResponse.json({ error }, { status: 400 });
    }

    // 验证 prompt
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

    // 验证 imageSize
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

    // 验证用户身份
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session?.user?.id) {
      logger.api.error(`Unauthorized request [requestId=${requestId}]`);
      return NextResponse.json(
        { error: 'Please sign in to generate images' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // 计算所需 credits 并检查余额
    const creditCost = getCreditCost(modelId as GeminiModelId);
    const hasCredits = await hasEnoughCredits({
      userId,
      requiredCredits: creditCost,
    });

    if (!hasCredits) {
      logger.api.error(
        `Insufficient credits [requestId=${requestId}, userId=${userId}, required=${creditCost}]`
      );
      return NextResponse.json(
        {
          error:
            'Insufficient credits. Please purchase more credits to continue.',
        },
        { status: 402 }
      );
    }

    const startstamp = performance.now();
    const duomiModel = mapModelIdToDuomiModel(modelId);
    const duomiAspectRatio = mapAspectRatioToDuomi(aspectRatio);

    logger.api.info(
      `Starting image generation [requestId=${requestId}, userId=${userId}, model=${modelId}, duomiModel=${duomiModel}, creditCost=${creditCost}]`
    );

    // 根据是否有参考图选择生成方式
    let generatePromise: Promise<{
      success: boolean;
      image?: string;
      text?: string;
      error?: string;
    }>;

    const selectedImageSize = imageSize || DEFAULT_IMAGE_QUALITY;

    // 收集所有参考图（支持单图和多图）
    const allReferenceImages: string[] = [];
    if (referenceImages && referenceImages.length > 0) {
      allReferenceImages.push(...referenceImages);
    } else if (referenceImage) {
      allReferenceImages.push(referenceImage);
    }

    if (allReferenceImages.length > 0) {
      // 有参考图时使用图片编辑 API
      // 将所有 base64 图片上传到 S3 获取 URL
      const imageUrls: string[] = [];

      for (let i = 0; i < allReferenceImages.length; i++) {
        const img = allReferenceImages[i];
        if (img.startsWith('http')) {
          imageUrls.push(img);
        } else {
          // base64 格式，上传到 S3
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
            // 继续处理其他图片
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
        // 所有图片上传失败，回退到文生图
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
      // 无参考图时使用文生图 API
      generatePromise = generateImageWithDuomi({
        prompt,
        model: duomiModel,
        aspectRatio: duomiAspectRatio,
        imageSize: selectedImageSize,
      });
    }

    const result = await withTimeout(
      generatePromise.then(async (genResult) => {
        const elapsed = ((performance.now() - startstamp) / 1000).toFixed(1);

        if (genResult.success && genResult.image) {
          // 生成成功后消耗 credits
          try {
            await consumeCredits({
              userId,
              amount: creditCost,
              description: `Image generation: ${modelId}`,
            });
            logger.api.info(
              `Consumed ${creditCost} credits [requestId=${requestId}, userId=${userId}]`
            );
          } catch (creditError) {
            logger.api.error(
              `Failed to consume credits [requestId=${requestId}, userId=${userId}]: `,
              creditError
            );
            // 即使扣费失败也返回图片，但记录错误（避免用户体验受影响）
          }

          logger.api.info(
            `Completed image request [requestId=${requestId}, model=${modelId}, elapsed=${elapsed}s]`
          );
          return {
            image: genResult.image,
            text: genResult.text,
            creditsUsed: creditCost,
          };
        }

        logger.api.error(
          `Image generation failed [requestId=${requestId}, model=${modelId}, elapsed=${elapsed}s]: ${genResult.error}`
        );
        return {
          error: genResult.error || 'Failed to generate image',
        };
      }),
      TIMEOUT_MILLIS
    );

    return NextResponse.json(result, {
      status: 'image' in result && result.image ? 200 : 500,
    });
  } catch (error) {
    // 记录完整错误详情，但返回通用错误消息以避免泄露敏感信息
    logger.api.error(
      `Error generating image [requestId=${requestId}, model=${modelId}]: `,
      error
    );
    return NextResponse.json(
      {
        error: 'Failed to generate image. Please try again later.',
      },
      { status: 500 }
    );
  }
}
