import type { EditImageRequest } from '@/ai/image/lib/api-types';
import {
  TIMEOUT_MILLIS,
  generateRequestId,
  mapAspectRatioToDuomi,
  mapModelIdToDuomiModel,
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

/**
 * 对话式图像编辑 API
 * 支持多轮对话上下文，用于迭代编辑图像
 */
export async function POST(req: NextRequest) {
  const requestId = generateRequestId();
  const { messages, modelId } = (await req.json()) as EditImageRequest;

  try {
    // 验证请求参数
    if (!messages || messages.length === 0 || !modelId) {
      const error = 'Invalid request parameters';
      logger.api.error(`${error} [requestId=${requestId}]`);
      return NextResponse.json({ error }, { status: 400 });
    }

    // 验证用户身份
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session?.user?.id) {
      logger.api.error(`Unauthorized request [requestId=${requestId}]`);
      return NextResponse.json(
        { error: 'Please sign in to edit images' },
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

    const duomiModel = mapModelIdToDuomiModel(modelId);
    const startstamp = performance.now();

    logger.api.info(
      `Starting image edit [requestId=${requestId}, userId=${userId}, model=${modelId}, messageCount=${messages.length}, creditCost=${creditCost}]`
    );

    // 提取最新的用户消息作为 prompt
    const userMessages = messages.filter((m) => m.role === 'user');
    if (userMessages.length === 0) {
      return NextResponse.json(
        { error: 'No user message found' },
        { status: 400 }
      );
    }

    const latestUserMessage = userMessages[userMessages.length - 1];
    const prompt = latestUserMessage.content;

    // 收集所有图片 URL（从对话历史中）
    const imageUrls: string[] = [];
    for (const msg of messages) {
      if (msg.image && msg.image.startsWith('http')) {
        imageUrls.push(msg.image);
      }
    }

    // 选择生成方式
    let editPromise: Promise<{
      success: boolean;
      image?: string;
      text?: string;
      error?: string;
    }>;

    if (imageUrls.length > 0) {
      // 有图片 URL 时使用编辑 API
      const limitedImageUrls = imageUrls.slice(-5); // 限制最多 5 张
      editPromise = editImageWithDuomi({
        prompt,
        imageUrls: limitedImageUrls,
        model: duomiModel,
        aspectRatio: 'auto',
        imageSize: modelId === 'forma-pro' ? '2K' : '1K',
      });
    } else {
      // 没有图片 URL 时使用文生图 API
      editPromise = generateImageWithDuomi({
        prompt,
        model: duomiModel,
        aspectRatio: 'auto',
        imageSize: modelId === 'forma-pro' ? '2K' : '1K',
      });
    }

    const result = await withTimeout(
      editPromise.then(async (genResult) => {
        const elapsed = ((performance.now() - startstamp) / 1000).toFixed(1);

        if (genResult.success && genResult.image) {
          // 编辑成功后消耗 credits
          try {
            await consumeCredits({
              userId,
              amount: creditCost,
              description: `Image edit: ${modelId}`,
            });
            logger.api.info(
              `Consumed ${creditCost} credits [requestId=${requestId}, userId=${userId}]`
            );
          } catch (creditError) {
            logger.api.error(
              `Failed to consume credits [requestId=${requestId}, userId=${userId}]: `,
              creditError
            );
          }

          logger.api.info(
            `Completed image edit [requestId=${requestId}, model=${modelId}, elapsed=${elapsed}s]`
          );
          return {
            image: genResult.image,
            text: genResult.text,
            creditsUsed: creditCost,
          };
        }

        logger.api.error(
          `Image edit failed [requestId=${requestId}, model=${modelId}, elapsed=${elapsed}s]: ${genResult.error}`
        );
        return {
          error: genResult.error || 'Failed to edit image',
        };
      }),
      TIMEOUT_MILLIS
    );

    return NextResponse.json(result, {
      status: 'image' in result && result.image ? 200 : 500,
    });
  } catch (error) {
    logger.api.error(
      `Error editing image [requestId=${requestId}, model=${modelId}]: `,
      error
    );
    return NextResponse.json(
      {
        error: 'Failed to edit image. Please try again later.',
      },
      { status: 500 }
    );
  }
}
