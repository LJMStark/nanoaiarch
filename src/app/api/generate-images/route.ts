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
import { type NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const requestId = generateRequestId();
  const { prompt, modelId, referenceImage, aspectRatio, imageSize } =
    (await req.json()) as GenerateImageRequest & {
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

    if (referenceImage) {
      // 有参考图时使用图片编辑 API
      // 注意：Duomi API 需要图片 URL，这里假设 referenceImage 已经是 URL
      // 如果是 base64，需要先上传到存储服务获取 URL
      const imageUrl = referenceImage.startsWith('http')
        ? referenceImage
        : `data:image/png;base64,${referenceImage}`;

      // 如果是 base64 格式，使用文生图 API（Duomi 编辑 API 需要 URL）
      if (!referenceImage.startsWith('http')) {
        logger.api.info(
          `[requestId=${requestId}] Reference image is base64, using text-to-image with enhanced prompt`
        );
        // 使用文生图，但在 prompt 中说明要参考图片风格
        generatePromise = generateImageWithDuomi({
          prompt,
          model: duomiModel,
          aspectRatio: duomiAspectRatio,
          imageSize: selectedImageSize,
        });
      } else {
        generatePromise = editImageWithDuomi({
          prompt,
          imageUrls: [imageUrl],
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
