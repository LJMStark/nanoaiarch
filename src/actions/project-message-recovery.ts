'use server';

// Lease-expiry recovery + Duomi async-task settlement extracted from
// project-message.ts so neither file balloons past 1500 lines. Public
// entry points are still re-exported from `project-message.ts` for
// backward compatibility with existing callers (cron sweeper, tests).

import { GENERATION_LEASE_DURATION_MS } from '@/ai/image/config/generation-recovery';
import { getCreditCost } from '@/ai/image/lib/credit-costs';
import { getDuomiImageTaskStatus } from '@/ai/image/lib/duomi-client';
import type { GenerationParams as SharedGenerationParams } from '@/ai/image/lib/workspace-types';
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
import { logger } from '@/lib/logger';
import { and, eq, sql } from 'drizzle-orm';
import {
  type ExpiredGeneratingMessageRow,
  type GeneratingMessageRow,
  type MessageStatusResult,
  type MessageStatusRow,
  type RecoveryTrigger,
  parseGenerationParams,
} from './project-message-internal';

/**
 * Direct DB write for failed-recovery transitions. Bypasses the normal
 * `updateAssistantMessage` path (which expects an active request session)
 * because recovery runs on behalf of the user from cron or other servers.
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

      // If settleDuomiTaskMessage returned null for a row that has a Duomi
      // task ID, the task is still running (or a transient query error
      // occurred). Either way, do not apply the normal lease-expiry kill path
      // — the task will be settled on the next poll or sweep cycle.
      const rowParams = parseGenerationParams(row.generationParams);
      if (settled === null && rowParams?.duomiTaskId) {
        logger.actions.info(
          `generation recovery: Duomi task still in-flight, skipping kill [messageId=${row.id}, taskId=${rowParams.duomiTaskId}, trigger=${trigger}]`
        );
        continue;
      }

      const hold = await findLatestHoldForMessage(row.id, row.userId);
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

/**
 * @internal Exported only so `project-message.ts#getMessageStatus` can
 * reuse it after the split. Not meant for use outside this module pair.
 */
export async function settleDuomiTaskMessage(
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

  // 5-second timeout per query so a slow/hung Duomi API call never blocks the
  // bootstrap path (lazy-create) or status checks indefinitely.
  const ac = new AbortController();
  const timeoutId = setTimeout(() => ac.abort(), 5000);
  let task: Awaited<ReturnType<typeof getDuomiImageTaskStatus>>;
  try {
    task = await getDuomiImageTaskStatus(
      generationParams.duomiTaskId,
      ac.signal
    );
  } catch {
    // AbortError or unexpected fetch throw → treat as transient query error.
    task = { status: 'query_error', error: 'Task status query timed out' };
  } finally {
    clearTimeout(timeoutId);
  }

  if (task.status === 'query_error') {
    // Transient API error (429, 503, network, timeout) — do not treat as task
    // failure. Return null so the caller retries on the next poll/sweep cycle.
    return null;
  }
  if (task.status === 'pending' || task.status === 'running') {
    // Force-kill tasks that have been in-flight for more than 3× the lease
    // duration (15 min). At that point the Duomi task is effectively stuck and
    // will never complete; continuing to skip it only accumulates zombie rows
    // that slow down every subsequent recovery sweep.
    const elapsed = getGenerationElapsedMs(generationParams);
    const MAX_DUOMI_TASK_AGE_MS = 3 * GENERATION_LEASE_DURATION_MS;
    if (elapsed !== null && elapsed > MAX_DUOMI_TASK_AGE_MS) {
      logger.actions.warn(
        `generation recovery: Duomi task exceeded max age, force-killing [messageId=${params.messageId}, elapsed=${elapsed}ms, taskId=${generationParams.duomiTaskId}]`
      );
      const hold = await findLatestHoldForMessage(
        params.messageId,
        params.userId
      );
      if (hold?.holdStatus === HOLD_STATUS.PENDING) {
        await releaseHold(hold.id);
      }
      const updated = await updateAssistantMessageDirect(
        params.messageId,
        params.userId,
        {
          status: 'failed',
          content: '生成超时，请重试',
          errorMessage: '生成超时，请重试',
        }
      );
      if (!updated) {
        return null;
      }
      return {
        success: true,
        data: {
          id: params.messageId,
          status: 'failed' as const,
          outputImage: null,
          errorMessage: '生成超时，请重试',
          creditsUsed: row.creditsUsed,
          generationTime: row.generationTime,
          generationLeaseExpiresAt: null,
          updatedAt: new Date(),
        },
      };
    }

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
        errorMessage: '生成失败，请重试',
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
        errorMessage: '生成失败，请重试',
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
