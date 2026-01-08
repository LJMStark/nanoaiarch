import { getCreditCost } from '@/ai/image/lib/credit-costs';
import {
  DUOMI_MODELS,
  type GeminiModelId,
} from '@/ai/image/lib/provider-config';
import { consumeCredits, hasEnoughCredits } from '@/credits/credits';
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
      { error: 'Please sign in to use this feature' },
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
        error:
          'Insufficient credits. Please purchase more credits to continue.',
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
      { error: 'Invalid model ID. Please select a valid model.' },
      { status: 400 }
    );
  }

  // Verify session
  const sessionResult = await verifySession(headers, requestId);
  if (sessionResult instanceof NextResponse) {
    return sessionResult;
  }

  const { userId } = sessionResult;

  // Verify credits
  const creditResult = await verifyCredits(userId, modelId, requestId);
  if (creditResult instanceof NextResponse) {
    return creditResult;
  }

  return {
    requestId,
    userId,
    modelId,
    creditCost: creditResult.creditCost,
  };
}

/**
 * Consumes credits for a successful operation
 * Logs errors but doesn't throw (to not affect user experience)
 */
export async function consumeImageCredits(
  ctx: ApiContext,
  description: string
): Promise<void> {
  try {
    await consumeCredits({
      userId: ctx.userId,
      amount: ctx.creditCost,
      description,
    });
    logger.api.info(
      `Consumed ${ctx.creditCost} credits [requestId=${ctx.requestId}, userId=${ctx.userId}]`
    );
  } catch (error) {
    // Log error with enough context for monitoring/alerting
    logger.api.error(
      `Failed to consume credits [requestId=${ctx.requestId}, userId=${ctx.userId}, amount=${ctx.creditCost}]`,
      error
    );
  }
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
 * Executes image generation with timeout, credit consumption, and logging
 * Returns the result for NextResponse
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
  return withTimeout(
    generatePromise.then(async (genResult) => {
      const elapsed = ((performance.now() - startstamp) / 1000).toFixed(1);

      if (genResult.success && genResult.image) {
        // Consume credits on success
        await consumeImageCredits(
          ctx,
          `Image ${operationType}: ${ctx.modelId}`
        );

        logger.api.info(
          `Completed image ${operationType} [requestId=${ctx.requestId}, model=${ctx.modelId}, elapsed=${elapsed}s]`
        );
        return {
          image: genResult.image,
          text: genResult.text,
          creditsUsed: ctx.creditCost,
        };
      }

      logger.api.error(
        `Image ${operationType} failed [requestId=${ctx.requestId}, model=${ctx.modelId}, elapsed=${elapsed}s]: ${genResult.error}`
      );
      return {
        error:
          genResult.error ||
          `Failed to ${operationType === 'edit' ? 'edit' : 'generate'} image`,
      };
    }),
    TIMEOUT_MILLIS
  );
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
      error: `Failed to ${operationType === 'edit' ? 'edit' : 'generate'} image. Please try again later.`,
    },
    { status: 500 }
  );
}

/**
 * Creates a standardized success/error response based on result
 */
export function createImageResponse(result: {
  image?: string;
  text?: string;
  error?: string;
  creditsUsed?: number;
}): NextResponse {
  return NextResponse.json(result, {
    status: result.image ? 200 : 500,
  });
}
