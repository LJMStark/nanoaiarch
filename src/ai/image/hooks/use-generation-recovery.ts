import { getMessageStatus } from '@/actions/project-message';
import { GENERATION_RECOVERY_CONFIG } from '@/ai/image/config/generation-recovery';
import { logger } from '@/lib/logger';
import { useConversationStore } from '@/stores/conversation-store';
import { useCallback, useEffect, useRef } from 'react';

/**
 * Generation state recovery and monitoring hook
 * Periodically polls database to check if generating messages have completed
 *
 * Features:
 * - Optimized API calls (fetches single message status)
 * - Auto-retry mechanism (with max attempts limit)
 * - Timeout protection (max duration limit)
 * - Proper cleanup on component unmount
 */
export function useGenerationRecovery(projectId: string | null): void {
  const { generatingMessageId, setGenerating, updateMessage } =
    useConversationStore();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  const startTimeRef = useRef(0);

  // Helper function to stop polling
  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    // Only start polling when there's a generating message
    if (!projectId || !generatingMessageId) {
      stopPolling();
      return;
    }

    // Reset counters
    retryCountRef.current = 0;
    startTimeRef.current = Date.now();

    logger.ai.info(
      `Starting generation recovery polling [messageId=${generatingMessageId}]`
    );

    // Polling function
    const checkGeneratingStatus = async () => {
      const elapsed = Date.now() - startTimeRef.current;

      // Check if max retries or max duration exceeded
      if (
        retryCountRef.current >= GENERATION_RECOVERY_CONFIG.MAX_RETRIES ||
        elapsed > GENERATION_RECOVERY_CONFIG.MAX_POLL_DURATION_MS
      ) {
        logger.ai.warn(
          `Generation polling timeout [retries=${retryCountRef.current}, elapsed=${elapsed}ms]`
        );
        setGenerating(false);
        stopPolling();
        return;
      }

      try {
        // Use optimized API to query single message status
        const result = await getMessageStatus(projectId, generatingMessageId);

        if (!result.success) {
          retryCountRef.current++;
          logger.ai.warn(
            `Failed to check message status (attempt ${retryCountRef.current}/${GENERATION_RECOVERY_CONFIG.MAX_RETRIES})`
          );
          return;
        }

        if (!result.data) {
          logger.ai.warn(
            `Generating message not found [messageId=${generatingMessageId}]`
          );
          setGenerating(false);
          stopPolling();
          return;
        }

        // Successful query, reset retry count
        retryCountRef.current = 0;

        // Check if status changed (completed or failed)
        if (result.data.status !== 'generating') {
          logger.ai.info(
            `Generation completed [messageId=${generatingMessageId}, status=${result.data.status}, elapsed=${elapsed}ms]`
          );
          // Update message state
          updateMessage(generatingMessageId, result.data);
          setGenerating(false);
          stopPolling();
        }
      } catch (error) {
        retryCountRef.current++;
        logger.ai.error(
          `Generation recovery polling error (attempt ${retryCountRef.current}/${GENERATION_RECOVERY_CONFIG.MAX_RETRIES}):`,
          error
        );
      }
    };

    // Execute immediately
    checkGeneratingStatus();

    // Start interval polling
    intervalRef.current = setInterval(
      checkGeneratingStatus,
      GENERATION_RECOVERY_CONFIG.POLL_INTERVAL_MS
    );

    return () => {
      logger.ai.info('Stopping generation recovery polling');
      stopPolling();
    };
  }, [
    projectId,
    generatingMessageId,
    setGenerating,
    updateMessage,
    stopPolling,
  ]);
}
