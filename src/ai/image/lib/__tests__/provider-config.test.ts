import { describe, expect, it } from 'vitest';
import { DEFAULT_MODEL, normalizeGeminiModelId } from '../provider-config';

describe('normalizeGeminiModelId', () => {
  it('keeps supported model ids unchanged', () => {
    expect(normalizeGeminiModelId('forma')).toBe('forma');
    expect(normalizeGeminiModelId('flash')).toBe('flash');
    expect(normalizeGeminiModelId('gpt-image-2')).toBe('gpt-image-2');
  });

  it('maps legacy and unknown model ids back to the default registry key', () => {
    expect(normalizeGeminiModelId('gemini-2.0-flash-exp')).toBe(DEFAULT_MODEL);
    expect(normalizeGeminiModelId('gemini-3-pro-image-preview')).toBe(
      DEFAULT_MODEL
    );
    expect(normalizeGeminiModelId(null)).toBe(DEFAULT_MODEL);
  });
});
