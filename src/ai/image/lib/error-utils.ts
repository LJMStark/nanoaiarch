/**
 * Error Handling Utilities
 * Parse and format user-friendly error messages
 */

/**
 * Translation function type (compatible with next-intl)
 */
export type TranslationFunction = {
  (key: string): string;
  (key: string, values: unknown): string;
};

/**
 * Parse error and return user-friendly message
 * Accepts any function that can translate a key to a string
 */
export function parseErrorMessage<
  T extends (key: string, ...args: unknown[]) => string,
>(error: unknown, t: T): string {
  if (!(error instanceof Error)) {
    return t('errors.unexpected');
  }

  const msg = error.message.toLowerCase();

  // Check for common error patterns
  if (msg.includes('unauthorized') || msg.includes('sign in')) {
    return t('errors.signInAgain');
  }
  if (msg.includes('insufficient credits') || msg.includes('credits')) {
    return t('errors.insufficientCredits');
  }
  if (msg.includes('timeout') || msg.includes('timed out')) {
    return t('errors.timeout');
  }
  if (msg.includes('network') || msg.includes('fetch')) {
    return t('errors.network');
  }

  return error.message;
}

/**
 * Check if error is a network error
 */
export function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes('network') || msg.includes('fetch') || msg.includes('timeout')
  );
}

/**
 * Check if error is an auth error
 */
export function isAuthError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return msg.includes('unauthorized') || msg.includes('sign in');
}

/**
 * Check if error is a credits error
 */
export function isCreditsError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return msg.includes('insufficient credits') || msg.includes('credits');
}

/**
 * Error code for log aggregation. Keep this list narrow and stable so logs
 * can be grouped without bleeding internal details into the response body.
 */
export type GenerationErrorCode =
  | 'QUOTA_EXCEEDED'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'INTERNAL_ERROR';

export interface ClassifiedGenerationError {
  errorCode: GenerationErrorCode;
  /** User-facing Chinese message safe to persist + return to the client. */
  userMessage: string;
}

/**
 * Classify an unknown thrown error from the image-generation pipeline into a
 * safe user message plus a coarse error code for log aggregation.
 *
 * IMPORTANT: the raw `error.message` may contain stack frames, third-party
 * API paths, or model identifiers. Only the returned `userMessage` is safe to
 * persist to `projectMessage.errorMessage` (which is later replayed to the
 * browser). Always log the original error separately on the server.
 */
export function classifyGenerationError(
  error: unknown
): ClassifiedGenerationError {
  const rawMessage = error instanceof Error ? error.message : String(error);
  const rawName = error instanceof Error ? error.name : '';
  const msg = rawMessage.toLowerCase();
  const name = rawName.toLowerCase();

  // Status codes occasionally appear on fetch-style errors (e.g. `{ status: 429 }`).
  const status =
    typeof error === 'object' && error !== null && 'status' in error
      ? Number((error as { status?: unknown }).status)
      : Number.NaN;

  // Cancellation is handled by callers via the "Generation cancelled" sentinel
  // before reaching this helper, so we don't special-case AbortError here
  // beyond mapping it to TIMEOUT (a stray abort that escapes the cancel path
  // is closer to a timeout than an internal bug).
  if (
    name === 'aborterror' ||
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('etimedout')
  ) {
    return {
      errorCode: 'TIMEOUT',
      userMessage: '生成超时，请重试',
    };
  }

  if (
    status === 429 ||
    msg.includes('rate limit') ||
    msg.includes('rate-limit') ||
    msg.includes('too many requests')
  ) {
    return {
      errorCode: 'RATE_LIMITED',
      userMessage: '当前请求过多，请稍后重试',
    };
  }

  if (
    msg.includes('insufficient credits') ||
    msg.includes('insufficient_quota') ||
    msg.includes('quota exceeded') ||
    msg.includes('quota_exceeded') ||
    msg.includes('quota')
  ) {
    return {
      errorCode: 'QUOTA_EXCEEDED',
      userMessage: '生成额度不足，请明天再试或购买积分',
    };
  }

  if (
    msg.includes('econnrefused') ||
    msg.includes('econnreset') ||
    msg.includes('enotfound') ||
    msg.includes('fetch failed') ||
    msg.includes('network') ||
    msg.includes('socket hang up')
  ) {
    return {
      errorCode: 'NETWORK_ERROR',
      userMessage: '网络异常，请检查后重试',
    };
  }

  return {
    errorCode: 'INTERNAL_ERROR',
    userMessage: '生成失败，请重试',
  };
}
