'use server';

import { randomUUID } from 'node:crypto';
import { getDb } from '@/db';
import { user, verification } from '@/db/schema';
import { auth } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { eq } from 'drizzle-orm';

export interface HandleUnverifiedRegistrationResult {
  status: 'unverified' | 'verified' | 'not_found';
  message: string;
  success: boolean;
}

/**
 * Handle registration attempt for users who already exist but haven't verified their email
 * This improves UX by automatically resending verification email instead of showing error
 */
export async function handleUnverifiedRegistration(
  email: string,
  callbackURL?: string
): Promise<HandleUnverifiedRegistrationResult> {
  try {
    const db = await getDb();

    // Check if user exists with this email
    const [existingUser] = await db
      .select({
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
      })
      .from(user)
      .where(eq(user.email, email))
      .limit(1);

    // User doesn't exist - this shouldn't happen in normal flow
    if (!existingUser) {
      return {
        status: 'not_found',
        message: 'User not found',
        success: false,
      };
    }

    // User exists and is already verified - they should login instead
    if (existingUser.emailVerified) {
      logger.auth.info('handleUnverifiedRegistration: user already verified', {
        email,
      });
      return {
        status: 'verified',
        message:
          'Account already exists and is verified. Please sign in instead.',
        success: false,
      };
    }

    // User exists but not verified - resend verification email
    logger.auth.info('handleUnverifiedRegistration: resending verification', {
      email,
    });

    // Generate new verification token
    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24 hours

    // Update or create verification record
    // Delete old verification records for this email
    await db.delete(verification).where(eq(verification.identifier, email));

    // Create new verification record
    await db.insert(verification).values({
      id: randomUUID(),
      identifier: email,
      value: token,
      expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Send verification email using Better Auth
    // Note: We need to call Better Auth's sendVerificationEmail function
    // This will use the existing email template and configuration
    try {
      // Use Better Auth's internal email sending
      await auth.api.sendVerificationEmail({
        body: {
          email,
          callbackURL,
        },
      });

      logger.auth.info(
        'handleUnverifiedRegistration: verification email sent',
        {
          email,
        }
      );

      return {
        status: 'unverified',
        message: 'Verification email has been resent to your inbox',
        success: true,
      };
    } catch (emailError) {
      logger.auth.error(
        'handleUnverifiedRegistration: failed to send email',
        emailError,
        {
          email,
        }
      );

      return {
        status: 'unverified',
        message: 'Failed to send verification email. Please try again later.',
        success: false,
      };
    }
  } catch (error) {
    logger.auth.error('handleUnverifiedRegistration: unexpected error', error, {
      email,
    });
    return {
      status: 'not_found',
      message: 'An unexpected error occurred',
      success: false,
    };
  }
}
