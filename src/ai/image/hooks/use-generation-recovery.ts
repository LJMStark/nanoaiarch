import { GENERATION_RECOVERY_CONFIG } from '@/ai/image/config/generation-recovery';
import { isTemporaryId } from '@/ai/image/lib/temp-ids';
import {
  fetchMessageStatus,
  updateAssistantMessageRequest,
} from '@/ai/image/lib/workspace-client';
import { logger } from '@/lib/logger';
import { useConversationStore } from '@/stores/conversation-store';
import { useCallback, useEffect, useRef } from 'react';

export function useGenerationRecovery(projectId: string | null): void {
  const {
    generatingMessageId,
    setGenerating,
    setGenerationStage,
    updateMessage,
  } = useConversationStore();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  // Tracks consecutive "message not found" responses separately from generic
  // network errors. Multi-tab usage can briefly return "not found" while the
  // server propagates a write — we want to retry rather than instantly mark
  // a possibly-completed message as failed.
  const notFoundCountRef = useRef(0);
  const startTimeRef = useRef(0);

  const stopPolling = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const markGenerationFailed = useCallback(
    async (messageId: string, errorMessage: string) => {
      const state = useConversationStore.getState();
      if (state.generatingMessageId !== messageId) {
        return;
      }

      updateMessage(messageId, {
        status: 'failed',
        content: errorMessage,
        errorMessage,
      });
      setGenerating(false);
      setGenerationStage(null);
      stopPolling();

      const result = await updateAssistantMessageRequest(messageId, {
        status: 'failed',
        content: errorMessage,
        errorMessage,
      });

      if (!result.success) {
        logger.ai.error(
          `Failed to persist recovered generation failure [messageId=${messageId}]`,
          result.error
        );
      }
    },
    [setGenerating, setGenerationStage, stopPolling, updateMessage]
  );

  useEffect(() => {
    if (
      !projectId ||
      !generatingMessageId ||
      isTemporaryId(generatingMessageId)
    ) {
      stopPolling();
      return;
    }

    let cancelled = false;
    const activeMessageId = generatingMessageId;

    retryCountRef.current = 0;
    notFoundCountRef.current = 0;
    startTimeRef.current = Date.now();

    logger.ai.info(
      `Starting generation recovery polling [messageId=${activeMessageId}]`
    );

    const scheduleNextPoll = () => {
      if (cancelled) {
        return;
      }

      timeoutRef.current = setTimeout(() => {
        void pollStatus();
      }, GENERATION_RECOVERY_CONFIG.POLL_INTERVAL_MS);
    };

    const pollStatus = async () => {
      if (cancelled) {
        return;
      }

      const state = useConversationStore.getState();
      if (state.generatingMessageId !== activeMessageId) {
        return;
      }

      const elapsed = Date.now() - startTimeRef.current;
      if (
        retryCountRef.current >= GENERATION_RECOVERY_CONFIG.MAX_RETRIES ||
        elapsed > GENERATION_RECOVERY_CONFIG.MAX_POLL_DURATION_MS
      ) {
        logger.ai.warn(
          `Generation polling timeout [retries=${retryCountRef.current}, elapsed=${elapsed}ms, messageId=${activeMessageId}]`
        );
        await markGenerationFailed(activeMessageId, '生成超时，请重试');
        return;
      }

      try {
        const result = await fetchMessageStatus(projectId, activeMessageId);

        if (cancelled) {
          return;
        }

        const latestState = useConversationStore.getState();
        if (latestState.generatingMessageId !== activeMessageId) {
          return;
        }

        if (!result.success) {
          retryCountRef.current += 1;
          logger.ai.warn(
            `Failed to check message status (attempt ${retryCountRef.current}/${GENERATION_RECOVERY_CONFIG.MAX_RETRIES})`
          );
          scheduleNextPoll();
          return;
        }

        if (!result.data) {
          notFoundCountRef.current += 1;
          // Treat "not found" as transient for the first N polls. Common
          // root causes: replication lag between read replicas, multi-tab
          // race where another tab is mid-write, or a brief userId filter
          // mismatch during session refresh. Only after sustained absence
          // do we conclude the message is truly gone and mark failed —
          // otherwise a successful generation could be overwritten with
          // status=failed.
          if (
            notFoundCountRef.current <
            GENERATION_RECOVERY_CONFIG.MAX_NOT_FOUND_RETRIES
          ) {
            logger.ai.warn(
              `Generating message not found, retrying (${notFoundCountRef.current}/${GENERATION_RECOVERY_CONFIG.MAX_NOT_FOUND_RETRIES}) [messageId=${activeMessageId}]`
            );
            scheduleNextPoll();
            return;
          }

          logger.ai.warn(
            `Generating message not found after ${notFoundCountRef.current} retries [messageId=${activeMessageId}]`
          );
          await markGenerationFailed(
            activeMessageId,
            '生成任务状态已丢失，请重试'
          );
          return;
        }

        retryCountRef.current = 0;
        // Successful resolution clears the not-found backoff too.
        notFoundCountRef.current = 0;

        // Lease check: getMessageStatus runs server-side recovery before it
        // returns. If this row still shows 'generating' with an expired lease,
        // stop polling and let the next mount/request pick up the terminal
        // status after recovery.
        if (result.data.status === 'generating') {
          const leaseExpiresAt = result.data.generationLeaseExpiresAt;
          if (leaseExpiresAt) {
            const leaseExpiry = new Date(leaseExpiresAt).getTime();
            if (!Number.isNaN(leaseExpiry) && leaseExpiry < Date.now()) {
              logger.ai.warn(
                `Lease expired for generating message [messageId=${activeMessageId}, leaseExpiry=${new Date(leaseExpiry).toISOString()}]`
              );
              setGenerating(false);
              setGenerationStage(null);
              stopPolling();
              return;
            }
          }
        }

        if (result.data.status !== 'generating') {
          logger.ai.info(
            `Generation completed [messageId=${activeMessageId}, status=${result.data.status}, elapsed=${elapsed}ms]`
          );
          updateMessage(activeMessageId, result.data);
          setGenerating(false);
          setGenerationStage(null);
          stopPolling();
          return;
        }

        scheduleNextPoll();
      } catch (error) {
        retryCountRef.current += 1;
        logger.ai.error(
          `Generation recovery polling error (attempt ${retryCountRef.current}/${GENERATION_RECOVERY_CONFIG.MAX_RETRIES}):`,
          error
        );
        scheduleNextPoll();
      }
    };

    void pollStatus();

    return () => {
      cancelled = true;
      logger.ai.info('Stopping generation recovery polling');
      stopPolling();
    };
  }, [
    generatingMessageId,
    markGenerationFailed,
    projectId,
    setGenerating,
    setGenerationStage,
    stopPolling,
    updateMessage,
  ]);
}
