import type { ProjectMessageItem } from '@/actions/project-message';
import { create } from 'zustand';

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

export const useConversationStore = create<ConversationState>((set, get) => ({
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
}));
