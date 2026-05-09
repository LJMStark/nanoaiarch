import { getCreditCost } from '@/ai/image/lib/credit-costs';
import { uploadGeneratedImage } from '@/ai/image/lib/image-storage';
import {
  GEMINI_MODELS,
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
import type { GeminiConversationPart } from './workspace-types';

// Valid model IDs for validation
const VALID_MODEL_IDS: readonly string[] = GEMINI_MODELS;

// ============================================================================
// Types
// ============================================================================

export interface ApiContext {
  requestId: string;
  userId: string;
  modelId: string;
  creditCost: number;
  holdId?: string;
  messageId?: string;
}

export interface ImageGenerationResult {
  success: boolean;
  image?: string;
  text?: string;
  error?: string;
  modelResponseParts?: GeminiConversationPart[];
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
    return NextResponse.json({ error: '请登录后使用此功能' }, { status: 401 });
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
  let hasCredits: boolean;

  try {
    hasCredits = await hasEnoughCredits({
      userId,
      requiredCredits: creditCost,
    });
  } catch (error) {
    logger.api.error(
      `Failed to verify credits [requestId=${requestId}, userId=${userId}, required=${creditCost}]`,
      error
    );
    return NextResponse.json(
      {
        error: '积分校验失败，请稍后重试',
      },
      { status: 500 }
    );
  }

  if (!hasCredits) {
    logger.api.error(
      `Insufficient credits [requestId=${requestId}, userId=${userId}, required=${creditCost}]`
    );
    return NextResponse.json(
      {
        error: '积分不足，请购买更多积分后继续',
        errorCode: 'INSUFFICIENT_CREDITS',
        required: creditCost,
      },
      { status: 402 }
    );
  }

  return { creditCost };
}

/**
 * Build the idempotency key used for the credit hold.
 *
 * Prefer the assistant messageId when available. That gives recovery a stable
 * handle to find and release the hold for an orphaned generating message.
 * Falls back to the per-request UUID for paths that don't pass a messageId
 * (legacy/edge cases).
 */
export function buildGenerationHoldIdempotencyKey(
  messageId: string | undefined,
  requestId: string
): string {
  return messageId ? `gen-hold:${messageId}` : `img-gen-${requestId}`;
}

/**
 * Combined session and credit verification
 * Returns API context if valid, or NextResponse error
 */
export async function verifyRequestContext(
  headers: Headers,
  modelId: string,
  requestId: string,
  options?: { messageId?: string }
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
      idempotencyKey: buildGenerationHoldIdempotencyKey(
        options?.messageId,
        requestId
      ),
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
          errorCode: 'INSUFFICIENT_CREDITS',
          required: creditResult.creditCost,
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
 * Executes image generation with timeout, credit hold confirm/release,
 * and logging.
 *
 * Credits are held before generation starts (in verifyRequestContext).
 * On success the hold is confirmed; on any failure path it is released
 * (credits refunded). Hold lifecycle is tracked explicitly so we never
 * attempt to release a hold that has already transitioned to CONFIRMED —
 * that previously could surface as "invalid hold status" errors and risked
 * billing the user for a generation that returned an error response.
 *
 * Layout note: only the upstream generatePromise (network call to Gemini)
 * is wrapped in withTimeout. The post-processing steps (confirmHold, S3
 * upload) run outside the timeout race so they cannot be interrupted
 * mid-flight by a timeout firing.
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
  modelResponseParts?: GeminiConversationPart[];
}> {
  // Track the hold's lifecycle so each branch knows whether release is safe.
  // 'absent' covers the legacy code path that consumes credits directly
  // without a hold record.
  type HoldLifecycle = 'pending' | 'confirmed' | 'released' | 'absent';
  let holdState: HoldLifecycle = ctx.holdId ? 'pending' : 'absent';

  // Best-effort release that only fires if the hold is still pending.
  // Any error from the release itself is swallowed (logged) — once we are
  // already in a failure path, surfacing a secondary release error to the
  // user adds noise without changing the outcome.
  const safeRelease = async (
    reason: string,
    cause?: unknown
  ): Promise<void> => {
    if (holdState !== 'pending' || !ctx.holdId) return;
    try {
      await releaseHold(ctx.holdId);
      holdState = 'released';
    } catch (releaseError) {
      logger.api.error(
        `Failed to release credit hold (${reason}) [requestId=${ctx.requestId}, holdId=${ctx.holdId}, messageId=${ctx.messageId ?? 'n/a'}]`,
        releaseError
      );
    }
    if (cause) {
      logger.api.error(
        `Hold released after error [requestId=${ctx.requestId}, holdId=${ctx.holdId}]`,
        cause
      );
    }
  };

  let genResult: ImageGenerationResult;
  try {
    // Only the network round-trip is on the timeout clock.
    genResult = await withTimeout(generatePromise, TIMEOUT_MILLIS);
  } catch (timeoutOrError) {
    await safeRelease('after timeout/network error', timeoutOrError);
    throw timeoutOrError;
  }

  const elapsed = ((performance.now() - startstamp) / 1000).toFixed(1);

  if (!genResult.success || !genResult.image) {
    // Generation reported failure (or no image) — refund credits.
    await safeRelease('after generation failure');
    logger.api.error(
      `Image ${operationType} failed [requestId=${ctx.requestId}, model=${ctx.modelId}, elapsed=${elapsed}s, messageId=${ctx.messageId ?? 'n/a'}]: ${genResult.error}`
    );
    return {
      error:
        genResult.error ||
        `${operationType === 'edit' ? '编辑' : '生成'}图片失败`,
    };
  }

  // Generation succeeded. Confirm credits (or fall back to legacy consume).
  try {
    if (ctx.holdId) {
      await confirmHold(ctx.holdId);
      holdState = 'confirmed';
    } else {
      await consumeImageCredits(ctx, `Image ${operationType}: ${ctx.modelId}`);
    }
  } catch (creditError) {
    // Confirm failed — but it might have partially completed (transactional
    // failure mid-flight). safeRelease guards against double-release on a
    // hold that already transitioned to CONFIRMED.
    await safeRelease('after confirm failure', creditError);
    logger.api.error(
      `Failed to confirm credit hold [requestId=${ctx.requestId}, holdId=${ctx.holdId}, messageId=${ctx.messageId ?? 'n/a'}]`,
      creditError
    );
    return { error: '积分处理失败，请重试' };
  }

  // Upload the generated image to object storage. Failures fall back to the
  // raw base64 so the user still gets their image — credits already confirmed.
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
    `Completed image ${operationType} [requestId=${ctx.requestId}, model=${ctx.modelId}, elapsed=${elapsed}s, messageId=${ctx.messageId ?? 'n/a'}]`
  );
  return {
    image: imageData,
    text: genResult.text,
    creditsUsed: ctx.creditCost,
    modelResponseParts: genResult.modelResponseParts,
  };
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
