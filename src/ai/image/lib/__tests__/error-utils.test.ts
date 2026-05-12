import { describe, expect, it } from 'vitest';
import { classifyGenerationError } from '../error-utils';

describe('classifyGenerationError', () => {
  it('maps quota/credits errors to QUOTA_EXCEEDED with safe Chinese message', () => {
    const result = classifyGenerationError(
      new Error('insufficient_quota: you have exceeded your monthly quota')
    );
    expect(result.errorCode).toBe('QUOTA_EXCEEDED');
    expect(result.userMessage).toBe('生成额度不足，请明天再试或购买积分');
  });

  it('maps 429 / rate limit errors to RATE_LIMITED', () => {
    const fromMessage = classifyGenerationError(
      new Error('Too Many Requests: rate limit exceeded')
    );
    expect(fromMessage.errorCode).toBe('RATE_LIMITED');
    expect(fromMessage.userMessage).toBe('当前请求过多，请稍后重试');

    const fromStatus = classifyGenerationError(
      Object.assign(new Error('boom'), { status: 429 })
    );
    expect(fromStatus.errorCode).toBe('RATE_LIMITED');
  });

  it('maps network errors to NETWORK_ERROR', () => {
    expect(classifyGenerationError(new Error('fetch failed')).errorCode).toBe(
      'NETWORK_ERROR'
    );
    expect(
      classifyGenerationError(new Error('connect ECONNREFUSED 127.0.0.1:443'))
        .errorCode
    ).toBe('NETWORK_ERROR');
    expect(classifyGenerationError(new Error('fetch failed')).userMessage).toBe(
      '网络异常，请检查后重试'
    );
  });

  it('maps timeouts and AbortError to TIMEOUT', () => {
    expect(
      classifyGenerationError(new Error('Operation timed out')).errorCode
    ).toBe('TIMEOUT');
    const abortError = new Error('aborted');
    abortError.name = 'AbortError';
    expect(classifyGenerationError(abortError).errorCode).toBe('TIMEOUT');
    expect(
      classifyGenerationError(new Error('Operation timed out')).userMessage
    ).toBe('生成超时，请重试');
  });

  it('falls back to INTERNAL_ERROR with generic Chinese message for unknown errors', () => {
    const result = classifyGenerationError(new Error('boom: stack trace leak'));
    expect(result.errorCode).toBe('INTERNAL_ERROR');
    expect(result.userMessage).toBe('生成失败，请重试');
    // The raw message must not be returned to callers.
    expect(result.userMessage).not.toContain('stack trace');
  });

  it('handles non-Error values without throwing', () => {
    expect(classifyGenerationError('plain string').errorCode).toBe(
      'INTERNAL_ERROR'
    );
    expect(classifyGenerationError(undefined).errorCode).toBe('INTERNAL_ERROR');
  });
});
