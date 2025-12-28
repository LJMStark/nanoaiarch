'use server';

import { getDb } from '@/db';
import { imageProject, projectMessage } from '@/db/schema';
import { auth } from '@/lib/auth';
import { and, count, desc, eq, sql } from 'drizzle-orm';
import { headers } from 'next/headers';

const generateId = () => crypto.randomUUID().slice(0, 8);

export type ImageProjectItem = {
  id: string;
  title: string;
  coverImage: string | null;
  templateId: string | null;
  stylePreset: string | null;
  aspectRatio: string | null;
  model: string | null;
  messageCount: number;
  generationCount: number;
  totalCreditsUsed: number;
  status: string;
  isPinned: boolean;
  lastActiveAt: Date;
  createdAt: Date;
};

/**
 * Create a new image project
 */
export async function createImageProject(data?: {
  title?: string;
  templateId?: string;
  stylePreset?: string;
  aspectRatio?: string;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const id = generateId();
    const db = await getDb();

    const now = new Date();
    await db.insert(imageProject).values({
      id,
      userId: session.user.id,
      title: data?.title ?? 'Untitled',
      templateId: data?.templateId ?? null,
      stylePreset: data?.stylePreset ?? null,
      aspectRatio: data?.aspectRatio ?? '1:1',
      lastActiveAt: now,
      createdAt: now,
      updatedAt: now,
    });

    const project: ImageProjectItem = {
      id,
      title: data?.title ?? 'Untitled',
      coverImage: null,
      templateId: data?.templateId ?? null,
      stylePreset: data?.stylePreset ?? null,
      aspectRatio: data?.aspectRatio ?? '1:1',
      model: 'gemini-2.0-flash-exp',
      messageCount: 0,
      generationCount: 0,
      totalCreditsUsed: 0,
      status: 'active',
      isPinned: false,
      lastActiveAt: now,
      createdAt: now,
    };

    return { success: true, data: project };
  } catch (error) {
    console.error('Failed to create project:', error);
    return { success: false, error: 'Failed to create project' };
  }
}

/**
 * Get user's image projects with pagination
 */
export async function getImageProjects(options?: {
  limit?: number;
  offset?: number;
  status?: 'active' | 'archived';
  pinnedOnly?: boolean;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized', data: [] };
  }

  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  try {
    const db = await getDb();
    const conditions = [eq(imageProject.userId, session.user.id)];

    if (options?.status) {
      conditions.push(eq(imageProject.status, options.status));
    } else {
      // Default: exclude deleted projects
      conditions.push(sql`${imageProject.status} != 'deleted'`);
    }

    if (options?.pinnedOnly) {
      conditions.push(eq(imageProject.isPinned, true));
    }

    const items = await db
      .select()
      .from(imageProject)
      .where(and(...conditions))
      .orderBy(desc(imageProject.isPinned), desc(imageProject.lastActiveAt))
      .limit(limit)
      .offset(offset);

    return { success: true, data: items as ImageProjectItem[] };
  } catch (error) {
    console.error('Failed to get projects:', error);
    return { success: false, error: 'Failed to get projects', data: [] };
  }
}

/**
 * Get a single project by ID
 */
export async function getImageProject(projectId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const db = await getDb();
    const project = await db
      .select()
      .from(imageProject)
      .where(
        and(
          eq(imageProject.id, projectId),
          eq(imageProject.userId, session.user.id)
        )
      )
      .limit(1);

    if (!project.length) {
      return { success: false, error: 'Project not found' };
    }

    return { success: true, data: project[0] as ImageProjectItem };
  } catch (error) {
    console.error('Failed to get project:', error);
    return { success: false, error: 'Failed to get project' };
  }
}

/**
 * Update project properties
 */
export async function updateImageProject(
  projectId: string,
  data: Partial<{
    title: string;
    coverImage: string;
    stylePreset: string;
    aspectRatio: string;
    model: string;
  }>
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const db = await getDb();
    await db
      .update(imageProject)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(imageProject.id, projectId),
          eq(imageProject.userId, session.user.id)
        )
      );

    return { success: true };
  } catch (error) {
    console.error('Failed to update project:', error);
    return { success: false, error: 'Failed to update project' };
  }
}

