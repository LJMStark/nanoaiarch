# 代码重构示例

## 1. useGenerationRecovery Hook 性能优化

### 问题代码
```typescript
// src/ai/image/hooks/use-generation-recovery.ts
export function useGenerationRecovery(projectId: string | null) {
  const { generatingMessageId, setGenerating, updateMessage, messages } =
    useConversationStore();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // 每次 messages 变化都会重新创建 interval
    const checkGeneratingStatus = async () => {
      const result = await getProjectMessages(projectId); // 获取所有消息
      // ...
    };

    intervalRef.current = setInterval(checkGeneratingStatus, 5000);

  }, [projectId, generatingMessageId, setGenerating, updateMessage, messages]); // messages 导致频繁重建
}
```

### 重构后代码
```typescript
// src/ai/image/hooks/use-generation-recovery.ts
const POLL_INTERVAL_MS = 5000;
const MAX_RETRIES = 12; // 1分钟
const MAX_POLL_DURATION_MS = 5 * 60 * 1000; // 5分钟

export function useGenerationRecovery(projectId: string | null) {
  const { generatingMessageId, setGenerating, updateMessage } =
    useConversationStore(); // 移除 messages
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  const startTimeRef = useRef(0);

  useEffect(() => {
    if (!projectId || !generatingMessageId) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    retryCountRef.current = 0;
    startTimeRef.current = Date.now();

    logger.ai.info(
      `Starting generation recovery polling [messageId=${generatingMessageId}]`
    );

    const checkGeneratingStatus = async () => {
      // 检查超时条件
      const elapsed = Date.now() - startTimeRef.current;
      if (
        retryCountRef.current >= MAX_RETRIES ||
        elapsed > MAX_POLL_DURATION_MS
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
        // 只查询单个消息状态而不是所有消息
        const result = await getMessageStatus(projectId, generatingMessageId);

        if (!result.success) {
          retryCountRef.current++;
          logger.ai.warn(
            `Failed to check message status (attempt ${retryCountRef.current})`
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

        // 检查状态是否变更
        if (result.data.status !== 'generating') {
          logger.ai.info(
            `Generation completed [messageId=${generatingMessageId}, status=${result.data.status}]`
          );
          updateMessage(generatingMessageId, result.data);
          setGenerating(false);
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        }
      } catch (error) {
        retryCountRef.current++;
        logger.ai.error(
          `Generation recovery polling error (attempt ${retryCountRef.current}):`,
          error
        );
      }
    };

    // 立即执行一次
    checkGeneratingStatus();

    // 启动定时轮询
    intervalRef.current = setInterval(checkGeneratingStatus, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        logger.ai.info('Stopping generation recovery polling');
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [projectId, generatingMessageId, setGenerating, updateMessage]); // 移除 messages
}
```

### 需要添加的新 Server Action
```typescript
// src/actions/project-message.ts

/**
 * Get single message status - optimized for polling
 * Only returns minimal data needed for status check
 */
export async function getMessageStatus(
  projectId: string,
  messageId: string
) {
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
    logger.ai.error('Failed to get message status:', error);
    return { success: false, error: 'Failed to get message status' };
  }
}
```

---

## 2. 改进 TypeScript 类型安全

### 问题代码
```typescript
// src/ai/image/components/conversation/MessageItem.tsx
function parseErrorMessage(error: unknown, t: any): string {
  if (!(error instanceof Error)) return t('errors.unexpected');
  // ...
}
```

### 重构方案 1: 使用接口
```typescript
// 在文件顶部定义
interface TranslationFunction {
  (key: string, values?: Record<string, unknown>): string;
}

function parseErrorMessage(error: unknown, t: TranslationFunction): string {
  if (!(error instanceof Error)) return t('errors.unexpected');

  const msg = error.message.toLowerCase();
  if (msg.includes('unauthorized') || msg.includes('sign in')) {
    return t('errors.signInAgain');
  }
  if (msg.includes('insufficient credits') || msg.includes('credits')) {
    return t('errors.insufficientCredits');
  }
  if (msg.includes('timeout') || msg.includes('timed out')) {
    return t('errors.timeout');
  }
  if (msg.includes('network') || msg.includes('fetch')) {
    return t('errors.network');
  }
  return error.message;
}
```

### 重构方案 2: 使用泛型（更类型安全）
```typescript
type TranslationKeys =
  | 'errors.unexpected'
  | 'errors.signInAgain'
  | 'errors.insufficientCredits'
  | 'errors.timeout'
  | 'errors.network'
  | 'errors.generationFailed'
  | 'errors.unknown';

interface TypedTranslationFunction {
  (key: TranslationKeys): string;
}

function parseErrorMessage(error: unknown, t: TypedTranslationFunction): string {
  if (!(error instanceof Error)) return t('errors.unexpected');

  const msg = error.message.toLowerCase();
  if (msg.includes('unauthorized') || msg.includes('sign in')) {
    return t('errors.signInAgain');
  }
  if (msg.includes('insufficient credits') || msg.includes('credits')) {
    return t('errors.insufficientCredits');
  }
  if (msg.includes('timeout') || msg.includes('timed out')) {
    return t('errors.timeout');
  }
  if (msg.includes('network') || msg.includes('fetch')) {
    return t('errors.network');
  }
  return error.message;
}
```

---

## 3. 移除重复的动态导入

### 问题代码
```typescript
// src/ai/image/components/conversation/ConversationInput.tsx

// 在三个地方重复
const { updateAssistantMessage } = await import('@/actions/project-message');
const updateResult = await updateAssistantMessage(generatingMessage.id, {...});
```

