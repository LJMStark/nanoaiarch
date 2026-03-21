type TranslateFn = (key: any) => string;

function normalizeMessage(value?: string | null): string {
  return (
    value?.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ') ??
    ''
  );
}

function matchesAuthErrorPattern(
  values: Array<string | null | undefined>,
  patterns: readonly string[]
): boolean {
  const normalizedValues = values
    .map((value) => normalizeMessage(value))
    .filter(Boolean);

  return normalizedValues.some((value) =>
    patterns.some((pattern) => value.includes(pattern))
  );
}

const HANDLED_AUTH_ERROR_PATTERNS = [
  'invalid email or password',
  'invalid credentials',
  'invalid password',
  'email not verified',
  'verify your email',
  'too many',
  'rate limit',
  'user not found',
  'no user found',
  'already exists',
  'already registered',
  'invalid token',
  'expired token',
  'token has expired',
  'oauthaccountnotlinked',
  'accessdenied',
  'access denied',
  'cancel',
] as const;

function isRateLimited(status?: number, message?: string | null): boolean {
  const normalizedMessage = normalizeMessage(message);

  return (
    status === 429 ||
    normalizedMessage.includes('too many') ||
    normalizedMessage.includes('rate limit')
  );
}

export function isHandledAuthClientError(
  status?: number,
  message?: string | null,
  code?: string | null
): boolean {
  const combinedMessage = `${message ?? ''} ${code ?? ''}`.trim();

  return (
    isRateLimited(status, combinedMessage) ||
    matchesAuthErrorPattern([message, code], HANDLED_AUTH_ERROR_PATTERNS)
  );
}

export function getLoginErrorMessage<TTranslate extends TranslateFn>(
  status: number | undefined,
  message: string | null | undefined,
  t: TTranslate,
  code?: string | null
): string {
  if (
    status === 401 ||
    matchesAuthErrorPattern(
      [message, code],
      ['invalid email or password', 'invalid credentials', 'invalid password']
    )
  ) {
    return t('invalidCredentials' as Parameters<TTranslate>[0]);
  }

  if (
    (status === 403 &&
      matchesAuthErrorPattern([message, code], ['verified', 'email'])) ||
    matchesAuthErrorPattern(
      [message, code],
      ['email not verified', 'verify your email']
    )
  ) {
    return t('emailNotVerified' as Parameters<TTranslate>[0]);
  }

  if (isRateLimited(status, `${message ?? ''} ${code ?? ''}`.trim())) {
    return t('tooManyAttempts' as Parameters<TTranslate>[0]);
  }

  return t('loginFailed' as Parameters<TTranslate>[0]);
}

export function getLoginCallbackErrorMessage<TTranslate extends TranslateFn>(
  error: string | null | undefined,
  t: TTranslate
): string | undefined {
  const normalizedError = normalizeMessage(error);

  if (!normalizedError) {
    return undefined;
  }

  if (normalizedError.includes('oauthaccountnotlinked')) {
    return t('socialAccountNotLinked' as Parameters<TTranslate>[0]);
  }

  if (
    normalizedError.includes('accessdenied') ||
    normalizedError.includes('access denied') ||
    normalizedError.includes('cancel')
  ) {
    return t('socialLoginCancelled' as Parameters<TTranslate>[0]);
  }

  return t('socialLoginFailed' as Parameters<TTranslate>[0]);
}

export function getForgotPasswordErrorMessage<TTranslate extends TranslateFn>(
  status: number | undefined,
  message: string | null | undefined,
  t: TTranslate,
  code?: string | null
): string {
  if (
    matchesAuthErrorPattern(
      [message, code],
      ['user not found', 'no user found']
    )
  ) {
    return t('emailNotFound' as Parameters<TTranslate>[0]);
  }

  if (isRateLimited(status, `${message ?? ''} ${code ?? ''}`.trim())) {
    return t('tooManyRequests' as Parameters<TTranslate>[0]);
  }

  return t('requestFailed' as Parameters<TTranslate>[0]);
}

export function getResetPasswordErrorMessage<TTranslate extends TranslateFn>(
  status: number | undefined,
  message: string | null | undefined,
  t: TTranslate,
  code?: string | null
): string {
  if (
    matchesAuthErrorPattern(
      [message, code],
      ['invalid token', 'expired token', 'token has expired']
    )
  ) {
    return t('invalidToken' as Parameters<TTranslate>[0]);
  }

  if (isRateLimited(status, `${message ?? ''} ${code ?? ''}`.trim())) {
    return t('tooManyRequests' as Parameters<TTranslate>[0]);
  }

  return t('resetFailed' as Parameters<TTranslate>[0]);
}
