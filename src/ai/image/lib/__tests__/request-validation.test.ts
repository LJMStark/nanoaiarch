import { beforeEach, describe, expect, it } from 'vitest';
import { validateBase64Image } from '../api-utils';
import {
  resolveRequestedImageSize,
  validateConversationMessages,
  validateReferenceImages,
} from '../request-validation';

const VALID_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';

describe('validateBase64Image', () => {
  beforeEach(() => {
    process.env.IMAGE_ALLOWED_FETCH_HOSTS = '';
    process.env.STORAGE_PUBLIC_URL = '';
    process.env.STORAGE_ENDPOINT = '';
  });

  it('accepts generated image URLs from the configured storage public host', () => {
    process.env.STORAGE_PUBLIC_URL = 'https://cdn.example.com/assets';

    expect(
      validateBase64Image('https://cdn.example.com/assets/generated/test.png')
    ).toEqual({ valid: true });
  });

  it('accepts generated image URLs from default remote host allowlists', () => {
    expect(
      validateBase64Image(
        'https://pub-example-assets.r2.dev/generated/test.png'
      )
    ).toEqual({ valid: true });
  });

  it('accepts generated image URLs from the app base url', () => {
    process.env.NEXT_PUBLIC_BASE_URL = 'https://nano.example.com';

    expect(
      validateBase64Image('https://nano.example.com/uploads/generated/test.png')
    ).toEqual({ valid: true });
  });

  it('rejects syntactically valid base64 that is not an image', () => {
    expect(validateBase64Image('A'.repeat(128))).toEqual({
      valid: false,
      error: '无效的图片数据',
      sizeBytes: 96,
    });
  });
});

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
  it('accepts valid multi-turn history with allowlisted image URLs', () => {
    process.env.IMAGE_ALLOWED_FETCH_HOSTS = 'example.com';
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

  it('rejects non-allowlisted image URLs', () => {
    process.env.IMAGE_ALLOWED_FETCH_HOSTS = 'assets.example.com';

    expect(
      validateConversationMessages([
        {
          role: 'user',
          content: 'bad',
          image: 'https://attacker.example/image.png',
        },
      ])
    ).toEqual({
      valid: false,
      error: '第 1 条对话消息图片来源未被允许',
    });
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

  it('accepts user messages with multiple images', () => {
    expect(
      validateConversationMessages([
        {
          role: 'user',
          content: '把这两张图融合',
          images: [VALID_PNG_BASE64, VALID_PNG_BASE64],
        },
      ])
    ).toEqual({ valid: true });
  });
});

describe('validateReferenceImages', () => {
  it('rejects more than 10 reference images', () => {
    expect(
      validateReferenceImages(
        undefined,
        Array.from({ length: 11 }, (_, index) => `image-${index}`)
      )
    ).toEqual({
      valid: false,
      error: '最多上传 10 张参考图',
    });
  });
});
