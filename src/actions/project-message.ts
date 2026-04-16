'use server';

import { validateBase64Image } from '@/ai/image/lib/api-utils';
import {
  getPrimaryInputImage,
  resolveInputImages,
  serializeInputImages,
} from '@/ai/image/lib/input-images';
import { hydrateProjectMessage } from '@/ai/image/lib/project-message-utils';
import { validateReferenceImages } from '@/ai/image/lib/request-validation';
import { generateProjectTitle } from '@/ai/image/lib/title-generator';
import type {
  GeminiConversationPart,
  ProjectMessageItem as SharedProjectMessageItem,
} from '@/ai/image/lib/workspace-types';
import { getDb } from '@/db';
import { imageProject, projectMessage } from '@/db/schema';
import { auth } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { and, asc, eq, sql } from 'drizzle-orm';
import { headers } from 'next/headers';

function generateId(): string {
  return crypto.randomUUID();
}

export type MessageRole = 'user' | 'assistant';

export type ProjectMessageItem = SharedProjectMessageItem;

export type GenerationParams = {
  prompt: string;
  enhancedPrompt?: string;
  /** @deprecated Legacy field for historical data display in gallery */
  style?: string;
  aspectRatio?: string;
  model?: string;
  imageQuality?: string;
  inputImages?: string[];
  modelResponseParts?: GeminiConversationPart[];
};

type DbClient = Awaited<ReturnType<typeof getDb>>;
type DbTransaction = Parameters<Parameters<DbClient['transaction']>[0]>[0];
type ValidatedInputImagesResult =
  | { valid: true; inputImages: string[] }
  | { valid: false; error: string };

function getValidatedInputImages(
  images: Array<string | null | undefined>
): ValidatedInputImagesResult {
  const inputImages = resolveInputImages(images);
  const validation = validateReferenceImages(undefined, inputImages);

  if (!validation.valid) {
    return { valid: false, error: validation.error };
  }

  return { valid: true, inputImages };
}

async function getLockedNextOrderIndex(
  tx: DbTransaction,
  projectId: string,
  userId: string
): Promise<number | null> {
  const project = await tx
    .select({ id: imageProject.id })
    .from(imageProject)
    .where(and(eq(imageProject.id, projectId), eq(imageProject.userId, userId)))
    .for('update')
    .limit(1);

  if (!project.length) {
    return null;
  }

  const lastMessage = await tx
    .select({ orderIndex: projectMessage.orderIndex })
    .from(projectMessage)
    .where(eq(projectMessage.projectId, projectId))
    .orderBy(sql`${projectMessage.orderIndex} DESC`)
    .limit(1);

  return (lastMessage[0]?.orderIndex ?? -1) + 1;
}

function scheduleProjectTitleGeneration(
  projectId: string,
  prompt: string
): void {
  generateProjectTitle(prompt)
    .then(async (title) => {
      try {
        const db = await getDb();
        await db
          .update(imageProject)
          .set({ title, updatedAt: new Date() })
          .where(eq(imageProject.id, projectId));
        logger.ai.info(
          `[Auto Title] Updated project ${projectId} with title: "${title}"`
        );
      } catch (error) {
        logger.ai.error('[Auto Title] Failed to update project title:', error);
      }
    })
    .catch((error) => {
      logger.ai.error('[Auto Title] Failed to generate title:', error);
    });
}

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

    return { success: true, data: messages.map(hydrateProjectMessage) };
  } catch (error) {
    logger.actions.error('Failed to get messages', error);
    return { success: false, error: 'Failed to get messages', data: [] };
  }
}

/**
 * Get single message status - optimized for polling
 * Only returns minimal data needed for status check
 */
export async function getMessageStatus(projectId: string, messageId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const db = await getDb();

    const message = await db
      .select({
        id: projectMessage.id,
        status: projectMessage.status,
        outputImage: projectMessage.outputImage,
        errorMessage: projectMessage.errorMessage,
        creditsUsed: projectMessage.creditsUsed,
        generationTime: projectMessage.generationTime,
        updatedAt: projectMessage.updatedAt,
      })
      .from(projectMessage)
      .where(
        and(
          eq(projectMessage.id, messageId),
          eq(projectMessage.projectId, projectId),
          eq(projectMessage.userId, session.user.id)
        )
      )
      .limit(1);

    if (!message.length) {
      return { success: false, error: 'Message not found' };
    }

    return { success: true, data: message[0] };
  } catch (error) {
    logger.actions.error('Failed to get message status', error);
    return { success: false, error: 'Failed to get message status' };
  }
}

/**
 * Add a user message to a project
 */
