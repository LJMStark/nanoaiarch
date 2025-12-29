import type { GenerateImageRequest } from '@/ai/image/lib/api-types';
import {
  TIMEOUT_MILLIS,
  generateRequestId,
  mapModelIdToGeminiKey,
  validatePrompt,
  withTimeout,
} from '@/ai/image/lib/api-utils';
import { getCreditCost } from '@/ai/image/lib/credit-costs';
import { generateImageWithGemini } from '@/ai/image/lib/gemini-client';
import {
  type GeminiModelId,
  isVertexImagenModel,
} from '@/ai/image/lib/provider-config';
import { generateImageWithImagen } from '@/ai/image/lib/vertex-client';
import { consumeCredits, hasEnoughCredits } from '@/credits/credits';
import { auth } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { type NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const requestId = generateRequestId();
  const { prompt, modelId, referenceImage } =
    (await req.json()) as GenerateImageRequest;

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
    const isVertexModel = isVertexImagenModel(modelId);

    logger.api.info(
      `Starting image generation [requestId=${requestId}, userId=${userId}, model=${modelId}, isVertex=${isVertexModel}, creditCost=${creditCost}]`
    );

    // 根据模型类型选择不同的生成方法
    let generatePromise: Promise<{
      success: boolean;
      image?: string;
      text?: string;
      error?: string;
    }>;

    if (isVertexModel) {
      // 使用 Vertex AI Imagen 生成图像
      generatePromise = generateImageWithImagen({
        prompt,
        modelKey: 'nano-banana-pro',
        aspectRatio: '16:9',
      });
    } else {
      // 使用 Gemini 客户端生成图像
      const geminiModelKey = mapModelIdToGeminiKey(modelId);
      generatePromise = generateImageWithGemini({
        prompt,
        modelKey: geminiModelKey,
        referenceImage,
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
