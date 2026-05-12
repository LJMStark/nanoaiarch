// Shared, non-Server-Action helpers and types for the project-message
// module. Lives outside any `'use server'` file so it can export sync
// utilities and type aliases that both `project-message.ts` and
// `project-message-recovery.ts` consume.
//
// IMPORTANT: do NOT add `'use server'` to this file. Next.js requires
// every export of a `'use server'` module to be an async function; the
// type re-exports and sync helpers here would fail that check.

import { GENERATION_LEASE_DURATION_MS } from '@/ai/image/config/generation-recovery';
import type {
  GenerationParams as SharedGenerationParams,
  ProjectMessageItem as SharedProjectMessageItem,
} from '@/ai/image/lib/workspace-types';
import type { getDb } from '@/db';
import { logger } from '@/lib/logger';

export type MessageRole = 'user' | 'assistant';

export type ProjectMessageItem = SharedProjectMessageItem;

export type ClientAssistantMessageUpdate = {
  content?: string;
  outputImage?: null;
  creditsUsed?: null;
  generationTime?: null;
  status?: 'generating' | 'failed';
  errorMessage?: string | null;
};

export type DbClient = Awaited<ReturnType<typeof getDb>>;
export type DbTransaction = Parameters<
  Parameters<DbClient['transaction']>[0]
>[0];

export type ValidatedInputImagesResult =
  | { valid: true; inputImages: string[] }
  | { valid: false; error: string };

export type ExpiredGeneratingMessageRow = {
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

export type RecoveryTrigger =
  | 'lazy-project'
  | 'lazy-status'
  | 'lazy-create'
  | 'cron';

export type MessageStatusResult =
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

export type MessageStatusRow = {
  id: string;
  status: string;
  outputImage: string | null;
  errorMessage: string | null;
  creditsUsed: number | null;
  generationTime: number | null;
  generationLeaseExpiresAt: Date | null;
  updatedAt: Date;
};

export type GeneratingMessageRow = MessageStatusRow & {
  generationParams: string | null;
};

export function generateId(): string {
  return crypto.randomUUID();
}

export function nextLeaseExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + GENERATION_LEASE_DURATION_MS);
}

export function parseGenerationParams(
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
