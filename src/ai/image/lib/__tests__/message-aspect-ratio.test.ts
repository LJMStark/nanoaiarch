import {
  getGenerationAspectRatioId,
  getGenerationCssAspectRatio,
} from '@/ai/image/lib/message-aspect-ratio';
import { describe, expect, it } from 'vitest';

describe('message aspect ratio helpers', () => {
  it('returns the stored generation aspect ratio as CSS aspect ratio', () => {
    expect(
      getGenerationCssAspectRatio(JSON.stringify({ aspectRatio: '16:9' }))
    ).toBe('16 / 9');
  });

  it('falls back to square for auto, missing, or invalid params', () => {
    expect(
      getGenerationAspectRatioId(JSON.stringify({ aspectRatio: 'auto' }))
    ).toBe('auto');
    expect(getGenerationCssAspectRatio(null)).toBe('1 / 1');
    expect(getGenerationCssAspectRatio('{bad json')).toBe('1 / 1');
    expect(
      getGenerationCssAspectRatio(JSON.stringify({ aspectRatio: '21:9' }))
    ).toBe('1 / 1');
  });
});
