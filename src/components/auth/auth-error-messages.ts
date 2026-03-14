type TranslateFn = (key: any) => string;

function normalizeMessage(message?: string | null): string {
  return message?.trim().toLowerCase() ?? '';
}

function isRateLimited(status?: number, message?: string | null): boolean {
  const normalizedMessage = normalizeMessage(message);

  return (
    status === 429 ||
    normalizedMessage.includes('too many') ||
    normalizedMessage.includes('rate limit')
  );
}

export function getLoginErrorMessage<TTranslate extends TranslateFn>(
  status: number | undefined,
  message: string | null | undefined,
  t: TTranslate
): string {
  const normalizedMessage = normalizeMessage(message);

  if (
    status === 401 ||
    normalizedMessage.includes('invalid email or password') ||
    normalizedMessage.includes('invalid credentials') ||
    normalizedMessage.includes('invalid password')
  ) {
    return t('invalidCredentials' as Parameters<TTranslate>[0]);
  }

  if (
    (status === 403 && normalizedMessage.includes('verified')) ||
    normalizedMessage.includes('email not verified') ||
    normalizedMessage.includes('verify your email')
  ) {
    return t('emailNotVerified' as Parameters<TTranslate>[0]);
  }

  if (isRateLimited(status, message)) {
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
    normalizedError.includes('access_denied') ||
    normalizedError.includes('cancel')
  ) {
    return t('socialLoginCancelled' as Parameters<TTranslate>[0]);
  }

  return t('socialLoginFailed' as Parameters<TTranslate>[0]);
}

export function getForgotPasswordErrorMessage<TTranslate extends TranslateFn>(
  status: number | undefined,
  message: string | null | undefined,
  t: TTranslate
): string {
  const normalizedMessage = normalizeMessage(message);

  if (
    normalizedMessage.includes('user not found') ||
    normalizedMessage.includes('no user found')
  ) {
    return t('emailNotFound' as Parameters<TTranslate>[0]);
  }

  if (isRateLimited(status, message)) {
    return t('tooManyRequests' as Parameters<TTranslate>[0]);
  }

  return t('requestFailed' as Parameters<TTranslate>[0]);
}

export function getResetPasswordErrorMessage<TTranslate extends TranslateFn>(
  status: number | undefined,
  message: string | null | undefined,
  t: TTranslate
): string {
  const normalizedMessage = normalizeMessage(message);

  if (
    normalizedMessage.includes('invalid token') ||
    normalizedMessage.includes('expired token') ||
    normalizedMessage.includes('token has expired')
  ) {
    return t('invalidToken' as Parameters<TTranslate>[0]);
  }

  if (isRateLimited(status, message)) {
    return t('tooManyRequests' as Parameters<TTranslate>[0]);
  }

  return t('resetFailed' as Parameters<TTranslate>[0]);
}
