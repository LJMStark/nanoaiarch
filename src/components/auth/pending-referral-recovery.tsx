'use client';

import { applyReferralCode } from '@/actions/referral';
import { logger } from '@/lib/logger';
import { startTransition, useEffect, useRef } from 'react';
import {
  clearPendingReferralCode,
  readPendingReferralCode,
} from './pending-referral-code';

const TERMINAL_REFERRAL_ERRORS = new Set([
  'Referral system is disabled',
  'Invalid referral code',
  'Cannot refer yourself',
  'User was already referred',
]);

function isTerminalReferralError(error?: string): boolean {
  return !!error && TERMINAL_REFERRAL_ERRORS.has(error);
}

export function PendingReferralRecovery() {
  const hasAttemptedRef = useRef(false);

  useEffect(() => {
    if (hasAttemptedRef.current) {
      return;
    }

    const code = readPendingReferralCode();
    if (!code) {
      return;
    }

    hasAttemptedRef.current = true;

    startTransition(() => {
      void applyReferralCode(code)
        .then((result) => {
          if (result.success || isTerminalReferralError(result.error)) {
            clearPendingReferralCode();
            return;
          }

          hasAttemptedRef.current = false;
        })
        .catch((error) => {
          logger.auth.error('pending referral recovery error', error);
          hasAttemptedRef.current = false;
        });
    });
  }, []);

  return null;
}
