'use server';

import { getDb } from '@/db';
import { imageProject, projectMessage } from '@/db/schema';
import { auth } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { headers } from 'next/headers';
import type { ImageProjectItem } from './image-project';
import type { ProjectMessageItem } from './project-message';

export interface ConversationInitData {
  projects: ImageProjectItem[];
  messages: ProjectMessageItem[];
  currentProjectId: string | null;
}

/**
 * Load initial conversation data in a single request
 * Combines projects and messages loading to avoid waterfall requests
 */
export async function getConversationInitData(
  requestedProjectId?: string | null
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
      error: 'Unauthorized',
    };
  }

  try {
    const db = await getDb();
    const userId = session.user.id;

    // Fetch projects and determine current project in parallel
    const projectsPromise = db
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
      .limit(50);

    const projects = await projectsPromise;

    // Determine which project to load messages for
    let currentProjectId: string | null = null;

    if (requestedProjectId) {
      // Verify the requested project belongs to the user
      const validProject = projects.find((p) => p.id === requestedProjectId);
      if (validProject) {
        currentProjectId = requestedProjectId;
      }
    }

    // If no valid requested project, use the first project
    if (!currentProjectId && projects.length > 0) {
      currentProjectId = projects[0].id;
    }

    // Fetch messages for the current project
    let messages: ProjectMessageItem[] = [];
    if (currentProjectId) {
      const messagesResult = await db
        .select()
        .from(projectMessage)
        .where(eq(projectMessage.projectId, currentProjectId))
        .orderBy(asc(projectMessage.orderIndex), asc(projectMessage.createdAt));

      messages = messagesResult as ProjectMessageItem[];
    }

    return {
      success: true,
      data: {
        projects: projects as ImageProjectItem[],
        messages,
        currentProjectId,
      },
    };
  } catch (error) {
    logger.actions.error('Failed to load conversation init data', error);
    return {
      success: false,
      data: { projects: [], messages: [], currentProjectId: null },
      error: 'Failed to load data',
    };
  }
}
