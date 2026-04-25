'use server';

import { validateBase64Image } from '@/ai/image/lib/api-utils';
import {
  DEFAULT_MODEL,
  type GeminiModelId,
  normalizeGeminiModelId,
} from '@/ai/image/lib/provider-config';
import { getDb } from '@/db';
import { imageProject } from '@/db/schema';
import { auth } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { and, count, desc, eq, sql } from 'drizzle-orm';
import { headers } from 'next/headers';

const generateId = () => crypto.randomUUID();

export type ImageProjectItem = {
  id: string;
  title: string;
  coverImage: string | null;
  templateId: string | null;
  stylePreset: string | null;
  aspectRatio: string | null;
  model: GeminiModelId | null;
  messageCount: number;
  generationCount: number;
  totalCreditsUsed: number;
  status: string;
  isPinned: boolean;
  lastActiveAt: Date;
  createdAt: Date;
};

export type CreateImageProjectInput = {
  title?: string;
  templateId?: string;
  stylePreset?: string;
  aspectRatio?: string;
};

function normalizeImageProjectRecord(
  project: ImageProjectItem
): ImageProjectItem {
  return {
    ...project,
    model: normalizeGeminiModelId(project.model),
  };
}

export async function createImageProjectRecord(params: {
  db: Awaited<ReturnType<typeof getDb>>;
  userId: string;
  data?: CreateImageProjectInput;
}): Promise<ImageProjectItem> {
  const id = generateId();
  const now = new Date();

  await params.db.insert(imageProject).values({
    id,
    userId: params.userId,
    title: params.data?.title ?? '未命名项目',
    templateId: params.data?.templateId ?? null,
    stylePreset: params.data?.stylePreset ?? null,
    aspectRatio: params.data?.aspectRatio ?? 'auto',
    model: DEFAULT_MODEL,
    lastActiveAt: now,
    createdAt: now,
    updatedAt: now,
  });

  return {
    id,
    title: params.data?.title ?? '未命名项目',
    coverImage: null,
    templateId: params.data?.templateId ?? null,
    stylePreset: params.data?.stylePreset ?? null,
    aspectRatio: params.data?.aspectRatio ?? 'auto',
    model: DEFAULT_MODEL,
    messageCount: 0,
    generationCount: 0,
    totalCreditsUsed: 0,
    status: 'active',
    isPinned: false,
    lastActiveAt: now,
    createdAt: now,
  };
}

/**
 * Create a new image project
 */
export async function createImageProject(data?: CreateImageProjectInput) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return { success: false, error: '未授权访问' };
  }

  try {
    const db = await getDb();
    const project = await createImageProjectRecord({
      db,
      userId: session.user.id,
      data,
    });

    return { success: true, data: project };
  } catch (error) {
    logger.actions.error('Failed to create project', error);
    return { success: false, error: '创建项目失败' };
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
  includeEmpty?: boolean; // Whether to include empty projects (default: false)
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return { success: false, error: '未授权访问', data: [] };
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

    // Default: filter out empty projects with no messages
    if (!options?.includeEmpty) {
      conditions.push(sql`${imageProject.messageCount} > 0`);
    }

    const items = await db
      .select()
      .from(imageProject)
      .where(and(...conditions))
      .orderBy(desc(imageProject.isPinned), desc(imageProject.lastActiveAt))
      .limit(limit)
      .offset(offset);

    return {
      success: true,
      data: (items as ImageProjectItem[]).map(normalizeImageProjectRecord),
    };
  } catch (error) {
    logger.actions.error('Failed to get projects', error);
    return { success: false, error: '获取项目列表失败', data: [] };
  }
}

/**
 * Get a single project by ID
 */
export async function getImageProject(projectId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return { success: false, error: '未授权访问' };
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
      return { success: false, error: '项目未找到' };
    }

    return {
      success: true,
      data: normalizeImageProjectRecord(project[0] as ImageProjectItem),
    };
  } catch (error) {
    logger.actions.error('Failed to get project', error);
    return { success: false, error: '获取项目失败' };
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
    return { success: false, error: '未授权访问' };
  }

  try {
    const db = await getDb();

    if (data.coverImage) {
      const imageValidation = validateBase64Image(data.coverImage);
      if (!imageValidation.valid) {
        return { success: false, error: imageValidation.error };
      }
    }

    const updates: Partial<{
      title: string;
      coverImage: string;
      stylePreset: string;
      aspectRatio: string;
      model: GeminiModelId;
    }> = {};

    if (data.title !== undefined) updates.title = data.title;
    if (data.coverImage !== undefined) updates.coverImage = data.coverImage;
    if (data.stylePreset !== undefined) updates.stylePreset = data.stylePreset;
    if (data.aspectRatio !== undefined) updates.aspectRatio = data.aspectRatio;
    if (data.model !== undefined) {
      updates.model = normalizeGeminiModelId(data.model);
    }

    const result = await db
      .update(imageProject)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(imageProject.id, projectId),
          eq(imageProject.userId, session.user.id)
        )
      )
      .returning({ id: imageProject.id });

    if (result.length === 0) {
      return { success: false, error: '项目未找到' };
    }

    return { success: true };
  } catch (error) {
    logger.actions.error('Failed to update project', error);
    return { success: false, error: '更新项目失败' };
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
    return { success: false, error: '未授权访问' };
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
    logger.actions.error('Failed to update project activity', error);
    return { success: false, error: '更新项目失败' };
  }
}

/**
 * Toggle pin status of a project
 */
export async function toggleProjectPin(projectId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return { success: false, error: '未授权访问' };
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
      return { success: false, error: '项目未找到' };
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
    logger.actions.error('Failed to toggle pin', error);
    return { success: false, error: '更新失败' };
  }
}

/**
 * Archive a project (soft delete)
 */
export async function archiveProject(projectId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return { success: false, error: '未授权访问' };
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
    logger.actions.error('Failed to archive project', error);
    return { success: false, error: '归档失败' };
  }
}

/**
 * Delete a project permanently
 */
export async function deleteImageProject(projectId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return { success: false, error: '未授权访问' };
  }

  try {
    const db = await getDb();

    // Verify project ownership first
    const project = await db
      .select({ id: imageProject.id })
      .from(imageProject)
      .where(
        and(
          eq(imageProject.id, projectId),
          eq(imageProject.userId, session.user.id)
        )
      )
      .limit(1);

    if (!project.length) {
      return { success: false, error: '项目未找到' };
    }

    // The project_message FK already cascades on delete. Delete the parent row once.
    const deleted = await db
      .delete(imageProject)
      .where(
        and(
          eq(imageProject.id, projectId),
          eq(imageProject.userId, session.user.id)
        )
      )
      .returning({ id: imageProject.id });

    if (deleted.length === 0) {
      return { success: false, error: '项目未找到' };
    }

    return { success: true };
  } catch (error) {
    logger.actions.error('Failed to delete project', error);
    return { success: false, error: '删除失败' };
  }
}

/**
 * Get project statistics
 */
export async function getProjectStats() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return { success: false, error: '未授权访问' };
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
    logger.actions.error('Failed to get project stats', error);
    return { success: false, error: '获取统计数据失败' };
  }
}