### 重构后代码
```typescript
// 文件顶部
import { updateProjectActivity } from '@/actions/image-project';
import {
  addAssistantMessage,
  addUserMessage,
  updateAssistantMessage  // 直接导入，无需动态导入
} from '@/actions/project-message';

// 然后在代码中直接使用
try {
  const result = await generateImage({...});
  const generationTime = Date.now() - startTime;

  if (result.success && result.image) {
    // 直接使用，无需动态导入
    const updateResult = await updateAssistantMessage(generatingMessage.id, {
      content: '',
      outputImage: result.image,
      creditsUsed: result.creditsUsed || 1,
      generationTime,
      status: 'completed',
    });

    if (updateResult.success && updateResult.data) {
      updateMessage(generatingMessage.id, updateResult.data);
      await updateProjectActivity(currentProjectId, {...});
    }
  } else {
    // 直接使用
    const updateResult = await updateAssistantMessage(generatingMessage.id, {
      content: result.error || t('errors.generationFailed'),
      status: 'failed',
      errorMessage: result.error,
    });

    if (updateResult.success && updateResult.data) {
      updateMessage(generatingMessage.id, updateResult.data);
    }
  }
} catch (error) {
  logger.ai.error('Generation error:', error);

  // 直接使用
  const updateResult = await updateAssistantMessage(generatingMessage.id, {
    content: t('errors.unexpected'),
    status: 'failed',
    errorMessage: error instanceof Error ? error.message : t('errors.unknown'),
  });

  if (updateResult.success && updateResult.data) {
    updateMessage(generatingMessage.id, updateResult.data);
  }
}
```

---

## 4. 添加 localStorage 错误处理和版本控制

### 问题代码
```typescript
// src/stores/conversation-store.ts
export const useConversationStore = create<ConversationState>()(
  persist(
    (set, get) => ({...}),
    {
      name: 'conversation-storage',
      partialize: (state) => ({...}),
    }
  )
);
```

### 重构后代码
```typescript
// src/stores/conversation-store.ts
import { logger } from '@/lib/logger';

// 自定义 storage 对象with错误处理
const customStorage = {
  getItem: (name: string): string | null => {
    try {
      const item = localStorage.getItem(name);
      return item;
    } catch (error) {
      logger.ai.error('Failed to get from localStorage:', error);
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    try {
      localStorage.setItem(name, value);
    } catch (error) {
      logger.ai.error('Failed to set localStorage:', error);
      // localStorage 可能已满或被禁用
      // 可以考虑清理旧数据或通知用户
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        logger.ai.warn('localStorage quota exceeded, attempting cleanup');
        // 可选：清理旧数据
        try {
          localStorage.removeItem(name);
          localStorage.setItem(name, value);
        } catch (retryError) {
          logger.ai.error('Failed to cleanup and retry:', retryError);
        }
      }
    }
  },
  removeItem: (name: string): void => {
    try {
      localStorage.removeItem(name);
    } catch (error) {
      logger.ai.error('Failed to remove from localStorage:', error);
    }
  },
};

export const useConversationStore = create<ConversationState>()(
  persist(
    (set, get) => ({
      ...initialState,
      // ... 所有方法
    }),
    {
      name: 'conversation-storage',
      storage: customStorage,
      version: 1, // 添加版本号
      partialize: (state) => ({
        isGenerating: state.isGenerating,
        generatingMessageId: state.generatingMessageId,
        currentProjectId: state.currentProjectId,
      }),
      migrate: (persistedState: any, version: number) => {
        // 处理数据结构变更
        if (version === 0) {
          // 从版本 0 迁移到版本 1
          logger.ai.info('Migrating conversation store from v0 to v1');
          return {
            ...persistedState,
            // 添加新字段或转换旧字段
          };
        }
        return persistedState as ConversationState;
      },
      onRehydrateStorage: () => {
        logger.ai.info('Hydrating conversation store');
        return (state, error) => {
          if (error) {
            logger.ai.error('Failed to rehydrate conversation store:', error);
          } else {
            logger.ai.info('Conversation store rehydrated successfully');
          }
        };
      },
    }
  )
);
```

---

## 5. 提取常量和配置

### 问题代码
```typescript
// 魔法数字散落在代码中
setInterval(checkGeneratingStatus, 5000);
if (retryCount >= 12) { ... }
```

### 重构后代码
```typescript
// src/ai/image/config/generation-recovery.ts
export const GENERATION_RECOVERY_CONFIG = {
  POLL_INTERVAL_MS: 5000,
  MAX_RETRIES: 12,
  MAX_POLL_DURATION_MS: 5 * 60 * 1000, // 5 minutes
  RETRY_BACKOFF_MULTIPLIER: 1.5, // 指数退避倍数
} as const;

// src/ai/image/hooks/use-generation-recovery.ts
import { GENERATION_RECOVERY_CONFIG } from '../config/generation-recovery';

export function useGenerationRecovery(
  projectId: string | null,
  options: Partial<typeof GENERATION_RECOVERY_CONFIG> = {}
) {
  const config = { ...GENERATION_RECOVERY_CONFIG, ...options };

  // 使用配置
  intervalRef.current = setInterval(
    checkGeneratingStatus,
    config.POLL_INTERVAL_MS
  );

  if (retryCountRef.current >= config.MAX_RETRIES) {
    // ...
  }
}
```

---

## 实施优先级

1. **立即实施**（本周）:
   - 修复 useGenerationRecovery 性能问题
   - 移除重复的动态导入
   - 添加 localStorage 错误处理

2. **下周实施**:
   - 改进 TypeScript 类型安全
   - 添加配置化支持
   - 编写单元测试

3. **未来考虑**:
   - 实现 WebSocket/SSE 替代轮询
   - 添加事务性保证
   - 完善错误边界处理
