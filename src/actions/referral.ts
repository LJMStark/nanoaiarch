'use server';

import { websiteConfig } from '@/config/website';
import {
  applyReferral,
  getOrCreateReferralCode,
  validateReferralCode as validateCode,
} from '@/credits/referral';
import { getDb } from '@/db';
import { referral, user } from '@/db/schema';
import { auth } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { and, count, eq, sql } from 'drizzle-orm';
import { headers } from 'next/headers';

/**
 * Get or create the current user's referral code
 */
export async function getReferralCode(): Promise<{
  success: boolean;
  code?: string;
  error?: string;
}> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    const code = await getOrCreateReferralCode(session.user.id);
    return { success: true, code };
  } catch (error) {
    logger.actions.error('getReferralCode error', error);
    return { success: false, error: 'Failed to get referral code' };
  }
}

/**
 * Validate a referral code
 */
export async function validateReferralCode(code: string): Promise<{
  success: boolean;
  valid: boolean;
  error?: string;
}> {
  try {
    const result = await validateCode(code);
    return { success: true, valid: result.valid };
  } catch (error) {
    logger.actions.error('validateReferralCode error', error);
    return { success: false, valid: false, error: 'Failed to validate code' };
  }
}

/**
 * Apply a referral code to the current user
 * This is the public Server Action - only allows applying to the authenticated user
 */
export async function applyReferralCode(
  code: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    return await applyReferral(session.user.id, code);
  } catch (error) {
    logger.actions.error('applyReferralCode error', error);
    return { success: false, error: 'Failed to apply referral code' };
  }
}

/**
 * Apply a referral code to a specific user (internal use only)
 * This should only be called from trusted server-side code (e.g., registration callback)
 * @internal
 */
export async function applyReferralCodeInternal(
  userId: string,
  code: string
): Promise<{ success: boolean; error?: string }> {
  try {
    return await applyReferral(userId, code);
  } catch (error) {
    logger.actions.error('applyReferralCodeInternal error', error);
    return { success: false, error: 'Failed to apply referral code' };
  }
}

/**
 * Get referral statistics for the current user
 */
export async function getReferralStats(): Promise<{
  success: boolean;
  stats?: {
    totalReferred: number;
    pendingCount: number;
    qualifiedCount: number;
    totalEarned: number;
  };
  error?: string;
}> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    const db = await getDb();

    // Get total referrals
    const [totalResult] = await db
      .select({ count: count() })
      .from(referral)
      .where(eq(referral.referrerId, session.user.id));

    // Get pending count
    const [pendingResult] = await db
      .select({ count: count() })
      .from(referral)
      .where(
        and(
          eq(referral.referrerId, session.user.id),
          eq(referral.status, 'pending')
        )
      );

    // Get qualified/rewarded count
    const [qualifiedResult] = await db
      .select({ count: count() })
      .from(referral)
      .where(
        and(
          eq(referral.referrerId, session.user.id),
          sql`${referral.status} IN ('qualified', 'rewarded')`
        )
      );

    // Calculate total earned
    const commissionAmount = websiteConfig.referral?.commission?.amount || 0;
    const totalEarned = (qualifiedResult?.count || 0) * commissionAmount;

    return {
      success: true,
      stats: {
        totalReferred: totalResult?.count || 0,
        pendingCount: pendingResult?.count || 0,
        qualifiedCount: qualifiedResult?.count || 0,
        totalEarned,
      },
    };
  } catch (error) {
    logger.actions.error('getReferralStats error', error);
    return { success: false, error: 'Failed to get referral stats' };
  }
}

/**
 * Get list of referrals for the current user
 */
export async function getReferralList(): Promise<{
  success: boolean;
  referrals?: Array<{
    id: string;
    email: string;
    status: string;
    createdAt: Date;
    qualifiedAt: Date | null;
  }>;
  error?: string;
}> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    const db = await getDb();

    // Get referrals with referred user info
    const referrals = await db
      .select({
        id: referral.id,
        status: referral.status,
        createdAt: referral.createdAt,
        qualifiedAt: referral.qualifiedAt,
        referredEmail: user.email,
      })
      .from(referral)
      .innerJoin(user, eq(referral.referredId, user.id))
      .where(eq(referral.referrerId, session.user.id))
      .orderBy(sql`${referral.createdAt} DESC`)
      .limit(50);

    return {
      success: true,
      referrals: referrals.map((r) => ({
        id: r.id,
        email: maskEmail(r.referredEmail),
        status: r.status,
        createdAt: r.createdAt,
        qualifiedAt: r.qualifiedAt,
      })),
    };
  } catch (error) {
    logger.actions.error('getReferralList error', error);
    return { success: false, error: 'Failed to get referral list' };
  }
}

/**
 * Mask email for privacy (show first 2 chars and domain)
 */
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return '***@***';
  const masked = local.length > 2 ? `${local.slice(0, 2)}***` : '***';
  return `${masked}@${domain}`;
}