export async function addUserMessage(
  projectId: string,
  data: {
    content: string;
    inputImages?: string[];
  }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' };
  }

  const inputImagesResult = getValidatedInputImages(data.inputImages ?? []);
  if (!inputImagesResult.valid) {
    return { success: false, error: inputImagesResult.error };
  }
  const { inputImages } = inputImagesResult;

  try {
    const db = await getDb();
    const id = generateId();
    const now = new Date();
    let nextOrderIndex: number | null = null;

    await db.transaction(async (tx) => {
      nextOrderIndex = await getLockedNextOrderIndex(
        tx,
        projectId,
        session.user.id
      );

      if (nextOrderIndex === null) {
        return;
      }

      await tx.insert(projectMessage).values({
        id,
        projectId,
        userId: session.user.id,
        role: 'user',
        content: data.content,
        inputImage: getPrimaryInputImage(inputImages),
        inputImages: serializeInputImages(inputImages),
        orderIndex: nextOrderIndex,
        status: 'completed',
        createdAt: now,
        updatedAt: now,
      });

      // Update project message count
      await tx
        .update(imageProject)
        .set({
          messageCount: sql`${imageProject.messageCount} + 1`,
          lastActiveAt: now,
          updatedAt: now,
        })
        .where(eq(imageProject.id, projectId));
    });

    if (nextOrderIndex === null) {
      return { success: false, error: 'Project not found' };
    }

    if (nextOrderIndex === 0) {
      scheduleProjectTitleGeneration(projectId, data.content);
    }

    const message: ProjectMessageItem = {
      id,
      projectId,
      role: 'user',
      content: data.content,
      inputImage: getPrimaryInputImage(inputImages),
      inputImages,
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
    status?: 'generating' | 'completed' | 'failed';
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
    const id = generateId();
    const now = new Date();
    const status = data.status ?? 'completed';
    let nextOrderIndex: number | null = null;

    // Update project stats
    const projectUpdates: Record<string, unknown> = {
      messageCount: sql`${imageProject.messageCount} + 1`,
      lastActiveAt: now,
      updatedAt: now,
    };

    if (status === 'completed' && data.outputImage) {
      projectUpdates.generationCount = sql`${imageProject.generationCount} + 1`;
      projectUpdates.coverImage = data.outputImage;
    }

    if (data.creditsUsed) {
      projectUpdates.totalCreditsUsed = sql`${imageProject.totalCreditsUsed} + ${data.creditsUsed}`;
    }

    await db.transaction(async (tx) => {
      nextOrderIndex = await getLockedNextOrderIndex(
        tx,
        projectId,
        session.user.id
      );

      if (nextOrderIndex === null) {
        return;
      }

      await tx.insert(projectMessage).values({
        id,
        projectId,
        userId: session.user.id,
        role: 'assistant',
        content: data.content,
        inputImage: null,
        inputImages: null,
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

      await tx
        .update(imageProject)
        .set(projectUpdates)
        .where(eq(imageProject.id, projectId));
    });

    if (nextOrderIndex === null) {
      return { success: false, error: 'Project not found' };
    }

    const message: ProjectMessageItem = {
      id,
      projectId,
      role: 'assistant',
      content: data.content,
      inputImage: null,
      inputImages: [],
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

export async function createPendingGeneration(
  projectId: string,
  data: {
    content: string;
    inputImages?: string[];
    generationParams: GenerationParams;
  }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' };
  }

  const inputImagesResult = getValidatedInputImages([
    ...(data.inputImages ?? []),
    ...(data.generationParams.inputImages ?? []),
  ]);
  if (!inputImagesResult.valid) {
    return { success: false, error: inputImagesResult.error };
  }
  const { inputImages } = inputImagesResult;

  try {
    const db = await getDb();
    const now = new Date();
    const userMessageId = generateId();
    const assistantMessageId = generateId();

    const result = await db.transaction(async (tx) => {
      const nextOrderIndex = await getLockedNextOrderIndex(
        tx,
        projectId,
        session.user.id
      );

      if (nextOrderIndex === null) {
        return null;
      }

      const userMessage: ProjectMessageItem = {
        id: userMessageId,
        projectId,
        role: 'user',
        content: data.content,
        inputImage: getPrimaryInputImage(inputImages),
        inputImages,
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

      const assistantMessage: ProjectMessageItem = {
        id: assistantMessageId,
        projectId,
        role: 'assistant',
        content: '',
        inputImage: null,
        inputImages: [],
        outputImage: null,
        maskImage: null,
        generationParams: JSON.stringify({
          ...data.generationParams,
          inputImages,
        }),
        creditsUsed: null,
        generationTime: null,
        status: 'generating',
        errorMessage: null,
        orderIndex: nextOrderIndex + 1,
        createdAt: now,
      };

      await tx.insert(projectMessage).values([
        {
          id: userMessage.id,
          projectId,
          userId: session.user.id,
          role: userMessage.role,
          content: userMessage.content,
          inputImage: userMessage.inputImage,
          inputImages: serializeInputImages(userMessage.inputImages),
          outputImage: null,
          maskImage: null,
          generationParams: null,
          creditsUsed: 0,
          generationTime: null,
          status: userMessage.status,
          errorMessage: null,
          orderIndex: userMessage.orderIndex,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: assistantMessage.id,
          projectId,
          userId: session.user.id,
          role: assistantMessage.role,
          content: assistantMessage.content,
          inputImage: null,
          inputImages: null,
          outputImage: null,
          maskImage: null,
          generationParams: assistantMessage.generationParams,
          creditsUsed: 0,
          generationTime: null,
          status: assistantMessage.status,
          errorMessage: null,
          orderIndex: assistantMessage.orderIndex,
          createdAt: now,
          updatedAt: now,
        },
      ]);

      await tx
        .update(imageProject)
        .set({
          messageCount: sql`${imageProject.messageCount} + 2`,
          lastActiveAt: now,
          updatedAt: now,
        })
        .where(eq(imageProject.id, projectId));

      return {
        userMessage,
        assistantMessage,
        shouldGenerateTitle: nextOrderIndex === 0,
      };
    });

    if (!result) {
      return { success: false, error: 'Project not found' };
    }

    if (result.shouldGenerateTitle) {
      scheduleProjectTitleGeneration(projectId, data.content);
    }

    return {
      success: true,
      data: {
        userMessage: result.userMessage,
        assistantMessage: result.assistantMessage,
      },
    };
  } catch (error) {
    logger.actions.error('Failed to create pending generation', error);
    return { success: false, error: 'Failed to create pending generation' };
  }
}

/**
 * Update an assistant message (e.g., when generation completes)
 */
export async function updateAssistantMessage(
  messageId: string,
  data: {
    content?: string;
    outputImage?: string | null;
    generationParams?: GenerationParams;
    creditsUsed?: number | null;
    generationTime?: number | null;
    status?: 'generating' | 'completed' | 'failed';
    errorMessage?: string | null;
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
        role: projectMessage.role,
        status: projectMessage.status,
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

    if (message[0].role !== 'assistant') {
      return {
        success: false,
        error: 'Only assistant messages can be updated',
      };
    }

    if (data.outputImage) {
      const imageValidation = validateBase64Image(data.outputImage);
      if (!imageValidation.valid) {
        return { success: false, error: imageValidation.error };
      }
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

    const isTransitionToCompleted =
      data.status === 'completed' && message[0].status !== 'completed';
    let updatedMessage: ProjectMessageItem | null = null;

    if (isTransitionToCompleted) {
      await db.transaction(async (tx) => {
        const result = await tx
          .update(projectMessage)
          .set(updates)
          .where(
            and(
              eq(projectMessage.id, messageId),
              sql`${projectMessage.status} != 'completed'`
            )
          )
          .returning();

        if (result.length > 0) {
          updatedMessage = hydrateProjectMessage(result[0]);
          const projectUpdates: Record<string, unknown> = {
            generationCount: sql`${imageProject.generationCount} + 1`,
            lastActiveAt: new Date(),
            updatedAt: new Date(),
          };

          if (data.outputImage) {
            projectUpdates.coverImage = data.outputImage;
          }

          if (data.creditsUsed && data.creditsUsed > 0) {
            projectUpdates.totalCreditsUsed = sql`${imageProject.totalCreditsUsed} + ${data.creditsUsed}`;
          }

          await tx
            .update(imageProject)
            .set(projectUpdates)
            .where(eq(imageProject.id, message[0].projectId));
        } else {
          const existingMessage = await tx
            .select()
            .from(projectMessage)
            .where(eq(projectMessage.id, messageId))
            .limit(1);

          updatedMessage = existingMessage[0]
            ? hydrateProjectMessage(existingMessage[0])
            : null;
        }
      });
    } else {
      const result = await db
        .update(projectMessage)
        .set(updates)
        .where(eq(projectMessage.id, messageId))
        .returning();
      updatedMessage = result[0] ? hydrateProjectMessage(result[0]) : null;
    }

    return { success: true, data: updatedMessage };
  } catch (error) {
    logger.actions.error('Failed to update message', error);
    return { success: false, error: 'Failed to update message' };
  }
}

/**
 * Delete a message and update project messageCount
 */
export async function deleteMessage(messageId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const db = await getDb();

    let deletedProjectId: string | null = null;

    await db.transaction(async (tx) => {
      const deleted = await tx
        .delete(projectMessage)
        .where(
          and(
            eq(projectMessage.id, messageId),
            eq(projectMessage.userId, session.user.id)
          )
        )
        .returning({ projectId: projectMessage.projectId });

      if (!deleted.length) {
        return;
      }

      deletedProjectId = deleted[0].projectId;

      await tx
        .update(imageProject)
        .set({
          messageCount: sql`GREATEST(0, ${imageProject.messageCount} - 1)`,
          updatedAt: new Date(),
        })
        .where(eq(imageProject.id, deletedProjectId));
    });

    if (!deletedProjectId) {
      return { success: false, error: 'Message not found' };
    }

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
      return { success: false, error: 'Project not found' };
    }

    const message = await db
      .select()
      .from(projectMessage)
      .where(
        and(
          eq(projectMessage.projectId, projectId),
          eq(projectMessage.userId, session.user.id),
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

    return { success: true, data: hydrateProjectMessage(message[0]) };
  } catch (error) {
    logger.actions.error('Failed to get last image', error);
    return { success: false, error: 'Failed to get image' };
  }
}
