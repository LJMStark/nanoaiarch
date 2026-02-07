'use server';

import { getDb } from '@/db';
import { generationHistory, user } from '@/db/schema';
import { auth } from '@/lib/auth';
import { CACHE_DURATIONS, CACHE_TAGS } from '@/lib/cache';
import { logger } from '@/lib/logger';
import { and, desc, eq, sql } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';
import { headers } from 'next/headers';

// Cache duration: 5 minutes
const FILTER_CACHE_TTL = CACHE_DURATIONS.MEDIUM;

export interface PublicGeneration {
  id: string;
  prompt: string;
  enhancedPrompt: string | null;
  style: string | null;
  aspectRatio: string | null;
  templateId: string | null;
  templateName: string | null;
  imageUrl: string | null;
  createdAt: Date;
  user: {
    id: string;
    name: string;
    image: string | null;
  };
}

export interface GetPublicGenerationsOptions {
  page?: number;
  pageSize?: number;
  style?: string;
  template?: string;
  sortBy?: 'latest' | 'popular';
}

export interface GetPublicGenerationsResult {
  success: boolean;
  data: PublicGeneration[];
  total: number;
  totalPages: number;
  error?: string;
}

/**
 * Internal function to fetch public generations from database
 */
async function fetchPublicGenerations(
  options: GetPublicGenerationsOptions = {}
): Promise<GetPublicGenerationsResult> {
  try {
    const db = await getDb();
    const {
      page = 1,
      pageSize = 20,
      style,
      template,
      sortBy = 'latest',
    } = options;
    const offset = (page - 1) * pageSize;

    // Build where conditions
    const conditions = [
      eq(generationHistory.isPublic, true),
      eq(generationHistory.status, 'completed'),
    ];

    if (style) {
      conditions.push(eq(generationHistory.style, style));
    }

    if (template) {
      conditions.push(eq(generationHistory.templateId, template));
    }

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(generationHistory)
      .where(and(...conditions));

    const total = Number(countResult[0]?.count || 0);
    const totalPages = Math.ceil(total / pageSize);

    // Determine sort order
    // Note: 'popular' uses random ordering to showcase diversity
    // TODO: Add viewCount field for true popularity sorting
    const orderClause =
      sortBy === 'popular' ? sql`RANDOM()` : desc(generationHistory.createdAt);

    // Get generations with user info
    const generations = await db
      .select({
        id: generationHistory.id,
        prompt: generationHistory.prompt,
        enhancedPrompt: generationHistory.enhancedPrompt,
        style: generationHistory.style,
        aspectRatio: generationHistory.aspectRatio,
        templateId: generationHistory.templateId,
        templateName: generationHistory.templateName,
        imageUrl: generationHistory.imageUrl,
        createdAt: generationHistory.createdAt,
        userId: generationHistory.userId,
        userName: user.name,
        userImage: user.image,
      })
      .from(generationHistory)
      .innerJoin(user, eq(generationHistory.userId, user.id))
      .where(and(...conditions))
      .orderBy(orderClause)
      .limit(pageSize)
      .offset(offset);

    const data: PublicGeneration[] = generations.map(
      (g: (typeof generations)[0]) => ({
        id: g.id,
        prompt: g.prompt,
        enhancedPrompt: g.enhancedPrompt,
        style: g.style,
        aspectRatio: g.aspectRatio,
        templateId: g.templateId,
        templateName: g.templateName,
        imageUrl: g.imageUrl,
        createdAt: g.createdAt,
        user: {
          id: g.userId,
          name: g.userName,
          image: g.userImage,
        },
      })
    );

    return { success: true, data, total, totalPages };
  } catch (error) {
    logger.general.error('Failed to get public generations', { error });
    return {
      success: false,
      data: [],
      total: 0,
      totalPages: 0,
      error: 'Failed to load gallery',
    };
  }
}

/**
 * Get public generations for the explore page (cached for 1 minute)
 * Cache key includes all filter parameters for proper cache separation
 */
export async function getPublicGenerations(
  options: GetPublicGenerationsOptions = {}
): Promise<GetPublicGenerationsResult> {
  const {
    page = 1,
    pageSize = 20,
    style,
    template,
    sortBy = 'latest',
  } = options;

  // Create cached version with unique key based on parameters
  const cachedFetch = unstable_cache(
    () => fetchPublicGenerations({ page, pageSize, style, template, sortBy }),
    [
      'public-generations',
      String(page),
      String(pageSize),
      style || '',
      template || '',
      sortBy,
    ],
    {
      revalidate: CACHE_DURATIONS.SHORT,
      tags: [CACHE_TAGS.PUBLIC_GALLERY],
    }
  );

  return cachedFetch();
}

/**
 * Get a single public generation by ID
 */
