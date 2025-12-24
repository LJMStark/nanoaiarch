import { randomUUID } from 'crypto';
import { websiteConfig } from '@/config/website';
import { getDb } from '@/db';
import { referral, user } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { addCredits } from './credits';
import { CREDIT_TRANSACTION_TYPE } from './types';

/**
 * Generate a unique referral code for a user
 */
function generateReferralCode(): string {
  // Generate a short, URL-safe code
  return randomUUID().replace(/-/g, '').substring(0, 8).toUpperCase();
}

/**
 * Get or create a referral code for a user
 */
export async function getOrCreateReferralCode(userId: string): Promise<string> {
  const db = await getDb();

  // Check if user already has a referral code
  const [existingUser] = await db
    .select({ referralCode: user.referralCode })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if (existingUser?.referralCode) {
    return existingUser.referralCode;
  }

  // Generate a new unique referral code
  let code = generateReferralCode();
  let attempts = 0;
  const maxAttempts = 5;

  while (attempts < maxAttempts) {
    const [existing] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.referralCode, code))
      .limit(1);

    if (!existing) break;
    code = generateReferralCode();
    attempts++;
  }

  // Save the referral code to user
  await db.update(user).set({ referralCode: code }).where(eq(user.id, userId));

  return code;
}

/**
 * Validate a referral code and return the referrer's user ID
 */
export async function validateReferralCode(
  code: string
): Promise<{ valid: boolean; referrerId?: string }> {
  if (!code) return { valid: false };

  const db = await getDb();
  const [referrer] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.referralCode, code.toUpperCase()))
    .limit(1);

  if (!referrer) return { valid: false };

  return { valid: true, referrerId: referrer.id };
}

/**
 * Apply referral relationship when a new user registers
 * This should be called after user registration
 */
export async function applyReferral(
  newUserId: string,
  referralCode: string
): Promise<{ success: boolean; error?: string }> {
  if (!websiteConfig.referral?.enable) {
    return { success: false, error: 'Referral system is disabled' };
  }

  const db = await getDb();

  // Validate the referral code
  const { valid, referrerId } = await validateReferralCode(referralCode);
  if (!valid || !referrerId) {
    return { success: false, error: 'Invalid referral code' };
  }

  // Prevent self-referral
  if (referrerId === newUserId) {
    return { success: false, error: 'Cannot refer yourself' };
  }

  // Check if user was already referred
  const [existingReferral] = await db
    .select()
    .from(referral)
    .where(eq(referral.referredId, newUserId))
    .limit(1);

  if (existingReferral) {
    return { success: false, error: 'User was already referred' };
  }

  // Create referral record
  await db.insert(referral).values({
    id: randomUUID(),
    referrerId,
    referredId: newUserId,
    status: 'pending',
    createdAt: new Date(),
  });

  // Update user's referredBy field
  await db
    .update(user)
    .set({ referredBy: referrerId })
    .where(eq(user.id, newUserId));

  // Add signup bonus to new user if enabled
  if (websiteConfig.referral.signupBonus?.enable) {
    const { amount, expireDays } = websiteConfig.referral.signupBonus;
    await addCredits({
      userId: newUserId,
      amount,
      type: CREDIT_TRANSACTION_TYPE.REFERRAL_SIGNUP_BONUS,
      description: `Referral signup bonus: ${amount} credits`,
      expireDays: expireDays || undefined,
    });
    console.log(
      `applyReferral: Added ${amount} signup bonus to user ${newUserId}`
    );
  }

  console.log(
    `applyReferral: Created referral from ${referrerId} to ${newUserId}`
  );
  return { success: true };
}

/**
 * Complete referral and award commission to referrer
 * This should be called when referred user makes their first payment
 */
export async function completeReferral(
  referredUserId: string
): Promise<{ success: boolean; error?: string }> {
  if (!websiteConfig.referral?.enable) {
    return { success: false, error: 'Referral system is disabled' };
  }

  const db = await getDb();

  // Find pending referral for this user
  const [pendingReferral] = await db
    .select()
    .from(referral)
    .where(
      and(
        eq(referral.referredId, referredUserId),
        eq(referral.status, 'pending')
      )
    )
    .limit(1);

  if (!pendingReferral) {
    // No pending referral, nothing to do
    return { success: true };
  }

  const now = new Date();

  // Update referral status to qualified
  await db
    .update(referral)
    .set({
      status: 'qualified',
      qualifiedAt: now,
    })
    .where(eq(referral.id, pendingReferral.id));

  // Award commission to referrer if enabled
  if (websiteConfig.referral.commission?.enable) {
    const { amount, expireDays } = websiteConfig.referral.commission;
    await addCredits({
      userId: pendingReferral.referrerId,
      amount,
      type: CREDIT_TRANSACTION_TYPE.REFERRAL_COMMISSION,
      description: `Referral commission: ${amount} credits`,
      expireDays: expireDays || undefined,
    });

    // Mark as rewarded
    await db
      .update(referral)
      .set({
        status: 'rewarded',
        rewardedAt: now,
      })
      .where(eq(referral.id, pendingReferral.id));

    console.log(
      `completeReferral: Awarded ${amount} commission to referrer ${pendingReferral.referrerId}`
    );
  }

  return { success: true };
}

/**
 * Check if user has made any paid purchase
 */
export async function hasUserPaid(userId: string): Promise<boolean> {
  const db = await getDb();
  const { payment } = await import('@/db/schema');

  const [paidPayment] = await db
    .select({ id: payment.id })
    .from(payment)
    .where(and(eq(payment.userId, userId), eq(payment.paid, true)))
    .limit(1);

  return !!paidPayment;
}
