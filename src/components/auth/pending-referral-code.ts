const PENDING_REFERRAL_STORAGE_KEY = 'auth.pendingReferralCode';

function normalizeReferralCode(code?: string | null): string | undefined {
  const normalizedCode = code
    ?.trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

  return normalizedCode ? normalizedCode : undefined;
}

export function persistPendingReferralCode(
  code?: string | null
): string | undefined {
  if (typeof window === 'undefined') {
    return normalizeReferralCode(code);
  }

  const normalizedCode = normalizeReferralCode(code);
  if (!normalizedCode) {
    return undefined;
  }

  window.localStorage.setItem(PENDING_REFERRAL_STORAGE_KEY, normalizedCode);
  return normalizedCode;
}

export function readPendingReferralCode(): string | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  return normalizeReferralCode(
    window.localStorage.getItem(PENDING_REFERRAL_STORAGE_KEY)
  );
}

export function clearPendingReferralCode(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(PENDING_REFERRAL_STORAGE_KEY);
}
