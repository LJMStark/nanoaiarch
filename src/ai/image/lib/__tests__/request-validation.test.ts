import { describe, expect, it } from 'vitest';
import {
  resolveRequestedImageSize,
  validateConversationMessages,
} from '../request-validation';

describe('resolveRequestedImageSize', () => {
  it('returns the provided valid image size', () => {
    expect(resolveRequestedImageSize('2K', '1K')).toEqual({
      valid: true,
      value: '2K',
    });
  });

  it('rejects unsupported image sizes', () => {
    expect(resolveRequestedImageSize('8K', '1K')).toEqual({
      valid: false,
      error: '无效的图片尺寸，必须为 1K、2K 或 4K',
    });
  });

  it('falls back to the configured default when omitted', () => {
    expect(resolveRequestedImageSize(undefined, '4K')).toEqual({
      valid: true,
      value: '4K',
    });
  });
});

describe('validateConversationMessages', () => {
  it('accepts valid multi-turn history with optional image URLs', () => {
    expect(
      validateConversationMessages([
        {
          role: 'user',
          content: 'Make it warmer',
        },
        {
          role: 'model',
          content: 'Sure',
          image: 'https://example.com/image.png',
        },
      ])
    ).toEqual({ valid: true });
  });

  it('rejects invalid roles', () => {
    expect(
      validateConversationMessages([
        {
          role: 'assistant',
          content: 'bad',
        } as never,
      ])
    ).toEqual({
      valid: false,
      error: '第 1 条对话消息角色无效',
    });
  });
});
