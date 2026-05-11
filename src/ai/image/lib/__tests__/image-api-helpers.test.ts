import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildGenerationHoldIdempotencyKey,
  executeImageGeneration,
  verifyCredits,
} from '../image-api-helpers';

const mocks = vi.hoisted(() => ({
  consumeCredits: vi.fn(),
  hasEnoughCredits: vi.fn(),
  holdCredits: vi.fn(),
  confirmHold: vi.fn(),
  releaseHold: vi.fn(),
  uploadGeneratedImage: vi.fn(),
}));

vi.mock('@/credits/credits', () => ({
  consumeCredits: mocks.consumeCredits,
  hasEnoughCredits: mocks.hasEnoughCredits,
  holdCredits: mocks.holdCredits,
  confirmHold: mocks.confirmHold,
  releaseHold: mocks.releaseHold,
}));

vi.mock('@/ai/image/lib/image-storage', () => ({
  uploadGeneratedImage: mocks.uploadGeneratedImage,
}));

describe('executeImageGeneration', () => {
  const baseCtx = {
    requestId: 'req-1',
    userId: 'user-1',
    modelId: 'forma',
    creditCost: 1,
  };

  beforeEach(() => {
    for (const fn of Object.values(mocks)) fn.mockReset();
  });

  it('returns 500 when credit verification fails unexpectedly', async () => {
    mocks.hasEnoughCredits.mockRejectedValue(new Error('db unavailable'));

    const result = await verifyCredits('user-1', 'forma', 'req-1');
    if (!('status' in result)) {
      throw new Error('Expected error response');
    }

    expect(result.status).toBe(500);
    await expect(result.json()).resolves.toEqual({
      error: '积分校验失败，请稍后重试',
    });
  });

  it('returns 402 when credits are insufficient', async () => {
    mocks.hasEnoughCredits.mockResolvedValue(false);

    const result = await verifyCredits('user-1', 'forma', 'req-1');
    if (!('status' in result)) {
      throw new Error('Expected error response');
    }

    expect(result.status).toBe(402);
    // Response now carries a structured error code + required-credits hint
    // so the client InsufficientCreditsModal can render specifics.
    await expect(result.json()).resolves.toEqual({
      error: '积分不足，请购买更多积分后继续',
      errorCode: 'INSUFFICIENT_CREDITS',
      required: expect.any(Number),
    });
  });

  // Legacy flow (no holdId) - backward compatibility
  it('returns error and skips upload when credit consumption fails (legacy)', async () => {
    mocks.consumeCredits.mockRejectedValue(new Error('credit-failure'));

    const result = await executeImageGeneration({
      ctx: baseCtx,
      generatePromise: Promise.resolve({
        success: true,
        image: 'base64-image',
      }),
      operationType: 'generation',
      startstamp: performance.now(),
    });

    expect(result.error).toBe('积分处理失败，请重试');
    expect(mocks.uploadGeneratedImage).not.toHaveBeenCalled();
  });

  // Hold flow tests
  describe('with holdId (pre-deduction flow)', () => {
    const ctx = { ...baseCtx, holdId: 'hold-123' };

    it('confirms hold on successful generation', async () => {
      mocks.confirmHold.mockResolvedValue(undefined);
      mocks.uploadGeneratedImage.mockResolvedValue(
        'https://cdn.example.com/gen.png'
      );

      const result = await executeImageGeneration({
        ctx,
        generatePromise: Promise.resolve({
          success: true,
          image: 'base64-image',
          text: 'ok',
        }),
        operationType: 'generation',
        startstamp: performance.now(),
      });

      expect(result.error).toBeUndefined();
      expect(result.image).toBe('https://cdn.example.com/gen.png');
      expect(result.creditsUsed).toBe(1);
      expect(mocks.confirmHold).toHaveBeenCalledWith('hold-123');
      expect(mocks.consumeCredits).not.toHaveBeenCalled();
    });

    it('keeps generated image URLs without re-uploading them', async () => {
      mocks.confirmHold.mockResolvedValue(undefined);

      const result = await executeImageGeneration({
        ctx,
        generatePromise: Promise.resolve({
          success: true,
          image: 'https://duomi.example.com/generated.png',
          text: 'ok',
        }),
        operationType: 'generation',
        startstamp: performance.now(),
      });

      expect(result.error).toBeUndefined();
      expect(result.image).toBe('https://duomi.example.com/generated.png');
      expect(result.creditsUsed).toBe(1);
      expect(mocks.confirmHold).toHaveBeenCalledWith('hold-123');
      expect(mocks.uploadGeneratedImage).not.toHaveBeenCalled();
    });

    it('releases hold when generation fails', async () => {
      mocks.releaseHold.mockResolvedValue(undefined);

      const result = await executeImageGeneration({
        ctx,
        generatePromise: Promise.resolve({
          success: false,
          error: 'API error',
        }),
        operationType: 'generation',
        startstamp: performance.now(),
      });

      expect(result.error).toBe('API error');
      expect(mocks.releaseHold).toHaveBeenCalledWith('hold-123');
      expect(mocks.confirmHold).not.toHaveBeenCalled();
    });

    it('returns error when confirmHold fails', async () => {
      mocks.confirmHold.mockRejectedValue(new Error('confirm-failure'));
      mocks.releaseHold.mockResolvedValue(undefined);

      const result = await executeImageGeneration({
        ctx,
        generatePromise: Promise.resolve({
          success: true,
          image: 'base64-image',
        }),
        operationType: 'generation',
        startstamp: performance.now(),
      });

      expect(result.error).toBe('积分处理失败，请重试');
      expect(mocks.uploadGeneratedImage).not.toHaveBeenCalled();
      expect(mocks.releaseHold).toHaveBeenCalledWith('hold-123');
    });

    it('swallows release errors after confirm failure (no double-throw)', async () => {
      // Reproduces the FINDING-C1 race: confirmHold throws after partially
      // succeeding (DB transaction committed but response timed out). Our
      // recovery path tries releaseHold, which now sees the hold as already
      // CONFIRMED and throws "invalid hold status". That secondary error
      // must not propagate to the user — they should see only the credit
      // processing message, not a stack trace.
      mocks.confirmHold.mockRejectedValue(new Error('confirm-network-fail'));
      mocks.releaseHold.mockRejectedValue(
        new Error('invalid hold status (confirmed)')
      );

      const result = await executeImageGeneration({
        ctx,
        generatePromise: Promise.resolve({
          success: true,
          image: 'base64-image',
        }),
        operationType: 'generation',
        startstamp: performance.now(),
      });

      expect(result.error).toBe('积分处理失败，请重试');
      // Release was attempted exactly once (not twice from outer + inner
      // catch as in the old structure).
      expect(mocks.releaseHold).toHaveBeenCalledTimes(1);
      expect(mocks.uploadGeneratedImage).not.toHaveBeenCalled();
    });

    it('does not release a confirmed hold even on subsequent errors', async () => {
      // After confirmHold succeeds, holdState transitions to 'confirmed'.
      // Any later error path must not re-attempt release (the user has
      // already been billed and the audit row is final).
      mocks.confirmHold.mockResolvedValue(undefined);
      mocks.releaseHold.mockResolvedValue(undefined);
      mocks.uploadGeneratedImage.mockRejectedValue(new Error('s3-down'));

      const result = await executeImageGeneration({
        ctx,
        generatePromise: Promise.resolve({
          success: true,
          image: 'base64-image',
        }),
        operationType: 'generation',
        startstamp: performance.now(),
      });

      // Upload fell back to base64; no release attempted.
      expect(result.image).toBe('base64-image');
      expect(mocks.releaseHold).not.toHaveBeenCalled();
    });
  });

  it('returns uploaded image URL when generation and billing succeed (legacy)', async () => {
    mocks.consumeCredits.mockResolvedValue(undefined);
    mocks.uploadGeneratedImage.mockResolvedValue(
      'https://cdn.example.com/gen.png'
    );

    const result = await executeImageGeneration({
      ctx: baseCtx,
      generatePromise: Promise.resolve({
        success: true,
        image: 'base64-image',
        text: 'ok',
      }),
      operationType: 'generation',
      startstamp: performance.now(),
    });

    expect(result.error).toBeUndefined();
    expect(result.image).toBe('https://cdn.example.com/gen.png');
    expect(result.creditsUsed).toBe(1);
  });
});

describe('buildGenerationHoldIdempotencyKey', () => {
  it('scopes message retries by attempt so a released hold does not block retry', () => {
    expect(
      buildGenerationHoldIdempotencyKey('assistant-1', 'req-1', 'attempt-1')
    ).toBe('gen-hold:assistant-1:attempt-1');
    expect(
      buildGenerationHoldIdempotencyKey('assistant-1', 'req-2', 'attempt-2')
    ).toBe('gen-hold:assistant-1:attempt-2');
  });

  it('falls back to request id for non-message generation paths', () => {
    expect(buildGenerationHoldIdempotencyKey(undefined, 'req-1')).toBe(
      'img-gen-req-1'
    );
  });

  it('falls back to request id when the client attempt id is unsafe', () => {
    expect(
      buildGenerationHoldIdempotencyKey('assistant-1', 'req-1', '../bad')
    ).toBe('gen-hold:assistant-1:req-1');
  });
});
