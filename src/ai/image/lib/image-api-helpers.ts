import { getCreditCost } from '@/ai/image/lib/credit-costs';
import { uploadGeneratedImage } from '@/ai/image/lib/image-storage';
import {
  DUOMI_MODELS,
  type GeminiModelId,
} from '@/ai/image/lib/provider-config';
import {
  confirmHold,
  consumeCredits,
  hasEnoughCredits,
  holdCredits,
  releaseHold,
} from '@/credits/credits';
import { auth } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { NextResponse } from 'next/server';
import { TIMEOUT_MILLIS, withTimeout } from './api-utils';

// Valid model IDs for validation
const VALID_MODEL_IDS: readonly string[] = DUOMI_MODELS;

// ============================================================================
// Types
// ============================================================================

export interface ApiContext {
  requestId: string;
  userId: string;
  modelId: string;
  creditCost: number;
  holdId?: string;
}

export interface ImageGenerationResult {
  success: boolean;
  image?: string;
  text?: string;
  error?: string;
}

// ============================================================================
// Session Verification
// ============================================================================

/**
 * Verifies user session from request headers
 * Returns user ID if valid, or NextResponse error if invalid
 */
export async function verifySession(
  headers: Headers,
  requestId: string
): Promise<{ userId: string } | NextResponse> {
  const session = await auth.api.getSession({ headers });

  if (!session?.user?.id) {
    logger.api.error(`Unauthorized request [requestId=${requestId}]`);
    return NextResponse.json(
      { error: '请登录后使用此功能' },
      { status: 401 }
    );
  }

  return { userId: session.user.id };
}

// ============================================================================
// Credit Operations
// ============================================================================

/**
 * Checks if user has enough credits for the operation
 * Returns true if sufficient, or NextResponse error if insufficient
 */
export async function verifyCredits(
  userId: string,
  modelId: string,
  requestId: string
): Promise<{ creditCost: number } | NextResponse> {
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
        error: '积分不足，请购买更多积分后继续',
      },
      { status: 402 }
    );
  }

  return { creditCost };
}

/**
 * Combined session and credit verification
 * Returns API context if valid, or NextResponse error
 */
export async function verifyRequestContext(
  headers: Headers,
  modelId: string,
  requestId: string
): Promise<ApiContext | NextResponse> {
  // Validate modelId to prevent invalid model attacks
  if (!VALID_MODEL_IDS.includes(modelId)) {
    logger.api.error(
      `Invalid modelId [requestId=${requestId}, modelId=${modelId}]`
    );
    return NextResponse.json(
      { error: '无效的模型 ID，请选择有效模型' },
      { status: 400 }
    );
  }

  // Verify session
  const sessionResult = await verifySession(headers, requestId);
  if (sessionResult instanceof NextResponse) {
    return sessionResult;
  }

  const { userId } = sessionResult;

  // Verify credits (quick check before hold)
  const creditResult = await verifyCredits(userId, modelId, requestId);
  if (creditResult instanceof NextResponse) {
    return creditResult;
  }

  // Hold credits atomically with idempotency
  try {
    const hold = await holdCredits({
      userId,
      amount: creditResult.creditCost,
      idempotencyKey: `img-gen-${requestId}`,
      description: `Image generation hold: ${modelId}`,
    });

    return {
      requestId,
      userId,
      modelId,
      creditCost: creditResult.creditCost,
      holdId: hold.holdId,
    };
  } catch (holdError) {
    const message =
      holdError instanceof Error ? holdError.message : String(holdError);
    if (message.includes('Insufficient credits')) {
      return NextResponse.json(
        {
          error: '积分不足，请购买更多积分后继续',
        },
        { status: 402 }
      );
    }
    logger.api.error(
      `Failed to hold credits [requestId=${requestId}]`,
      holdError
    );
    return NextResponse.json(
      { error: '积分预扣失败，请重试' },
      { status: 500 }
    );
  }
}

/**
 * Consumes credits for a successful operation
 */
export async function consumeImageCredits(
  ctx: ApiContext,
  description: string
): Promise<void> {
  await consumeCredits({
    userId: ctx.userId,
    amount: ctx.creditCost,
    description,
  });
  logger.api.info(
    `Consumed ${ctx.creditCost} credits [requestId=${ctx.requestId}, userId=${ctx.userId}]`
  );
}