export async function getPublicGeneration(id: string): Promise<{
  success: boolean;
  data?: PublicGeneration;
  error?: string;
}> {
  try {
    const db = await getDb();
    const result = await db
      .select({
        id: generationHistory.id,
        prompt: generationHistory.prompt,
        enhancedPrompt: generationHistory.enhancedPrompt,
        style: generationHistory.style,
        aspectRatio: generationHistory.aspectRatio,
        templateId: generationHistory.templateId,
        templateName: generationHistory.templateName,
        imageUrl: generationHistory.imageUrl,
        createdAt: generationHistory.createdAt,
        isPublic: generationHistory.isPublic,
        userId: generationHistory.userId,
        userName: user.name,
        userImage: user.image,
      })
      .from(generationHistory)
      .innerJoin(user, eq(generationHistory.userId, user.id))
      .where(eq(generationHistory.id, id))
      .limit(1);

    if (result.length === 0) {
      return { success: false, error: 'Generation not found' };
    }

    const g = result[0];

    // Check if public or owned by current user
    if (!g.isPublic) {
      const session = await auth.api.getSession({ headers: await headers() });
      if (!session?.user?.id || session.user.id !== g.userId) {
        return { success: false, error: 'Generation not found' };
      }
    }

    return {
      success: true,
      data: {
        id: g.id,
        prompt: g.prompt,
        enhancedPrompt: g.enhancedPrompt,
        style: g.style,
        aspectRatio: g.aspectRatio,
        templateId: g.templateId,
        templateName: g.templateName,
        imageUrl: g.imageUrl,
        createdAt: g.createdAt,
        user: {
          id: g.userId,
          name: g.userName,
          image: g.userImage,
        },
      },
    };
  } catch (error) {
    logger.general.error('Failed to get public generation', { error, id });
    return { success: false, error: 'Failed to load generation' };
  }
}

/**
 * Toggle public status of a generation
 * Optimized: Single DB operation with ownership check in WHERE clause
 */
export async function togglePublicStatus(
  id: string,
  isPublic: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized' };
    }

    const db = await getDb();

    // Single update with ownership verification in WHERE clause
    const result = await db
      .update(generationHistory)
      .set({ isPublic, updatedAt: new Date() })
      .where(
        and(
          eq(generationHistory.id, id),
          eq(generationHistory.userId, session.user.id)
        )
      )
      .returning({ id: generationHistory.id });

    // No rows updated means either not found or not owned
    if (result.length === 0) {
      return { success: false, error: 'Generation not found or unauthorized' };
    }

    logger.general.info('Toggled public status', {
      id,
      isPublic,
      userId: session.user.id,
    });

    return { success: true };
  } catch (error) {
    logger.general.error('Failed to toggle public status', { error, id });
    return { success: false, error: 'Failed to update' };
  }
}

/**
 * Internal function to fetch styles from database
 */
async function fetchAvailableStyles(): Promise<string[]> {
  try {
    const db = await getDb();
    const result = await db
      .selectDistinct({ style: generationHistory.style })
      .from(generationHistory)
      .where(
        and(
          eq(generationHistory.isPublic, true),
          eq(generationHistory.status, 'completed'),
          sql`${generationHistory.style} IS NOT NULL`
        )
      );

    return result
      .map((r: { style: string | null }) => r.style)
      .filter((s): s is string => s !== null);
  } catch (error) {
    logger.general.error('Failed to get available styles', { error });
    return [];
  }
}

/**
 * Internal function to fetch templates from database
 */
async function fetchAvailableTemplates(): Promise<
  { id: string; name: string }[]
> {
  try {
    const db = await getDb();
    const result = await db
      .selectDistinct({
        id: generationHistory.templateId,
        name: generationHistory.templateName,
      })
      .from(generationHistory)
      .where(
        and(
          eq(generationHistory.isPublic, true),
          eq(generationHistory.status, 'completed'),
          sql`${generationHistory.templateId} IS NOT NULL`
        )
      );

    return result.filter(
      (r: { id: string | null; name: string | null }): r is {
        id: string;
        name: string;
      } => r.id !== null && r.name !== null
    );
  } catch (error) {
    logger.general.error('Failed to get available templates', { error });
    return [];
  }
}

/**
 * Get available styles for filtering (cached for 5 minutes)
 */
export const getAvailableStyles = unstable_cache(
  fetchAvailableStyles,
  ['explore-available-styles'],
  { revalidate: FILTER_CACHE_TTL, tags: [CACHE_TAGS.PUBLIC_GALLERY] }
);

/**
 * Get available templates for filtering (cached for 5 minutes)
 */
export const getAvailableTemplates = unstable_cache(
  fetchAvailableTemplates,
  ['explore-available-templates'],
  { revalidate: FILTER_CACHE_TTL, tags: [CACHE_TAGS.PUBLIC_GALLERY] }
);
