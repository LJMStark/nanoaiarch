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
