import {
  getMessageStatus,
  updateAssistantMessage,
} from '@/actions/project-message';
import { GENERATION_RECOVERY_CONFIG } from '@/ai/image/config/generation-recovery';
import { logger } from '@/lib/logger';
import { useConversationStore } from '@/stores/conversation-store';
import { useCallback, useEffect, useRef } from 'react';

export function useGenerationRecovery(projectId: string | null): void {
  const { generatingMessageId, setGenerating, updateMessage } =
    useConversationStore();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
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
      stopPolling();

      const result = await updateAssistantMessage(messageId, {
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
    [setGenerating, stopPolling, updateMessage]
  );

  useEffect(() => {
    if (!projectId || !generatingMessageId) {
      stopPolling();
      return;
    }

    let cancelled = false;
    const activeMessageId = generatingMessageId;

    retryCountRef.current = 0;
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
        const result = await getMessageStatus(projectId, activeMessageId);

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
          logger.ai.warn(
            `Generating message not found [messageId=${activeMessageId}]`
          );
          await markGenerationFailed(
            activeMessageId,
            '生成任务状态已丢失，请重试'
          );
          return;
        }

        retryCountRef.current = 0;

        if (result.data.status !== 'generating') {
          logger.ai.info(
            `Generation completed [messageId=${activeMessageId}, status=${result.data.status}, elapsed=${elapsed}ms]`
          );
          updateMessage(activeMessageId, result.data);
          setGenerating(false);
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
    stopPolling,
    updateMessage,
  ]);
}
