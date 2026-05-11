'use server';

import { GENERATION_LEASE_DURATION_MS } from '@/ai/image/config/generation-recovery';
import { validateBase64Image, validatePrompt } from '@/ai/image/lib/api-utils';
import { getCreditCost } from '@/ai/image/lib/credit-costs';
import { getDuomiImageTaskStatus } from '@/ai/image/lib/duomi-client';
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
  GenerationParams as SharedGenerationParams,
  ProjectMessageItem as SharedProjectMessageItem,
} from '@/ai/image/lib/workspace-types';
import {
  confirmHold,
  findHoldRecordByIdempotencyKey,
  findLatestHoldRecordByIdempotencyKeyPrefix,
  releaseHold,
} from '@/credits/credits';
import { HOLD_STATUS } from '@/credits/types';
import { getDb } from '@/db';
import { imageProject, projectMessage } from '@/db/schema';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { auth } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { headers } from 'next/headers';

function generateId(): string {
  return crypto.randomUUID();
}

function nextLeaseExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + GENERATION_LEASE_DURATION_MS);
}

function parseGenerationParams(
  params: string | null
): SharedGenerationParams | null {
  if (!params) {
    return null;
  }

  try {
    return JSON.parse(params) as SharedGenerationParams;
  } catch (error) {
    logger.actions.warn('Failed to parse generation params', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
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
  duomiTaskId?: string;
  duomiTaskStatus?: 'pending' | 'running' | 'succeeded' | 'failed';
  duomiTaskStartedAt?: string;
  duomiTaskUpdatedAt?: string;
};

type ClientAssistantMessageUpdate = {
  content?: string;
  outputImage?: null;
  creditsUsed?: null;
  generationTime?: null;
  status?: 'generating' | 'failed';
  errorMessage?: string | null;
};

type DbClient = Awaited<ReturnType<typeof getDb>>;
type DbTransaction = Parameters<Parameters<DbClient['transaction']>[0]>[0];
type ValidatedInputImagesResult =
  | { valid: true; inputImages: string[] }
  | { valid: false; error: string };
type ExpiredGeneratingMessageRow = {
  id: string;
  projectId: string;
  userId: string;
  status: string;
  outputImage: string | null;
  errorMessage: string | null;
  creditsUsed: number | null;
  generationTime: number | null;
  generationLeaseExpiresAt: Date | null;
  updatedAt: Date;
  generationParams: string | null;
};
type RecoveryTrigger = 'lazy-project' | 'lazy-status' | 'lazy-create' | 'cron';
type MessageStatusResult =
  | {
      success: true;
      data: {
        id: string;
        status: string;
        outputImage: string | null;
        errorMessage: string | null;
        creditsUsed: number | null;
        generationTime: number | null;
        generationLeaseExpiresAt: Date | null;
        updatedAt: Date;
      } | null;
    }
  | { success: false; error: string };

type MessageStatusRow = {
  id: string;
  status: string;
  outputImage: string | null;
  errorMessage: string | null;
  creditsUsed: number | null;
  generationTime: number | null;
  generationLeaseExpiresAt: Date | null;
  updatedAt: Date;
};
type GeneratingMessageRow = MessageStatusRow & {
  generationParams: string | null;
};

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

    await recoverExpiredGeneratingMessages({
      userId: session.user.id,
      projectId,
      limit: 20,
      trigger: 'lazy-project',
    });

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
/**
 * Server-only direct update of an assistant message's terminal status.
 *
 * Skips the per-user auth check that updateAssistantMessage enforces —
 * intended for trusted recovery paths and maintenance jobs
 * where there's no acting user. The userId argument is still required as
 * a write filter so a stray call can't transition another user's message.
 *
 * Always clears generationLeaseExpiresAt: a recovery finalization is by
 * definition a terminal state.
 */
export async function updateAssistantMessageDirect(
  messageId: string,
  userId: string,
  data: {
    status: 'failed';
    content?: string;
    errorMessage?: string;
    leaseExpiredBefore?: Date;
  }
): Promise<MessageStatusRow | null> {
  const db = await getDb();
  const conditions = [
    eq(projectMessage.id, messageId),
    eq(projectMessage.userId, userId),
    eq(projectMessage.status, 'generating'),
  ];

  if (data.leaseExpiredBefore) {
    conditions.push(
      sql`${projectMessage.generationLeaseExpiresAt} IS NOT NULL`,
      sql`${projectMessage.generationLeaseExpiresAt} < ${data.leaseExpiredBefore.toISOString()}::timestamp`
    );
  }

  const result = await db
    .update(projectMessage)
    .set({
      status: data.status,
      content: data.content ?? '',
      errorMessage: data.errorMessage ?? null,
      generationLeaseExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(and(...conditions))
    .returning({
      id: projectMessage.id,
      status: projectMessage.status,
      outputImage: projectMessage.outputImage,
      errorMessage: projectMessage.errorMessage,
      creditsUsed: projectMessage.creditsUsed,
      generationTime: projectMessage.generationTime,
      generationLeaseExpiresAt: projectMessage.generationLeaseExpiresAt,
      updatedAt: projectMessage.updatedAt,
    });

  return result[0] ?? null;
}

/**
 * Find generating messages whose lease has expired (Week 4.1).
 *
 * Returns lightweight rows (id + projectId + userId) that the recovery path
 * will transition to status='failed' and release the associated credit hold for.
 *
 * Server-only — no auth check. Callers must either be trusted maintenance
 * routes or pass the authenticated userId for request-triggered recovery.
 */
export async function findExpiredGeneratingMessages(opts: {
  /** Hard cap on rows returned per sweep to bound load. */
  limit?: number;
  /** Optional override of "now" for tests. */
  now?: Date;
  /** Optional owner filter for request-triggered recovery. */
  userId?: string;
  /** Optional project filter for request-triggered recovery. */
  projectId?: string;
  /** Optional message filter for status polling recovery. */
  messageId?: string;
}): Promise<ExpiredGeneratingMessageRow[]> {
  const db = await getDb();
  const now = opts.now ?? new Date();
  const limit = opts.limit ?? 100;
  const conditions = [
    eq(projectMessage.status, 'generating'),
    sql`${projectMessage.generationLeaseExpiresAt} IS NOT NULL`,
    sql`${projectMessage.generationLeaseExpiresAt} < ${now.toISOString()}::timestamp`,
  ];

  if (opts.userId) {
    conditions.push(eq(projectMessage.userId, opts.userId));
  }
  if (opts.projectId) {
    conditions.push(eq(projectMessage.projectId, opts.projectId));
  }
  if (opts.messageId) {
    conditions.push(eq(projectMessage.id, opts.messageId));
  }

  const rows = await db
    .select({
      id: projectMessage.id,
      projectId: projectMessage.projectId,
      userId: projectMessage.userId,
      status: projectMessage.status,
      outputImage: projectMessage.outputImage,
      errorMessage: projectMessage.errorMessage,
      creditsUsed: projectMessage.creditsUsed,
      generationTime: projectMessage.generationTime,
      generationLeaseExpiresAt: projectMessage.generationLeaseExpiresAt,
      updatedAt: projectMessage.updatedAt,
      generationParams: projectMessage.generationParams,
    })
    .from(projectMessage)
    .where(and(...conditions))
    .limit(limit);

  return rows;
}

async function recordLeaseSweepAudit(params: {
  row: ExpiredGeneratingMessageRow;
  holdId: string | null;
  holdStatus: string | null;
  trigger: RecoveryTrigger;
  resolution?: string;
}): Promise<void> {
  await recordAudit({
    userId: params.row.userId,
    actorId: null,
    action: AUDIT_ACTIONS.CREDIT_LEASE_SWEEP,
    entityType: 'project_message',
    entityId: params.row.id,
    metadata: {
      holdId: params.holdId,
      holdStatus: params.holdStatus,
      projectId: params.row.projectId,
      trigger: params.trigger,
      resolution: params.resolution ?? 'lease-expired',
    },
  });
}

export async function recoverExpiredGeneratingMessages(opts: {
  limit?: number;
  now?: Date;
  userId?: string;
  projectId?: string;
  messageId?: string;
  trigger?: RecoveryTrigger;
}): Promise<{ scanned: number; recovered: number; errors: number }> {
  const now = opts.now ?? new Date();
  const trigger = opts.trigger ?? 'lazy-project';
  const expired = await findExpiredGeneratingMessages({ ...opts, now });
  let recovered = 0;
  let errors = 0;

  for (const row of expired) {
    try {
      const settled = await settleDuomiTaskMessage(
        {
          projectId: row.projectId,
          messageId: row.id,
          userId: row.userId,
        },
        row
      );

      if (settled?.success === true && settled.data?.status !== 'generating') {
        await recordLeaseSweepAudit({
          row,
          holdId: null,
          holdStatus: null,
          trigger,
          resolution: `duomi-${settled.data?.status ?? 'settled'}`,
        });
        recovered += 1;
        continue;
      }

      const exactHold = await findHoldRecordByIdempotencyKey(
        `gen-hold:${row.id}`,
        row.userId
      );
      const hold =
        exactHold?.holdStatus === HOLD_STATUS.PENDING
          ? exactHold
          : ((await findLatestHoldRecordByIdempotencyKeyPrefix(
              `gen-hold:${row.id}:`,
              row.userId
            )) ?? exactHold);
      const holdId = hold?.id ?? null;

      if (hold?.holdStatus === HOLD_STATUS.PENDING) {
        try {
          await releaseHold(hold.id);
        } catch (releaseError) {
          logger.actions.error(
            `generation recovery: releaseHold failed [messageId=${row.id}, holdId=${hold.id}]`,
            releaseError
          );
          throw releaseError;
        }
      } else if (hold?.holdStatus === HOLD_STATUS.CONFIRMED) {
        logger.actions.warn(
          `generation recovery: hold already confirmed, finalizing message without refund [messageId=${row.id}, holdId=${hold.id}]`
        );
      }

      const terminalContent =
        hold?.holdStatus === HOLD_STATUS.CONFIRMED
          ? '生成结果保存失败，请重试'
          : '生成超时，请重试';
      const terminalError =
        hold?.holdStatus === HOLD_STATUS.CONFIRMED
          ? 'Generation result was not saved after credit confirmation'
          : 'Generation timed out (lease expired)';

      const updated = await updateAssistantMessageDirect(row.id, row.userId, {
        status: 'failed',
        content: terminalContent,
        errorMessage: terminalError,
        leaseExpiredBefore: now,
      });

      if (!updated) {
        logger.actions.info(
          `generation recovery: skipped stale row [messageId=${row.id}, projectId=${row.projectId}, trigger=${trigger}]`
        );
        continue;
      }

      await recordLeaseSweepAudit({
        row,
        holdId,
        holdStatus: hold?.holdStatus ?? null,
        trigger,
      });

      recovered += 1;
    } catch (error) {
      errors += 1;
      logger.actions.error(
        `generation recovery: row failed [messageId=${row.id}, projectId=${row.projectId}, trigger=${trigger}]`,
        error
      );
    }
  }

  return { scanned: expired.length, recovered, errors };
}

async function findLatestHoldForMessage(
  messageId: string,
  userId: string
): Promise<{ id: string; holdStatus: string | null } | null> {
  const exactHold = await findHoldRecordByIdempotencyKey(
    `gen-hold:${messageId}`,
    userId
  );

  if (exactHold?.holdStatus === HOLD_STATUS.PENDING) {
    return exactHold;
  }

  return (
    (await findLatestHoldRecordByIdempotencyKeyPrefix(
      `gen-hold:${messageId}:`,
      userId
    )) ?? exactHold
  );
}

function getGenerationElapsedMs(params: SharedGenerationParams): number | null {
  if (!params.duomiTaskStartedAt) {
    return null;
  }

  const startedAt = new Date(params.duomiTaskStartedAt).getTime();
  if (Number.isNaN(startedAt)) {
    return null;
  }

  return Math.max(0, Date.now() - startedAt);
}

async function settleDuomiTaskMessage(
  params: {
    projectId: string;
    messageId: string;
    userId: string;
  },
  row: GeneratingMessageRow
): Promise<MessageStatusResult | null> {
  if (row.status !== 'generating') {
    return null;
  }

  const generationParams = parseGenerationParams(row.generationParams);
  if (!generationParams?.duomiTaskId) {
    return null;
  }

  const task = await getDuomiImageTaskStatus(generationParams.duomiTaskId);
  if (task.status === 'pending' || task.status === 'running') {
    if (task.status !== generationParams.duomiTaskStatus) {
      const now = new Date();
      const db = await getDb();
      await db
        .update(projectMessage)
        .set({
          generationParams: JSON.stringify({
            ...generationParams,
            duomiTaskStatus: task.status,
            duomiTaskUpdatedAt: now.toISOString(),
          }),
          updatedAt: now,
        })
        .where(
          and(
            eq(projectMessage.id, params.messageId),
            eq(projectMessage.userId, params.userId),
            eq(projectMessage.status, 'generating')
          )
        );
    }

    return null;
  }

  const hold = await findLatestHoldForMessage(params.messageId, params.userId);
  if (task.status === 'failed') {
    if (hold?.holdStatus === HOLD_STATUS.PENDING) {
      await releaseHold(hold.id);
    }

    const updated = await updateAssistantMessageDirect(
      params.messageId,
      params.userId,
      {
        status: 'failed',
        content: task.error || '生成失败，请重试',
        errorMessage: task.error || 'Duomi task failed',
      }
    );

    if (!updated) {
      return null;
    }

    const now = new Date();
    return {
      success: true,
      data: {
        id: params.messageId,
        status: 'failed',
        outputImage: null,
        errorMessage: task.error || 'Duomi task failed',
        creditsUsed: row.creditsUsed,
        generationTime: row.generationTime,
        generationLeaseExpiresAt: null,
        updatedAt: now,
      },
    };
  }

  if (!task.image) {
    return null;
  }

  if (hold?.holdStatus === HOLD_STATUS.PENDING) {
    await confirmHold(hold.id);
  }

  const elapsed = getGenerationElapsedMs(generationParams);
  const creditsUsed =
    hold?.holdStatus === HOLD_STATUS.CONFIRMED && row.creditsUsed !== null
      ? row.creditsUsed
      : getCreditCost('gpt-image-2');
  const completedGenerationParams = {
    ...generationParams,
    duomiTaskStatus: 'succeeded' as const,
    duomiTaskUpdatedAt: new Date().toISOString(),
  };

  const db = await getDb();
  const result = await db.transaction(
    async (tx): Promise<MessageStatusRow | null> => {
      const updatedMessages = await tx
        .update(projectMessage)
        .set({
          status: 'completed',
          content: '',
          outputImage: task.image,
          generationParams: JSON.stringify(completedGenerationParams),
          creditsUsed,
          generationTime: elapsed,
          errorMessage: null,
          generationLeaseExpiresAt: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(projectMessage.id, params.messageId),
            eq(projectMessage.userId, params.userId),
            eq(projectMessage.projectId, params.projectId),
            eq(projectMessage.status, 'generating')
          )
        )
        .returning({
          id: projectMessage.id,
          status: projectMessage.status,
          outputImage: projectMessage.outputImage,
          errorMessage: projectMessage.errorMessage,
          creditsUsed: projectMessage.creditsUsed,
          generationTime: projectMessage.generationTime,
          generationLeaseExpiresAt: projectMessage.generationLeaseExpiresAt,
          updatedAt: projectMessage.updatedAt,
        });

      if (!updatedMessages.length) {
        return null;
      }

      await tx
        .update(imageProject)
        .set({
          generationCount: sql`${imageProject.generationCount} + 1`,
          totalCreditsUsed: sql`${imageProject.totalCreditsUsed} + ${creditsUsed}`,
          coverImage: task.image,
          lastActiveAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(imageProject.id, params.projectId),
            eq(imageProject.userId, params.userId)
          )
        );

      return updatedMessages[0];
    }
  );

  if (!result) {
    return null;
  }

  return {
    success: true,
    data: {
      id: result.id,
      status: result.status,
      outputImage: result.outputImage,
      errorMessage: result.errorMessage,
      creditsUsed: result.creditsUsed,
      generationTime: result.generationTime,
      generationLeaseExpiresAt: result.generationLeaseExpiresAt,
      updatedAt: result.updatedAt,
    },
  };
}

export async function getMessageStatus(projectId: string, messageId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    await recoverExpiredGeneratingMessages({
      userId: session.user.id,
      projectId,
      messageId,
      limit: 1,
      trigger: 'lazy-status',
    });

    const db = await getDb();

    const message = await db
      .select({
        id: projectMessage.id,
        status: projectMessage.status,
        outputImage: projectMessage.outputImage,
        errorMessage: projectMessage.errorMessage,
        creditsUsed: projectMessage.creditsUsed,
        generationTime: projectMessage.generationTime,
        generationParams: projectMessage.generationParams,
        // Lease expiry surfaces to the client so the recovery hook can decide
        // whether a "still generating" row is genuinely live or already past
        // its lease window. getMessageStatus also triggers server-side
        // recovery before this row is returned.
        generationLeaseExpiresAt: projectMessage.generationLeaseExpiresAt,
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

    const settled = await settleDuomiTaskMessage(
      {
        projectId,
        messageId,
        userId: session.user.id,
      },
      message[0]
    );

    if (settled) {
      return settled;
    }

    const { generationParams: _generationParams, ...statusMessage } =
      message[0];
    return { success: true, data: statusMessage };
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

  const promptValidation = validatePrompt(data.content);
  if (!promptValidation.valid) {
    return { success: false, error: promptValidation.error };
  }

  const generationPromptValidation = validatePrompt(
    data.generationParams.prompt
  );
  if (!generationPromptValidation.valid) {
    return { success: false, error: generationPromptValidation.error };
  }

  const inputImagesResult = getValidatedInputImages(data.inputImages ?? []);
  if (!inputImagesResult.valid) {
    return { success: false, error: inputImagesResult.error };
  }
  const { inputImages } = inputImagesResult;
  const generationParams: GenerationParams = {
    prompt: data.generationParams.prompt,
    ...(data.generationParams.enhancedPrompt
      ? { enhancedPrompt: data.generationParams.enhancedPrompt }
      : {}),
    ...(data.generationParams.style
      ? { style: data.generationParams.style }
      : {}),
    ...(data.generationParams.aspectRatio
      ? { aspectRatio: data.generationParams.aspectRatio }
      : {}),
    ...(data.generationParams.model
      ? { model: data.generationParams.model }
      : {}),
    ...(data.generationParams.imageQuality
      ? { imageQuality: data.generationParams.imageQuality }
      : {}),
  };

  try {
    await recoverExpiredGeneratingMessages({
      userId: session.user.id,
      projectId,
      limit: 50,
      trigger: 'lazy-create',
    });

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
          ...generationParams,
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
          // Stamp the initial lease so server-side recovery can reap this row
          // if the client crashes before update.
          generationLeaseExpiresAt:
            assistantMessage.status === 'generating'
              ? nextLeaseExpiry(now)
              : null,
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
    if (data.status !== undefined) {
      updates.status = data.status;
      // Lease lifecycle:
      //  - generating  -> set/refresh the lease window
      //  - completed/failed -> clear the lease (work is done)
      updates.generationLeaseExpiresAt =
        data.status === 'generating' ? nextLeaseExpiry() : null;
    }
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
 * Client-facing assistant message update.
 *
 * The browser may only mark a generation as failed/cancelled or reset a failed
 * message before retrying. Completed results, output images, credits, and
 * generation metadata are only written by the server-side generation route.
 */
export async function updateAssistantMessageFromClient(
  messageId: string,
  data: ClientAssistantMessageUpdate
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const db = await getDb();
    const currentMessage = await db
      .select()
      .from(projectMessage)
      .where(
        and(
          eq(projectMessage.id, messageId),
          eq(projectMessage.userId, session.user.id)
        )
      )
      .limit(1);

    if (!currentMessage.length) {
      return { success: false, error: 'Message not found' };
    }

    if (currentMessage[0].role !== 'assistant') {
      return {
        success: false,
        error: 'Only assistant messages can be updated',
      };
    }

    const now = new Date();

    if (data.status === 'generating') {
      if (currentMessage[0].status !== 'failed') {
        return {
          success: true,
          data: hydrateProjectMessage(currentMessage[0]),
        };
      }

      const result = await db
        .update(projectMessage)
        .set({
          content: data.content ?? '',
          outputImage: null,
          creditsUsed: null,
          generationTime: null,
          status: 'generating',
          errorMessage: null,
          // Re-arm the lease window for the retry attempt.
          generationLeaseExpiresAt: nextLeaseExpiry(now),
          updatedAt: now,
        })
        .where(
          and(
            eq(projectMessage.id, messageId),
            eq(projectMessage.userId, session.user.id),
            eq(projectMessage.status, 'failed')
          )
        )
        .returning();

      if (!result.length) {
        const latestMessage = await db
          .select()
          .from(projectMessage)
          .where(
            and(
              eq(projectMessage.id, messageId),
              eq(projectMessage.userId, session.user.id)
            )
          )
          .limit(1);

        if (latestMessage.length) {
          return {
            success: true,
            data: hydrateProjectMessage(latestMessage[0]),
          };
        }

        return { success: false, error: 'Message state changed' };
      }

      return { success: true, data: hydrateProjectMessage(result[0]) };
    }

    if (data.status === 'failed') {
      if (!['generating', 'failed'].includes(currentMessage[0].status)) {
        return {
          success: true,
          data: hydrateProjectMessage(currentMessage[0]),
        };
      }

      const updates: Record<string, unknown> = {
        status: 'failed',
        errorMessage: data.errorMessage ?? null,
        // Failed terminal state: clear the lease so recovery ignores us.
        generationLeaseExpiresAt: null,
        updatedAt: now,
      };

      if (data.content !== undefined) {
        updates.content = data.content;
      }

      const result = await db
        .update(projectMessage)
        .set(updates)
        .where(
          and(
            eq(projectMessage.id, messageId),
            eq(projectMessage.userId, session.user.id),
            inArray(projectMessage.status, ['generating', 'failed'])
          )
        )
        .returning();

      if (!result.length) {
        const latestMessage = await db
          .select()
          .from(projectMessage)
          .where(
            and(
              eq(projectMessage.id, messageId),
              eq(projectMessage.userId, session.user.id)
            )
          )
          .limit(1);

        if (latestMessage.length) {
          return {
            success: true,
            data: hydrateProjectMessage(latestMessage[0]),
          };
        }

        return { success: false, error: 'Message state changed' };
      }

      return { success: true, data: hydrateProjectMessage(result[0]) };
    }

    return { success: false, error: 'Invalid assistant message update' };
  } catch (error) {
    logger.actions.error('Failed to update client assistant message', error);
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
