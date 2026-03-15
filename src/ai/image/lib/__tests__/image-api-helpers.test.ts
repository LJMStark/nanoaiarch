import { beforeEach, describe, expect, it, vi } from 'vitest';
import { executeImageGeneration } from '../image-api-helpers';

const mocks = vi.hoisted(() => ({
  consumeCredits: vi.fn(),
  holdCredits: vi.fn(),
  confirmHold: vi.fn(),
  releaseHold: vi.fn(),
  uploadGeneratedImage: vi.fn(),
}));

vi.mock('@/credits/credits', () => ({
  consumeCredits: mocks.consumeCredits,
  hasEnoughCredits: vi.fn(),
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