/**
 * Update project activity (called after generation)
 */
export async function updateProjectActivity(
  projectId: string,
  data: {
    coverImage?: string;
    creditsUsed?: number;
    incrementGeneration?: boolean;
  }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const db = await getDb();

    const updates: Record<string, unknown> = {
      lastActiveAt: new Date(),
      updatedAt: new Date(),
    };

    if (data.coverImage) {
      updates.coverImage = data.coverImage;
    }

    if (data.incrementGeneration) {
      updates.generationCount = sql`${imageProject.generationCount} + 1`;
      updates.messageCount = sql`${imageProject.messageCount} + 2`; // user + assistant
    }

    if (data.creditsUsed) {
      updates.totalCreditsUsed = sql`${imageProject.totalCreditsUsed} + ${data.creditsUsed}`;
    }

    await db
      .update(imageProject)
      .set(updates)
      .where(
        and(
          eq(imageProject.id, projectId),
          eq(imageProject.userId, session.user.id)
        )
      );

    return { success: true };
  } catch (error) {
    console.error('Failed to update project activity:', error);
    return { success: false, error: 'Failed to update project' };
  }
}

/**
 * Toggle pin status of a project
 */
export async function toggleProjectPin(projectId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const db = await getDb();

    // Get current pin status
    const current = await db
      .select({ isPinned: imageProject.isPinned })
      .from(imageProject)
      .where(
        and(
          eq(imageProject.id, projectId),
          eq(imageProject.userId, session.user.id)
        )
      )
      .limit(1);

    if (!current.length) {
      return { success: false, error: 'Project not found' };
    }

    // Toggle pin status
    await db
      .update(imageProject)
      .set({
        isPinned: !current[0].isPinned,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(imageProject.id, projectId),
          eq(imageProject.userId, session.user.id)
        )
      );

    return { success: true, isPinned: !current[0].isPinned };
  } catch (error) {
    console.error('Failed to toggle pin:', error);
    return { success: false, error: 'Failed to update' };
  }
}

/**
 * Archive a project (soft delete)
 */
export async function archiveProject(projectId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const db = await getDb();
    await db
      .update(imageProject)
      .set({
        status: 'archived',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(imageProject.id, projectId),
          eq(imageProject.userId, session.user.id)
        )
      );

    return { success: true };
  } catch (error) {
    console.error('Failed to archive project:', error);
    return { success: false, error: 'Failed to archive' };
  }
}

/**
 * Delete a project permanently
 */
export async function deleteImageProject(projectId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const db = await getDb();

    // Delete all messages first (cascade should handle this, but being explicit)
    await db
      .delete(projectMessage)
      .where(eq(projectMessage.projectId, projectId));

    // Delete the project
    await db
      .delete(imageProject)
      .where(
        and(
          eq(imageProject.id, projectId),
          eq(imageProject.userId, session.user.id)
        )
      );

    return { success: true };
  } catch (error) {
    console.error('Failed to delete project:', error);
    return { success: false, error: 'Failed to delete' };
  }
}

/**
 * Get project statistics
 */
export async function getProjectStats() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const db = await getDb();

    const stats = await db
      .select({
        totalProjects: count(),
        totalGenerations: sql<number>`COALESCE(SUM(${imageProject.generationCount}), 0)`,
        totalCreditsUsed: sql<number>`COALESCE(SUM(${imageProject.totalCreditsUsed}), 0)`,
      })
      .from(imageProject)
      .where(
        and(
          eq(imageProject.userId, session.user.id),
          sql`${imageProject.status} != 'deleted'`
        )
      );

    return {
      success: true,
      data: {
        totalProjects: stats[0]?.totalProjects ?? 0,
        totalGenerations: Number(stats[0]?.totalGenerations) || 0,
        totalCreditsUsed: Number(stats[0]?.totalCreditsUsed) || 0,
      },
    };
  } catch (error) {
    console.error('Failed to get project stats:', error);
    return { success: false, error: 'Failed to get stats' };
  }
}
