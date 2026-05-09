import { randomUUID } from 'crypto';
import { getDb } from '@/db';
import { auditLog } from '@/db/schema';
import { logger } from '@/lib/logger';

/**
 * Stable action verbs (Week 5.2). Add new entries here rather than
 * inlining magic strings at call sites — this is the canonical list
 * the audit query UI / customer support tools will key off of.
 *
 * Convention: lowercase domain.verb. Domain names align with module
 * boundaries (credit / payment / admin / referral / etc.).
 */
export const AUDIT_ACTIONS = {
  CREDIT_ADD: 'credit.add',
  CREDIT_CONSUME: 'credit.consume',
  CREDIT_HOLD: 'credit.hold',
  CREDIT_HOLD_CONFIRM: 'credit.hold.confirm',
  CREDIT_HOLD_RELEASE: 'credit.hold.release',
  CREDIT_ADMIN_BYPASS: 'credit.admin_bypass',
  CREDIT_LEASE_SWEEP: 'credit.lease_sweep',
  PAYMENT_REFUND: 'payment.refund',
  PAYMENT_LIFETIME_GRANT: 'payment.lifetime_grant',
  ADMIN_BAN_USER: 'admin.ban_user',
  ADMIN_UNBAN_USER: 'admin.unban_user',
  REFERRAL_BONUS: 'referral.bonus',
  REFERRAL_COMMISSION: 'referral.commission',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export interface RecordAuditInput {
  /**
   * The subject of the action — whose data was touched. Required.
   * For admin actions targeting a user, this is the *target* user, not
   * the admin.
   */
  userId: string;
  /**
   * Who performed the action. Null for system / cron / automated paths.
   */
  actorId?: string | null;
  action: AuditAction | (string & {});
  /** Optional pointer to the affected row. */
  entityType?: string | null;
  entityId?: string | null;
  /**
   * Free-form context. Goes into the JSONB column. Avoid storing large
   * blobs here — that's what creditTransaction.metadata is for. Audit
   * entries should be skim-friendly: amounts, reason codes, before/after
   * values for diffs.
   */
  metadata?: Record<string, unknown> | null;
}

/**
 * Record an audit log entry (Week 5.2).
 *
 * Behavior contract:
 *   - Append-only. Never updates or deletes existing rows.
 *   - Failure is logged but NOT thrown. The caller's primary action
 *     (credit grant, payment processing) must not be aborted because
 *     the audit row failed to persist. We accept the rare audit gap
 *     in exchange for not turning audit into a single point of failure.
 *
 * If audit becomes critical (regulatory requirement, etc.), wrap the
 * caller's primary work and the audit insert in a single transaction
 * to make them atomic.
 */
export async function recordAudit(input: RecordAuditInput): Promise<void> {
  try {
    const db = await getDb();
    await db.insert(auditLog).values({
      id: randomUUID(),
      userId: input.userId,
      actorId: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      metadata: input.metadata ?? null,
      createdAt: new Date(),
    });
  } catch (err) {
    logger.general.error('recordAudit failed', err, {
      action: input.action,
      userId: input.userId,
    });
  }
}
