import type { EditImageRequest } from '@/ai/image/lib/api-types';
import {
  TIMEOUT_MILLIS,
  generateRequestId,
  mapModelIdToGeminiKey,
  withTimeout,
} from '@/ai/image/lib/api-utils';
import { getCreditCost } from '@/ai/image/lib/credit-costs';
import { editImageWithConversation } from '@/ai/image/lib/gemini-client';
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

    const geminiModelKey = mapModelIdToGeminiKey(modelId);
    const startstamp = performance.now();

    logger.api.info(
      `Starting image edit [requestId=${requestId}, userId=${userId}, model=${modelId}, messageCount=${messages.length}, creditCost=${creditCost}]`
    );

    // 使用对话式编辑
    const editPromise = editImageWithConversation({
      messages: messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
        image: msg.image,
      })),
      modelKey: geminiModelKey,
    }).then(async (result) => {
      const elapsed = ((performance.now() - startstamp) / 1000).toFixed(1);

      if (result.success && result.image) {
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
          image: result.image,
          text: result.text,
          creditsUsed: creditCost,
        };
      }

      logger.api.error(
        `Image edit failed [requestId=${requestId}, model=${modelId}, elapsed=${elapsed}s]: ${result.error}`
      );
      return {
        error: result.error || 'Failed to edit image',
      };
    });

    const result = await withTimeout(editPromise, TIMEOUT_MILLIS);

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
