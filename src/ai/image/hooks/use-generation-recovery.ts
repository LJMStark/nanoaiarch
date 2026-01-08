import { getMessageStatus } from '@/actions/project-message';
import { GENERATION_RECOVERY_CONFIG } from '@/ai/image/config/generation-recovery';
import { logger } from '@/lib/logger';
import { useConversationStore } from '@/stores/conversation-store';
import { useEffect, useRef } from 'react';

/**
 * Hook to recover and monitor generating messages
 * Polls the database at configured intervals to check if generating messages have completed
 *
 * Features:
 * - Optimized API calls (only fetches single message status)
 * - Automatic retry with max attempts
 * - Timeout after max duration
 * - Proper cleanup on unmount
 */
export function useGenerationRecovery(projectId: string | null) {
  const { generatingMessageId, setGenerating, updateMessage } =
    useConversationStore();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  const startTimeRef = useRef(0);

  useEffect(() => {
    // 只在有 generating 消息时启动轮询
    if (!projectId || !generatingMessageId) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // 重置计数器
    retryCountRef.current = 0;
    startTimeRef.current = Date.now();

    logger.ai.info(
      `Starting generation recovery polling [messageId=${generatingMessageId}]`
    );

    // 轮询函数
    const checkGeneratingStatus = async () => {
      const elapsed = Date.now() - startTimeRef.current;

      // 检查是否超过最大重试次数或最大持续时间
      if (
        retryCountRef.current >= GENERATION_RECOVERY_CONFIG.MAX_RETRIES ||
        elapsed > GENERATION_RECOVERY_CONFIG.MAX_POLL_DURATION_MS
      ) {
        logger.ai.warn(
          `Generation polling timeout [retries=${retryCountRef.current}, elapsed=${elapsed}ms]`
        );
        setGenerating(false);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        return;
      }

      try {
        // 使用优化的 API 只查询单个消息状态
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
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          return;
        }

        // 成功查询，重置重试计数
        retryCountRef.current = 0;

        // 检查状态是否变更（completed 或 failed）
        if (result.data.status !== 'generating') {
          logger.ai.info(
            `Generation completed [messageId=${generatingMessageId}, status=${result.data.status}, elapsed=${elapsed}ms]`
          );
          // 更新消息状态
          updateMessage(generatingMessageId, result.data);
          setGenerating(false);

          // 清理 interval
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        }
      } catch (error) {
        retryCountRef.current++;
        logger.ai.error(
          `Generation recovery polling error (attempt ${retryCountRef.current}/${GENERATION_RECOVERY_CONFIG.MAX_RETRIES}):`,
          error
        );
      }
    };

    // 立即执行一次
    checkGeneratingStatus();

    // 启动定时轮询
    intervalRef.current = setInterval(
      checkGeneratingStatus,
      GENERATION_RECOVERY_CONFIG.POLL_INTERVAL_MS
    );

    return () => {
      if (intervalRef.current) {
        logger.ai.info('Stopping generation recovery polling');
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [projectId, generatingMessageId, setGenerating, updateMessage]); // 移除了 messages 依赖
}
