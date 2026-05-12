'use server';

import { getDb } from '@/db';
import { user } from '@/db/schema';
import { auth } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';

export interface OnboardingStatus {
  onboardingCompleted: boolean;
  onboardingStep: number;
}

/**
 * Get the current user's onboarding status
 */
export async function getOnboardingStatus(): Promise<{
  success: boolean;
  data?: OnboardingStatus;
  error?: string;
}> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return { success: false, error: '未授权访问' };
    }

    const db = await getDb();
    const result = await db
      .select({
        onboardingCompleted: user.onboardingCompleted,
        onboardingStep: user.onboardingStep,
      })
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1);

    if (result.length === 0) {
      return { success: false, error: '用户不存在' };
    }

    return {
      success: true,
      data: {
        onboardingCompleted: result[0].onboardingCompleted,
        onboardingStep: result[0].onboardingStep,
      },
    };
  } catch (error) {
    logger.actions.error('Failed to get onboarding status', error);
    return { success: false, error: '获取引导状态失败' };
  }
}

/**
 * Update the user's onboarding step
 */
export async function updateOnboardingStep(step: number): Promise<{
  success: boolean;
  error?: string;
}> {
  // Validate step value (0-3 for welcome, template, generate, complete)
  const VALID_STEPS = [0, 1, 2, 3];
  if (!VALID_STEPS.includes(step) || !Number.isInteger(step)) {
    return { success: false, error: '引导步骤参数无效' };
  }

  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return { success: false, error: '未授权访问' };
    }

    const db = await getDb();
    await db
      .update(user)
      .set({
        onboardingStep: step,
        updatedAt: new Date(),
      })
      .where(eq(user.id, session.user.id));

    logger.actions.info('Updated onboarding step', {
      userId: session.user.id,
      step,
    });

    return { success: true };
  } catch (error) {
    logger.actions.error('Failed to update onboarding step', error);
    return { success: false, error: '更新引导步骤失败' };
  }
}

/**
 * Mark onboarding as completed
 */
export async function completeOnboarding(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return { success: false, error: '未授权访问' };
    }

    const db = await getDb();
    await db
      .update(user)
      .set({
        onboardingCompleted: true,
        onboardingCompletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(user.id, session.user.id));

    logger.actions.info('Completed onboarding', { userId: session.user.id });

    return { success: true };
  } catch (error) {
    logger.actions.error('Failed to complete onboarding', error);
    return { success: false, error: '完成引导流程失败' };
  }
}

/**
 * Skip onboarding (mark as completed without going through steps)
 */
export async function skipOnboarding(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return { success: false, error: '未授权访问' };
    }

    const db = await getDb();
    await db
      .update(user)
      .set({
        onboardingCompleted: true,
        onboardingCompletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(user.id, session.user.id));

    logger.actions.info('Skipped onboarding', { userId: session.user.id });

    return { success: true };
  } catch (error) {
    logger.actions.error('Failed to skip onboarding', error);
    return { success: false, error: '跳过引导流程失败' };
  }
}
