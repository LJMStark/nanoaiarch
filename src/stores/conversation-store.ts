import { resolveInputImages } from '@/ai/image/lib/input-images';
import type {
  ConversationHistoryMessage,
  GeminiConversationPart,
  GenerationParams,
  ProjectMessageItem,
} from '@/ai/image/lib/workspace-types';
import { logger } from '@/lib/logger';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type MessageStatus = 'pending' | 'generating' | 'completed' | 'failed';

export type GenerationStage =
  | 'submitting'
  | 'queued'
  | 'generating'
  | 'finishing'
  | null;

interface ConversationState {
  // Messages
  messages: ProjectMessageItem[];
  isLoadingMessages: boolean;

  // Generation state
  isGenerating: boolean;
  generatingMessageId: string | null;
  abortController: AbortController | null;
  generationRequestToken: string | null;
  generationStage: GenerationStage;

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
  replaceMessageId: (
    oldId: string,
    newId: string,
    updates?: Partial<ProjectMessageItem>
  ) => void;

  // Loading state
  setLoadingMessages: (loading: boolean) => void;

  // Generation state
  setGenerating: (generating: boolean, messageId?: string | null) => void;
  setAbortController: (controller: AbortController | null) => void;
  setGenerationRequestToken: (token: string | null) => void;
  setGenerationStage: (stage: GenerationStage) => void;
  cancelGeneration: () => void;

  // Project context
  setCurrentProject: (projectId: string | null) => void;

  // Clear for new project
  clearMessages: () => void;

  // Get last output image
  getLastOutputImage: () => string | null;

  // Get conversation history for multi-turn context
  getConversationHistory: () => ConversationHistoryMessage[];

  // Reset
  reset: () => void;
}

const initialState = {
  messages: [] as ProjectMessageItem[],
  isLoadingMessages: false,
  isGenerating: false,
  generatingMessageId: null as string | null,
  currentProjectId: null as string | null,
  abortController: null as AbortController | null,
  generationRequestToken: null as string | null,
  generationStage: null as GenerationStage,
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

function getStoredModelResponseParts(
  generationParams: string | null
): GeminiConversationPart[] | undefined {
  if (!generationParams) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(generationParams) as GenerationParams;
    if (!Array.isArray(parsed.modelResponseParts)) {
      return undefined;
    }

    return parsed.modelResponseParts.filter(
      (part): part is GeminiConversationPart => {
        if (!part || typeof part !== 'object' || !('type' in part)) {
          return false;
        }

        if (part.type === 'text') {
          return typeof part.text === 'string' && part.text.length > 0;
        }

        return part.type === 'image';
      }
    );
  } catch (error) {
    logger.general.warn('Failed to parse stored model response parts', {
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
}

function getConversationUserImageFields(
  message: ProjectMessageItem
): Pick<ConversationHistoryMessage, 'image' | 'images'> {
  const inputImages = resolveInputImages(
    message.inputImages,
    message.inputImage
  );

  if (message.inputImages.length > 0) {
    return { images: inputImages };
  }

  if (inputImages.length > 0) {
    return { image: inputImages[0] };
  }

  return {};
}

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

      replaceMessageId: (oldId, newId, updates) =>
        set((state) => ({
          messages: state.messages.map((m) =>
            m.id === oldId ? { ...m, ...updates, id: newId } : m
          ),
          generatingMessageId:
            state.generatingMessageId === oldId
              ? newId
              : state.generatingMessageId,
        })),

      setLoadingMessages: (loading) => set({ isLoadingMessages: loading }),

      setGenerating: (generating, messageId = null) =>
        set({
          isGenerating: generating,
          generatingMessageId: generating ? messageId : null,
        }),

      setAbortController: (controller) => set({ abortController: controller }),

      setGenerationRequestToken: (token) =>
        set({ generationRequestToken: token }),

      setGenerationStage: (stage) => set({ generationStage: stage }),

      cancelGeneration: () => {
        const { abortController } = get();
        if (abortController) {
          abortController.abort();
        }
      },

      setCurrentProject: (projectId) => {
        if (projectId !== get().currentProjectId) {
          const { abortController } = get();
          if (abortController) {
            abortController.abort();
          }

          set({
            currentProjectId: projectId,
            messages: [],
            isGenerating: false,
            generatingMessageId: null,
            abortController: null,
            generationRequestToken: null,
            generationStage: null,
          });
        }
      },

      clearMessages: () => {
        const { abortController } = get();
        if (abortController) {
          abortController.abort();
        }

        set({
          messages: [],
          isGenerating: false,
          generatingMessageId: null,
          abortController: null,
          generationRequestToken: null,
          generationStage: null,
        });
      },

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

      getConversationHistory: (): ConversationHistoryMessage[] => {
        const messages = get().messages;

        // Collect completed user+assistant pairs (most recent 5 rounds)
        const pairs: Array<{
          user: ProjectMessageItem;
          assistant: ProjectMessageItem;
        }> = [];

        for (let i = 0; i < messages.length - 1; i++) {
          const msg = messages[i];
          const next = messages[i + 1];
          if (
            msg.role === 'user' &&
            next.role === 'assistant' &&
            next.status === 'completed'
          ) {
            pairs.push({ user: msg, assistant: next });
          }
        }

        return pairs.slice(-5).flatMap((pair) => {
          const modelResponseParts = getStoredModelResponseParts(
            pair.assistant.generationParams
          );

          return [
            {
              role: 'user' as const,
              content: pair.user.content,
              ...getConversationUserImageFields(pair.user),
            },
            {
              role: 'model' as const,
              content: pair.assistant.content || '',
              ...(pair.assistant.outputImage && {
                image: pair.assistant.outputImage,
              }),
              ...(modelResponseParts ? { parts: modelResponseParts } : {}),
            },
          ];
        });
      },

      reset: () => set(initialState),
    }),
    {
      name: 'conversation-storage',
      storage: persistStorage,
      version: 2,
      // Only persist project selection. Generation state is recovered from
      // server-side messages to avoid reviving stale "generating" sessions.
      partialize: (state) => ({
        currentProjectId: state.currentProjectId,
      }),
      migrate: (persistedState: unknown, version: number) => {
        const state = (persistedState ?? {}) as Partial<ConversationState>;

        if (version < 2) {
          logger.general.info(
            `Migrating conversation store from v${version} to v2`
          );
        }

        return {
          currentProjectId: state.currentProjectId ?? null,
        } as Partial<ConversationState>;
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
