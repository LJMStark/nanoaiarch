import { getProjectMessages } from '@/actions/project-message';
import { logger } from '@/lib/logger';
import { useConversationStore } from '@/stores/conversation-store';
import { useEffect, useRef } from 'react';

/**
 * Hook to recover and monitor generating messages
 * Polls the database every 5 seconds to check if generating messages have completed
 */
export function useGenerationRecovery(projectId: string | null) {
  const { generatingMessageId, setGenerating, updateMessage, messages } =
    useConversationStore();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // 只在有 generating 消息时启动轮询
    if (!projectId || !generatingMessageId) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    logger.ai.info(
      `Starting generation recovery polling [messageId=${generatingMessageId}]`
    );

    // 轮询函数
    const checkGeneratingStatus = async () => {
      try {
        const result = await getProjectMessages(projectId);
        if (!result.success) return;

        // 查找当前 generating 的消息
        const message = result.data.find((msg) => msg.id === generatingMessageId);

        if (!message) {
          logger.ai.warn(
            `Generating message not found [messageId=${generatingMessageId}]`
          );
          setGenerating(false);
          return;
        }

        // 如果状态已变更（completed 或 failed）
        if (message.status !== 'generating') {
          logger.ai.info(
            `Generation completed [messageId=${generatingMessageId}, status=${message.status}]`
          );
          updateMessage(message.id, message);
          setGenerating(false);
        }
      } catch (error) {
        logger.ai.error('Generation recovery polling error:', error);
      }
    };

    // 立即执行一次
    checkGeneratingStatus();

    // 每5秒轮询一次
    intervalRef.current = setInterval(checkGeneratingStatus, 5000);

    return () => {
      if (intervalRef.current) {
        logger.ai.info('Stopping generation recovery polling');
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [projectId, generatingMessageId, setGenerating, updateMessage, messages]);
}
