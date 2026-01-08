import type { ProjectMessageItem } from '@/actions/project-message';
import { logger } from '@/lib/logger';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type MessageStatus = 'pending' | 'generating' | 'completed' | 'failed';

interface ConversationState {
  // Messages
  messages: ProjectMessageItem[];
  isLoadingMessages: boolean;

  // Generation state
  isGenerating: boolean;
  generatingMessageId: string | null;

  // Current project context
  currentProjectId: string | null;

  // Actions
  setMessages: (messages: ProjectMessageItem[]) => void;
  addMessage: (message: ProjectMessageItem) => void;
  updateMessage: (
    messageId: string,
    updates: Partial<ProjectMessageItem>
  ) => void;
  removeMessage: (messageId: string) => void;

  // Loading state
  setLoadingMessages: (loading: boolean) => void;

  // Generation state
  setGenerating: (generating: boolean, messageId?: string | null) => void;

  // Project context
  setCurrentProject: (projectId: string | null) => void;

  // Clear for new project
  clearMessages: () => void;

  // Get last output image
  getLastOutputImage: () => string | null;

  // Reset
  reset: () => void;
}

const initialState = {
  messages: [] as ProjectMessageItem[],
  isLoadingMessages: false,
  isGenerating: false,
  generatingMessageId: null as string | null,
  currentProjectId: null as string | null,
};

// 自定义 storage 对象with错误处理
const customStorage = {
  getItem: (name: string): string | null => {
    try {
      const item = localStorage.getItem(name);
      return item;
    } catch (error) {
      logger.general.error('Failed to get from localStorage:', error);
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    try {
      localStorage.setItem(name, value);
    } catch (error) {
      logger.general.error('Failed to set localStorage:', error);
      // localStorage 可能已满或被禁用
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        logger.general.warn('localStorage quota exceeded, attempting cleanup');
        // 尝试清理并重试
        try {
          localStorage.removeItem(name);
          localStorage.setItem(name, value);
        } catch (retryError) {
          logger.general.error('Failed to cleanup and retry:', retryError);
        }
      }
    }
  },
  removeItem: (name: string): void => {
    try {
      localStorage.removeItem(name);
    } catch (error) {
      logger.general.error('Failed to remove from localStorage:', error);
    }
  },
};

export const useConversationStore = create<ConversationState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setMessages: (messages) => set({ messages }),

  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),

  updateMessage: (messageId, updates) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId ? { ...m, ...updates } : m
      ),
    })),

  removeMessage: (messageId) =>
    set((state) => ({
      messages: state.messages.filter((m) => m.id !== messageId),
    })),

  setLoadingMessages: (loading) => set({ isLoadingMessages: loading }),

  setGenerating: (generating, messageId = null) =>
    set({
      isGenerating: generating,
      generatingMessageId: generating ? messageId : null,
    }),

  setCurrentProject: (projectId) => {
    if (projectId !== get().currentProjectId) {
      set({
        currentProjectId: projectId,
        messages: [],
        isGenerating: false,
        generatingMessageId: null,
      });
    }
  },

  clearMessages: () =>
    set({
      messages: [],
      isGenerating: false,
      generatingMessageId: null,
    }),

  getLastOutputImage: () => {
    const messages = get().messages;
    // Find the last assistant message with an output image
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (
        msg.role === 'assistant' &&
        msg.outputImage &&
        msg.status === 'completed'
      ) {
        return msg.outputImage;
      }
    }
    return null;
  },

  reset: () => set(initialState),
}),
    {
      name: 'conversation-storage',
      storage: customStorage,
      version: 1,
      // 只持久化关键状态，messages 从数据库加载
      partialize: (state) => ({
        isGenerating: state.isGenerating,
        generatingMessageId: state.generatingMessageId,
        currentProjectId: state.currentProjectId,
      }),
      migrate: (persistedState: any, version: number) => {
        // 处理数据结构变更
        if (version === 0) {
          logger.general.info('Migrating conversation store from v0 to v1');
          // 从版本 0 迁移到版本 1（当前版本）
          return persistedState;
        }
        return persistedState as ConversationState;
      },
      onRehydrateStorage: () => {
        logger.general.info('Hydrating conversation store');
        return (state, error) => {
          if (error) {
            logger.general.error('Failed to rehydrate conversation store:', error);
          } else {
            logger.general.info('Conversation store rehydrated successfully');
          }
        };
      },
    }
  )
);
