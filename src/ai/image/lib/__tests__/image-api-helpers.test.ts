import { beforeEach, describe, expect, it, vi } from 'vitest';
import { executeImageGeneration, verifyCredits } from '../image-api-helpers';

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

    expect(result.status).toBe(500);
    await expect(result.json()).resolves.toEqual({
      error: '积分校验失败，请稍后重试',
    });
  });

  it('returns 402 when credits are insufficient', async () => {
    mocks.hasEnoughCredits.mockResolvedValue(false);

    const result = await verifyCredits('user-1', 'forma', 'req-1');

    expect(result.status).toBe(402);
    await expect(result.json()).resolves.toEqual({
      error: '积分不足，请购买更多积分后继续',
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
