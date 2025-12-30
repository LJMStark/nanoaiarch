'use server';

import { validateBase64Image } from '@/ai/image/lib/api-utils';
import { getDb } from '@/db';
import { imageProject, projectMessage } from '@/db/schema';
import { auth } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { and, asc, eq, sql } from 'drizzle-orm';
import { headers } from 'next/headers';

const generateId = () => crypto.randomUUID().slice(0, 8);

export type MessageRole = 'user' | 'assistant';

export type ProjectMessageItem = {
  id: string;
  projectId: string;
  role: MessageRole;
  content: string;
  inputImage: string | null;
  outputImage: string | null;
  maskImage: string | null;
  generationParams: string | null;
  creditsUsed: number | null;
  generationTime: number | null;
  status: string;
  errorMessage: string | null;
  orderIndex: number;
  createdAt: Date;
};

export type GenerationParams = {
  prompt: string;
  enhancedPrompt?: string;
  style?: string;
  aspectRatio?: string;
  model?: string;
  imageQuality?: string;
};

/**
 * Get all messages for a project
 */
export async function getProjectMessages(projectId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized', data: [] };
  }

  try {
    const db = await getDb();

    // Verify project ownership
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
      return { success: false, error: 'Project not found', data: [] };
    }

    const messages = await db
      .select()
      .from(projectMessage)
      .where(eq(projectMessage.projectId, projectId))
      .orderBy(asc(projectMessage.orderIndex), asc(projectMessage.createdAt));

    return { success: true, data: messages as ProjectMessageItem[] };
  } catch (error) {
    logger.actions.error('Failed to get messages', error);
    return { success: false, error: 'Failed to get messages', data: [] };
  }
}

/**
 * Add a user message to a project
 */
export async function addUserMessage(
  projectId: string,
  data: {
    content: string;
    inputImage?: string;
  }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' };
  }

  // Validate image size before processing
  if (data.inputImage) {
    const imageValidation = validateBase64Image(data.inputImage);
    if (!imageValidation.valid) {
      return { success: false, error: imageValidation.error };
    }
  }

  try {
    const db = await getDb();

    // Verify project ownership
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
      return { success: false, error: 'Project not found' };
    }

    // Get the next order index
    const lastMessage = await db
      .select({ orderIndex: projectMessage.orderIndex })
      .from(projectMessage)
      .where(eq(projectMessage.projectId, projectId))
      .orderBy(sql`${projectMessage.orderIndex} DESC`)
      .limit(1);

    const nextOrderIndex = (lastMessage[0]?.orderIndex ?? -1) + 1;

    const id = generateId();
    const now = new Date();

    await db.insert(projectMessage).values({
      id,
      projectId,
      userId: session.user.id,
      role: 'user',
      content: data.content,
      inputImage: data.inputImage ?? null,
      orderIndex: nextOrderIndex,
      status: 'completed',
      createdAt: now,
      updatedAt: now,
    });

    // Update project message count
    await db
      .update(imageProject)
      .set({
        messageCount: sql`${imageProject.messageCount} + 1`,
        lastActiveAt: now,
        updatedAt: now,
      })
      .where(eq(imageProject.id, projectId));

    const message: ProjectMessageItem = {
      id,
      projectId,
      role: 'user',
      content: data.content,
      inputImage: data.inputImage ?? null,
      outputImage: null,
      maskImage: null,
      generationParams: null,
      creditsUsed: null,
      generationTime: null,
      status: 'completed',
      errorMessage: null,
      orderIndex: nextOrderIndex,
      createdAt: now,
    };

    return { success: true, data: message };
  } catch (error) {
    logger.actions.error('Failed to add user message', error);
    return { success: false, error: 'Failed to add message' };
  }
}

/**
 * Add an assistant message (with generated image) to a project
 */
