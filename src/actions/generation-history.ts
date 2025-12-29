'use server';

import { getDb } from '@/db';
import { generationHistory } from '@/db/schema';
import { auth } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { and, count, desc, eq, sql } from 'drizzle-orm';
import { headers } from 'next/headers';

const generateId = () => crypto.randomUUID().slice(0, 8);

export type GenerationHistoryItem = {
  id: string;
  templateId: string | null;
  templateName: string | null;
  prompt: string;
  enhancedPrompt: string | null;
  style: string | null;
  aspectRatio: string | null;
  model: string | null;
  imageUrl: string | null;
  referenceImageUrl: string | null;
  creditsUsed: number;
  status: string;
  isFavorite: boolean;
  isPublic: boolean;
  createdAt: Date;
};

export type GenerationStats = {
  totalGenerations: number;
  totalCreditsUsed: number;
  favoriteCount: number;
  thisMonthGenerations: number;
};

/**
 * Save a new generation to history
 */
export async function saveGeneration(data: {
  templateId?: string;
  templateName?: string;
  prompt: string;
  enhancedPrompt?: string;
  style?: string;
  aspectRatio?: string;
  model?: string;
  imageUrl?: string;
  referenceImageUrl?: string;
  creditsUsed?: number;
  status?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const id = generateId();
    const db = await getDb();
    await db.insert(generationHistory).values({
      id,
      userId: session.user.id,
      templateId: data.templateId ?? null,
      templateName: data.templateName ?? null,
      prompt: data.prompt,
      enhancedPrompt: data.enhancedPrompt ?? null,
      style: data.style ?? null,
      aspectRatio: data.aspectRatio ?? null,
      model: data.model ?? null,
      imageUrl: data.imageUrl ?? null,
      referenceImageUrl: data.referenceImageUrl ?? null,
      creditsUsed: data.creditsUsed ?? 1,
      status: data.status ?? 'completed',
      errorMessage: data.errorMessage ?? null,
      metadata: data.metadata ? JSON.stringify(data.metadata) : null,
    });

    return { success: true, id };
  } catch (error) {
    logger.actions.error('Failed to save generation', error);
    return { success: false, error: 'Failed to save generation' };
  }
}

/**
 * Get user's generation history with pagination
 */
export async function getGenerationHistory(options?: {
  limit?: number;
  offset?: number;
  favoritesOnly?: boolean;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized', data: [] };
  }

  const limit = options?.limit ?? 20;
  const offset = options?.offset ?? 0;

  try {
    const db = await getDb();
    const conditions = [eq(generationHistory.userId, session.user.id)];

    if (options?.favoritesOnly) {
      conditions.push(eq(generationHistory.isFavorite, true));
    }

    const items = await db
      .select()
      .from(generationHistory)
      .where(and(...conditions))
      .orderBy(desc(generationHistory.createdAt))
      .limit(limit)
      .offset(offset);

    return { success: true, data: items as GenerationHistoryItem[] };
  } catch (error) {
    logger.actions.error('Failed to get generation history', error);
    return { success: false, error: 'Failed to get history', data: [] };
  }
}

/**
 * Get generation statistics for the current user
 */
export async function getGenerationStats(): Promise<{
  success: boolean;
  data?: GenerationStats;
  error?: string;
}> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const db = await getDb();

    // Get total generations and credits used
    const totals = await db
      .select({
        totalGenerations: count(),
        totalCreditsUsed: sql<number>`COALESCE(SUM(${generationHistory.creditsUsed}), 0)`,
      })
      .from(generationHistory)
      .where(eq(generationHistory.userId, session.user.id));

    // Get favorite count
    const favorites = await db
      .select({ count: count() })
      .from(generationHistory)
      .where(
        and(
          eq(generationHistory.userId, session.user.id),
          eq(generationHistory.isFavorite, true)
        )
      );

    // Get this month's generations
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const thisMonth = await db
      .select({ count: count() })
      .from(generationHistory)
      .where(
        and(
          eq(generationHistory.userId, session.user.id),
          sql`${generationHistory.createdAt} >= ${startOfMonth}`
        )
      );

    return {
      success: true,
      data: {
        totalGenerations: totals[0]?.totalGenerations ?? 0,
        totalCreditsUsed: Number(totals[0]?.totalCreditsUsed) || 0,
        favoriteCount: favorites[0]?.count ?? 0,
        thisMonthGenerations: thisMonth[0]?.count ?? 0,
      },
    };
  } catch (error) {
    logger.actions.error('Failed to get generation stats', error);
    return { success: false, error: 'Failed to get stats' };
  }
}

/**
 * Toggle favorite status of a generation
 */
export async function toggleFavorite(generationId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const db = await getDb();

    // First get the current status
    const current = await db
      .select({ isFavorite: generationHistory.isFavorite })
      .from(generationHistory)
      .where(
        and(
          eq(generationHistory.id, generationId),
          eq(generationHistory.userId, session.user.id)
        )
      )
      .limit(1);

    if (!current.length) {
      return { success: false, error: 'Generation not found' };
    }

    // Toggle the status
    await db
      .update(generationHistory)
      .set({
        isFavorite: !current[0].isFavorite,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(generationHistory.id, generationId),
          eq(generationHistory.userId, session.user.id)
        )
      );

    return { success: true, isFavorite: !current[0].isFavorite };
  } catch (error) {
    logger.actions.error('Failed to toggle favorite', error);
    return { success: false, error: 'Failed to update' };
  }
}

/**
 * Delete a generation from history
 */
export async function deleteGeneration(generationId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const db = await getDb();
    await db
      .delete(generationHistory)
      .where(
        and(
          eq(generationHistory.id, generationId),
          eq(generationHistory.userId, session.user.id)
        )
      );

    return { success: true };
  } catch (error) {
    logger.actions.error('Failed to delete generation', error);
    return { success: false, error: 'Failed to delete' };
  }
}

/**
 * Update generation image URL (used after upload to storage)
 */
export async function updateGenerationImage(
  generationId: string,
  imageUrl: string
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const db = await getDb();
    await db
      .update(generationHistory)
      .set({
        imageUrl,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(generationHistory.id, generationId),
          eq(generationHistory.userId, session.user.id)
        )
      );

    return { success: true };
  } catch (error) {
    logger.actions.error('Failed to update generation image', error);
    return { success: false, error: 'Failed to update' };
  }
}