// ============================================================================
// Image Generation Wrapper
// ============================================================================

interface ExecuteGenerationOptions {
  ctx: ApiContext;
  generatePromise: Promise<ImageGenerationResult>;
  operationType: 'generation' | 'edit';
  startstamp: number;
}

/**
 * Executes image generation with timeout, credit hold confirm/release, and logging
 * Credits are held before generation starts (in verifyRequestContext).
 * On success: hold is confirmed. On failure: hold is released (credits refunded).
 */
export async function executeImageGeneration({
  ctx,
  generatePromise,
  operationType,
  startstamp,
}: ExecuteGenerationOptions): Promise<{
  image?: string;
  text?: string;
  error?: string;
  creditsUsed?: number;
}> {
  try {
    return await withTimeout(
      generatePromise.then(async (genResult) => {
        const elapsed = ((performance.now() - startstamp) / 1000).toFixed(1);

        if (genResult.success && genResult.image) {
          // Confirm the credit hold on success
          try {
            if (ctx.holdId) {
              await confirmHold(ctx.holdId);
            } else {
              // Fallback for legacy flow without hold
              await consumeImageCredits(
                ctx,
                `Image ${operationType}: ${ctx.modelId}`
              );
            }
          } catch (creditError) {
            logger.api.error(
              `Failed to confirm credit hold [requestId=${ctx.requestId}, holdId=${ctx.holdId}]`,
              creditError
            );
            return {
              error: '积分处理失败，请重试',
            };
          }

          // Upload generated image to object storage
          let imageData = genResult.image;
          try {
            const imageUrl = await uploadGeneratedImage(
              genResult.image,
              ctx.requestId,
              `gen-${Date.now()}`
            );
            imageData = imageUrl;
          } catch (uploadError) {
            logger.api.warn(
              `[requestId=${ctx.requestId}] Failed to upload generated image to storage, falling back to base64: ${uploadError instanceof Error ? uploadError.message : String(uploadError)}`
            );
          }

          logger.api.info(
            `Completed image ${operationType} [requestId=${ctx.requestId}, model=${ctx.modelId}, elapsed=${elapsed}s]`
          );
          return {
            image: imageData,
            text: genResult.text,
            creditsUsed: ctx.creditCost,
          };
        }

        // Generation failed - release the hold to refund credits
        if (ctx.holdId) {
          try {
            await releaseHold(ctx.holdId);
          } catch (releaseError) {
            logger.api.error(
              `Failed to release credit hold [requestId=${ctx.requestId}, holdId=${ctx.holdId}]`,
              releaseError
            );
          }
        }

        logger.api.error(
          `Image ${operationType} failed [requestId=${ctx.requestId}, model=${ctx.modelId}, elapsed=${elapsed}s]: ${genResult.error}`
        );
        return {
          error:
            genResult.error ||
            `${operationType === 'edit' ? '编辑' : '生成'}图片失败`,
        };
      }),
      TIMEOUT_MILLIS
    );
  } catch (timeoutOrError) {
    // Timeout or unexpected error - release the hold to refund credits
    if (ctx.holdId) {
      try {
        await releaseHold(ctx.holdId);
      } catch (releaseError) {
        logger.api.error(
          `Failed to release credit hold after timeout [requestId=${ctx.requestId}, holdId=${ctx.holdId}]`,
          releaseError
        );
      }
    }
    throw timeoutOrError;
  }
}

/**
 * Creates a standardized error response for API endpoints
 */
export function createErrorResponse(
  error: unknown,
  requestId: string,
  modelId: string,
  operationType: 'generation' | 'edit'
): NextResponse {
  logger.api.error(
    `Error ${operationType === 'edit' ? 'editing' : 'generating'} image [requestId=${requestId}, model=${modelId}]: `,
    error
  );
  return NextResponse.json(
    {
      error: `${operationType === 'edit' ? '编辑' : '生成'}图片失败，请稍后重试`,
    },
    { status: 500 }
  );
}

/**
 * Creates a standardized success/error response based on result
 */
export function createImageResponse(
  result: {
    image?: string;
    text?: string;
    error?: string;
    creditsUsed?: number;
  },
  headers?: HeadersInit
): NextResponse {
  return NextResponse.json(result, {
    status: result.image ? 200 : 500,
    headers,
  });
}
