import type { ProjectMessageItem } from '@/actions/project-message';
import { logger } from '@/lib/logger';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

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

// Custom storage with error handling for localStorage operations
const customStorage = {
  getItem(name: string): string | null {
    try {
      return localStorage.getItem(name);
    } catch (error) {
      logger.general.error('Failed to get from localStorage:', error);
      return null;
    }
  },

  setItem(name: string, value: string): void {
    try {
      localStorage.setItem(name, value);
    } catch (error) {
      logger.general.error('Failed to set localStorage:', error);

      // Handle quota exceeded error by cleaning up and retrying
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        logger.general.warn('localStorage quota exceeded, attempting cleanup');
        try {
          localStorage.removeItem(name);
          localStorage.setItem(name, value);
        } catch (retryError) {
          logger.general.error('Failed to cleanup and retry:', retryError);
        }
      }
    }
  },

  removeItem(name: string): void {
    try {
      localStorage.removeItem(name);
    } catch (error) {
      logger.general.error('Failed to remove from localStorage:', error);
    }
  },
};

// Create storage object for zustand persist
const persistStorage = createJSONStorage(() => customStorage);

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
        // Find the last assistant message with output image
        const lastMessage = messages
          .filter(
            (msg) =>
              msg.role === 'assistant' &&
              msg.outputImage &&
              msg.status === 'completed'
          )
          .at(-1);
        return lastMessage?.outputImage ?? null;
      },

      reset: () => set(initialState),
    }),
    {
      name: 'conversation-storage',
      storage: persistStorage,
      version: 1,
      // Only persist critical state, messages are loaded from database
      partialize: (state) => ({
        isGenerating: state.isGenerating,
        generatingMessageId: state.generatingMessageId,
        currentProjectId: state.currentProjectId,
      }),
      migrate: (persistedState: unknown, version: number) => {
        // Handle data structure changes
        if (version === 0) {
          logger.general.info('Migrating conversation store from v0 to v1');
          // Migrate from version 0 to version 1 (current version)
          return persistedState as Partial<ConversationState>;
        }
        return persistedState as Partial<ConversationState>;
      },
      onRehydrateStorage: () => {
        logger.general.info('Hydrating conversation store');
        return (state, error) => {
          if (error) {
            logger.general.error(
              'Failed to rehydrate conversation store:',
              error
            );
          } else {
            logger.general.info('Conversation store rehydrated successfully');
          }
        };
      },
    }
  )
);