export async function addAssistantMessage(
  projectId: string,
  data: {
    content: string;
    outputImage?: string;
    generationParams?: GenerationParams;
    creditsUsed?: number;
    generationTime?: number;
    status?: 'completed' | 'failed';
    errorMessage?: string;
  }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' };
  }

  // Validate output image size
  if (data.outputImage) {
    const imageValidation = validateBase64Image(data.outputImage);
    if (!imageValidation.valid) {
      return { success: false, error: imageValidation.error };
    }
  }

  try {
    const db = await getDb();

    // Verify project ownership
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
      return { success: false, error: 'Project not found' };
    }

    // Get the next order index
    const lastMessage = await db
      .select({ orderIndex: projectMessage.orderIndex })
      .from(projectMessage)
      .where(eq(projectMessage.projectId, projectId))
      .orderBy(sql`${projectMessage.orderIndex} DESC`)
      .limit(1);

    const nextOrderIndex = (lastMessage[0]?.orderIndex ?? -1) + 1;

    const id = generateId();
    const now = new Date();
    const status = data.status ?? 'completed';

    await db.insert(projectMessage).values({
      id,
      projectId,
      userId: session.user.id,
      role: 'assistant',
      content: data.content,
      outputImage: data.outputImage ?? null,
      generationParams: data.generationParams
        ? JSON.stringify(data.generationParams)
        : null,
      creditsUsed: data.creditsUsed ?? 0,
      generationTime: data.generationTime ?? null,
      status,
      errorMessage: data.errorMessage ?? null,
      orderIndex: nextOrderIndex,
      createdAt: now,
      updatedAt: now,
    });

    // Update project stats
    const projectUpdates: Record<string, unknown> = {
      messageCount: sql`${imageProject.messageCount} + 1`,
      lastActiveAt: now,
      updatedAt: now,
    };

    if (status === 'completed' && data.outputImage) {
      projectUpdates.generationCount = sql`${imageProject.generationCount} + 1`;
      // Set first generated image as cover
      projectUpdates.coverImage = sql`COALESCE(${imageProject.coverImage}, ${data.outputImage})`;
    }

    if (data.creditsUsed) {
      projectUpdates.totalCreditsUsed = sql`${imageProject.totalCreditsUsed} + ${data.creditsUsed}`;
    }

    await db
      .update(imageProject)
      .set(projectUpdates)
      .where(eq(imageProject.id, projectId));

    const message: ProjectMessageItem = {
      id,
      projectId,
      role: 'assistant',
      content: data.content,
      inputImage: null,
      outputImage: data.outputImage ?? null,
      maskImage: null,
      generationParams: data.generationParams
        ? JSON.stringify(data.generationParams)
        : null,
      creditsUsed: data.creditsUsed ?? null,
      generationTime: data.generationTime ?? null,
      status,
      errorMessage: data.errorMessage ?? null,
      orderIndex: nextOrderIndex,
      createdAt: now,
    };

    return { success: true, data: message };
  } catch (error) {
    logger.actions.error('Failed to add assistant message', error);
    return { success: false, error: 'Failed to add message' };
  }
}

/**
 * Update an assistant message (e.g., when generation completes)
 */
export async function updateAssistantMessage(
  messageId: string,
  data: {
    content?: string;
    outputImage?: string;
    generationParams?: GenerationParams;
    creditsUsed?: number;
    generationTime?: number;
    status?: 'completed' | 'failed';
    errorMessage?: string;
  }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const db = await getDb();

    // Verify message ownership
    const message = await db
      .select({
        id: projectMessage.id,
        projectId: projectMessage.projectId,
      })
      .from(projectMessage)
      .where(
        and(
          eq(projectMessage.id, messageId),
          eq(projectMessage.userId, session.user.id)
        )
      )
      .limit(1);

    if (!message.length) {
      return { success: false, error: 'Message not found' };
    }

    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.content !== undefined) updates.content = data.content;
    if (data.outputImage !== undefined) updates.outputImage = data.outputImage;
    if (data.creditsUsed !== undefined) updates.creditsUsed = data.creditsUsed;
    if (data.generationTime !== undefined)
      updates.generationTime = data.generationTime;
    if (data.status !== undefined) updates.status = data.status;
    if (data.errorMessage !== undefined)
      updates.errorMessage = data.errorMessage;
    if (data.generationParams !== undefined) {
      updates.generationParams = JSON.stringify(data.generationParams);
    }

    await db
      .update(projectMessage)
      .set(updates)
      .where(eq(projectMessage.id, messageId));

    // If generation completed successfully, update project cover if needed
    if (data.status === 'completed' && data.outputImage) {
      await db
        .update(imageProject)
        .set({
          coverImage: sql`COALESCE(${imageProject.coverImage}, ${data.outputImage})`,
          generationCount: sql`${imageProject.generationCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(imageProject.id, message[0].projectId));
    }

    return { success: true };
  } catch (error) {
    logger.actions.error('Failed to update message', error);
    return { success: false, error: 'Failed to update message' };
  }
}

/**
 * Delete a message
 */
export async function deleteMessage(messageId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const db = await getDb();
    await db
      .delete(projectMessage)
      .where(
        and(
          eq(projectMessage.id, messageId),
          eq(projectMessage.userId, session.user.id)
        )
      );

    return { success: true };
  } catch (error) {
    logger.actions.error('Failed to delete message', error);
    return { success: false, error: 'Failed to delete' };
  }
}

/**
 * Get the last assistant message with output image (for edit operations)
 */
export async function getLastGeneratedImage(projectId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const db = await getDb();

    const message = await db
      .select()
      .from(projectMessage)
      .where(
        and(
          eq(projectMessage.projectId, projectId),
          eq(projectMessage.role, 'assistant'),
          sql`${projectMessage.outputImage} IS NOT NULL`,
          eq(projectMessage.status, 'completed')
        )
      )
      .orderBy(sql`${projectMessage.orderIndex} DESC`)
      .limit(1);

    if (!message.length) {
      return { success: false, error: 'No generated image found' };
    }

    return { success: true, data: message[0] as ProjectMessageItem };
  } catch (error) {
    logger.actions.error('Failed to get last image', error);
    return { success: false, error: 'Failed to get image' };
  }
}
