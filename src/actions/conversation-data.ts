'use server';

import { hydrateProjectMessage } from '@/ai/image/lib/project-message-utils';
import { normalizeGeminiModelId } from '@/ai/image/lib/provider-config';
import { getDb } from '@/db';
import { imageProject, projectMessage } from '@/db/schema';
import { auth } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { headers } from 'next/headers';
import {
  type ImageProjectItem,
  createImageProjectRecord,
} from './image-project';
import type { ProjectMessageItem } from './project-message';

export interface ConversationInitData {
  projects: ImageProjectItem[];
  messages: ProjectMessageItem[];
  currentProjectId: string | null;
}

export type ConversationInitMode = 'blank' | 'new-project';

function normalizeConversationProject(
  project: ImageProjectItem
): ImageProjectItem {
  return {
    ...project,
    model: normalizeGeminiModelId(project.model),
  };
}

/**
 * Load initial conversation data in a single request
 * Combines projects and messages loading to avoid waterfall requests
 */
export async function getConversationInitData(
  requestedProjectId?: string | null,
  options?: {
    mode?: ConversationInitMode;
  }
): Promise<{
  success: boolean;
  data: ConversationInitData;
  error?: string;
}> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return {
      success: false,
      data: { projects: [], messages: [], currentProjectId: null },
      error: '未授权访问',
    };
  }

  try {
    const db = await getDb();
    const userId = session.user.id;
    const mode = options?.mode ?? 'blank';

    const existingProjects = (
      (await db
        .select()
        .from(imageProject)
        .where(
          and(
            eq(imageProject.userId, userId),
            sql`${imageProject.status} != 'deleted'`,
            sql`${imageProject.messageCount} > 0`
          )
        )
        .orderBy(desc(imageProject.isPinned), desc(imageProject.lastActiveAt))
        .limit(50)) as ImageProjectItem[]
    ).map(normalizeConversationProject);

    if (mode === 'blank') {
      return {
        success: true,
        data: {
          projects: existingProjects,
          messages: [],
          currentProjectId: null,
        },
      };
    }

    if (mode === 'new-project') {
      const newProject = await createImageProjectRecord({
        db,
        userId,
      });

      return {
        success: true,
        data: {
          projects: [newProject, ...existingProjects],
          messages: [],
          currentProjectId: newProject.id,
        },
      };
    }

    // Determine which project to load messages for. Honors the caller's
    // explicit requestedProjectId only — never auto-restores the user's most
    // recent project on a no-hint workbench entry. Entering /ai/image from
    // the marketing homepage, a logo click, or any external link should
    // land on the empty TemplateShowcase, not silently reopen wherever the
    // user last was.
    let currentProjectId: string | null = null;

    if (requestedProjectId) {
      const validProject = existingProjects.find(
        (p) => p.id === requestedProjectId
      );
      if (validProject) {
        currentProjectId = requestedProjectId;
      }
    }

    // Fetch messages for the current project
    let messages: ProjectMessageItem[] = [];
    if (currentProjectId) {
      const messagesResult = await db
        .select()
        .from(projectMessage)
        .where(eq(projectMessage.projectId, currentProjectId))
        .orderBy(asc(projectMessage.orderIndex), asc(projectMessage.createdAt));

      messages = messagesResult.map(hydrateProjectMessage);
    }

    return {
      success: true,
      data: {
        projects: existingProjects,
        messages,
        currentProjectId,
      },
    };
  } catch (error) {
    logger.actions.error('Failed to load conversation init data', error);
    return {
      success: false,
      data: { projects: [], messages: [], currentProjectId: null },
      error: '加载数据失败',
    };
  }
}
