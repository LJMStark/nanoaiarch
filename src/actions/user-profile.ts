'use server';

import { getDb } from '@/db';
import { generationHistory, user } from '@/db/schema';
import { auth } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { and, desc, eq, sql } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';
import { headers } from 'next/headers';

// Cache duration: 60 seconds for profile data
const PROFILE_CACHE_TTL = 60;

export interface UserProfile {
  id: string;
  name: string;
  image: string | null;
  bio: string | null;
  createdAt: Date;
  isProfilePublic: boolean;
  publicGenerationsCount: number;
}

export interface UserGeneration {
  id: string;
  prompt: string;
  style: string | null;
  templateName: string | null;
  imageUrl: string | null;
  createdAt: Date;
}

// Shared type for profile access check result
interface ProfileAccessResult {
  exists: boolean;
  isOwner: boolean;
  canAccess: boolean;
  isPublic?: boolean;
}

/**
 * Check if current user can access a profile (shared logic)
 */
async function checkProfileAccess(
  userId: string
): Promise<ProfileAccessResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  const isOwner = session?.user?.id === userId;

  const db = await getDb();
  const result = await db
    .select({ isProfilePublic: user.isProfilePublic })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if (result.length === 0) {
    return { exists: false, isOwner, canAccess: false };
  }

  const isPublic = result[0].isProfilePublic;
  const canAccess = isPublic || isOwner;

  return { exists: true, isOwner, canAccess, isPublic };
}

/**
 * Internal function to fetch user profile data (cacheable)
 */
async function fetchUserProfileData(userId: string) {
  const db = await getDb();

  // Get user info
  const userResult = await db
    .select({
      id: user.id,
      name: user.name,
      image: user.image,
      bio: user.bio,
      createdAt: user.createdAt,
      isProfilePublic: user.isProfilePublic,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if (userResult.length === 0) {
    return null;
  }

  // Get public generations count
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(generationHistory)
    .where(
      and(
        eq(generationHistory.userId, userId),
        eq(generationHistory.isPublic, true),
        eq(generationHistory.status, 'completed')
      )
    );

  const publicGenerationsCount = Number(countResult[0]?.count || 0);

  return {
    ...userResult[0],
    publicGenerationsCount,
  };
}

/**
 * Cached version of fetchUserProfileData
 */
const getCachedUserProfileData = (userId: string) =>
  unstable_cache(
    () => fetchUserProfileData(userId),
    [`user-profile-${userId}`],
    { revalidate: PROFILE_CACHE_TTL }
  )();

/**
 * Get user public profile by user ID
 */
export async function getUserProfile(userId: string): Promise<{
  success: boolean;
  data?: UserProfile;
  isOwner?: boolean;
  error?: string;
}> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const isOwner = session?.user?.id === userId;

    // Use cached profile data
    const profileData = await getCachedUserProfileData(userId);

    if (!profileData) {
      return { success: false, error: 'User not found' };
    }

    // Check if profile is public (or owner)
    if (!profileData.isProfilePublic && !isOwner) {
      return { success: false, error: 'Profile is private' };
    }

    return {
      success: true,
      isOwner,
      data: {
        id: profileData.id,
        name: profileData.name,
        image: profileData.image,
        bio: profileData.bio,
        createdAt: profileData.createdAt,
        isProfilePublic: profileData.isProfilePublic,
        publicGenerationsCount: profileData.publicGenerationsCount,
      },
    };
  } catch (error) {
    logger.general.error('Failed to get user profile', { error, userId });
    return { success: false, error: 'Failed to load profile' };
  }
}

/**
 * Get user's public generations
 * @param isProfilePublic - Pass this from getUserProfile to skip redundant DB query
 */
export async function getUserPublicGenerations(
  userId: string,
  options: {
    page?: number;
    pageSize?: number;
    isProfilePublic?: boolean; // Optimization: skip permission check if already known
  } = {}
): Promise<{
  success: boolean;
  data: UserGeneration[];
  total: number;
  totalPages: number;
  error?: string;
}> {
  try {
    const db = await getDb();
    const { page = 1, pageSize = 12, isProfilePublic } = options;
    const offset = (page - 1) * pageSize;

    // Only check access if isProfilePublic not provided (optimization)
    if (isProfilePublic === undefined) {
      const access = await checkProfileAccess(userId);

      if (!access.exists) {
        return {
          success: false,
          data: [],
          total: 0,
          totalPages: 0,
          error: 'User not found',
        };
      }

      if (!access.canAccess) {
        return {
          success: false,
          data: [],
          total: 0,
          totalPages: 0,
          error: 'Profile is private',
        };
      }
    }

    // Build where conditions
    const conditions = [
      eq(generationHistory.userId, userId),
      eq(generationHistory.isPublic, true),
      eq(generationHistory.status, 'completed'),
    ];

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(generationHistory)
      .where(and(...conditions));

    const total = Number(countResult[0]?.count || 0);
    const totalPages = Math.ceil(total / pageSize);

    // Get generations
    const generations = await db
      .select({
        id: generationHistory.id,
        prompt: generationHistory.prompt,
        style: generationHistory.style,
        templateName: generationHistory.templateName,
        imageUrl: generationHistory.imageUrl,
        createdAt: generationHistory.createdAt,
      })
      .from(generationHistory)
      .where(and(...conditions))
      .orderBy(desc(generationHistory.createdAt))
      .limit(pageSize)
      .offset(offset);

    return {
      success: true,
      data: generations,
      total,
      totalPages,
    };
  } catch (error) {
    logger.general.error('Failed to get user public generations', {
      error,
      userId,
    });
    return {
      success: false,
      data: [],
      total: 0,
      totalPages: 0,
      error: 'Failed to load generations',
    };
  }
}

/**
 * Update user bio (current user only)
 */
export async function updateUserBio(bio: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized' };
    }

    // Validate bio length (max 200 characters)
    if (bio.length > 200) {
      return { success: false, error: 'Bio must be 200 characters or less' };
    }

    const db = await getDb();
    await db
      .update(user)
      .set({ bio: bio.trim() || null, updatedAt: new Date() })
      .where(eq(user.id, session.user.id));

    logger.general.info('Updated user bio', { userId: session.user.id });
    return { success: true };
  } catch (error) {
    logger.general.error('Failed to update user bio', { error });
    return { success: false, error: 'Failed to update bio' };
  }
}

/**
 * Toggle profile public status (current user only)
 */
export async function toggleProfilePublic(isPublic: boolean): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized' };
    }

    const db = await getDb();
    await db
      .update(user)
      .set({ isProfilePublic: isPublic, updatedAt: new Date() })
      .where(eq(user.id, session.user.id));

    logger.general.info('Toggled profile public status', {
      userId: session.user.id,
      isPublic,
    });
    return { success: true };
  } catch (error) {
    logger.general.error('Failed to toggle profile public status', { error });
    return { success: false, error: 'Failed to update profile' };
  }
}
