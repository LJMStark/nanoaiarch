import { beforeEach, describe, expect, it, vi } from 'vitest';
import { executeImageGeneration } from '../image-api-helpers';

const mocks = vi.hoisted(() => ({
  consumeCredits: vi.fn(),
  uploadGeneratedImage: vi.fn(),
}));

vi.mock('@/credits/credits', () => ({
  consumeCredits: mocks.consumeCredits,
  hasEnoughCredits: vi.fn(),
}));

vi.mock('@/ai/image/lib/image-storage', () => ({
  uploadGeneratedImage: mocks.uploadGeneratedImage,
}));

describe('executeImageGeneration', () => {
  const ctx = {
    requestId: 'req-1',
    userId: 'user-1',
    modelId: 'forma',
    creditCost: 1,
  };

  beforeEach(() => {
    mocks.consumeCredits.mockReset();
    mocks.uploadGeneratedImage.mockReset();
  });

  it('returns error and skips upload when credit consumption fails', async () => {
    mocks.consumeCredits.mockRejectedValue(new Error('credit-failure'));

    const result = await executeImageGeneration({
      ctx,
      generatePromise: Promise.resolve({ success: true, image: 'base64-image' }),
      operationType: 'generation',
      startstamp: performance.now(),
    });

    expect(result.error).toBe('Failed to process credits. Please try again.');
    expect(mocks.uploadGeneratedImage).not.toHaveBeenCalled();
  });

  it('returns uploaded image URL when generation and billing succeed', async () => {
    mocks.consumeCredits.mockResolvedValue(undefined);
    mocks.uploadGeneratedImage.mockResolvedValue('https://cdn.example.com/gen.png');

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
  });
});
