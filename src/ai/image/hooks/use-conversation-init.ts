import {
  fetchConversationInitData,
  fetchProjectMessages,
} from '@/ai/image/lib/workspace-client';
import type { ConversationInitMode } from '@/ai/image/lib/workspace-types';
import { useConversationStore } from '@/stores/conversation-store';
import { useProjectStore } from '@/stores/project-store';
import { useCallback, useEffect, useRef } from 'react';

function syncRecoveredGenerationState(
  messages: Array<{ role: string; status: string; id: string }>,
  setGenerating: (generating: boolean, messageId?: string | null) => void,
  setGenerationStage: (
    stage: 'submitting' | 'queued' | 'generating' | 'finishing' | null
  ) => void
): void {
  const generatingMessage = messages.find(
    (msg) => msg.role === 'assistant' && msg.status === 'generating'
  );

  if (generatingMessage) {
    setGenerating(true, generatingMessage.id);
    setGenerationStage('generating');
    return;
  }

  setGenerating(false);
  setGenerationStage(null);
}

/**
 * Hook to handle conversation data initialization
 * Optimizes initial load by fetching projects and messages in a single request
 */
export function useConversationInit(options?: { mode?: ConversationInitMode }) {
  // Tracks the mode value the init effect last ran for. Previously this was
  // a boolean `initRef` that locked after the first run, which meant a
  // user navigating from /ai/image?new=1 to /ai/image?template=foo stayed
  // stuck on the old "new project" bootstrap and never saw the template
  // applied (mode change ignored). Compare current mode against last-run
  // mode so genuine route transitions re-initialize, while spurious
  // re-renders within the same mode stay no-op.
  const initializedModeRef = useRef<ConversationInitMode | null>(null);
  const mode = options?.mode ?? 'resume';

  const { setProjects, setLoadingProjects, selectProject } = useProjectStore();

  const {
    setMessages,
    setLoadingMessages,
    resetForProject,
    setGenerating,
    setGenerationStage,
  } = useConversationStore();

  // Initial data load - single request for projects + messages
  useEffect(() => {
    if (initializedModeRef.current === mode) return;
    initializedModeRef.current = mode;

    const loadInitialData = async () => {
      setLoadingProjects(true);
      setLoadingMessages(true);

      // Get persisted project ID from store
      const persistedProjectId =
        mode === 'resume' ? useProjectStore.getState().currentProjectId : null;

      const result = await fetchConversationInitData(persistedProjectId, {
        mode,
      });

      if (result.success) {
        const {
          projects,
          messages,
          currentProjectId: resolvedProjectId,
        } = result.data;

        // Update projects
        setProjects(projects);

        if (!resolvedProjectId) {
          selectProject(null);
          resetForProject();
          setLoadingProjects(false);
          setLoadingMessages(false);
          return;
        }

        // Update current project if different
        if (resolvedProjectId && resolvedProjectId !== persistedProjectId) {
          selectProject(resolvedProjectId);
        }

        // Update messages — reset transient conversation state for the new
        // project before populating with server data.
        resetForProject();
        setMessages(messages);
        syncRecoveredGenerationState(
          messages,
          setGenerating,
          setGenerationStage
        );
      } else {
        setGenerating(false);
        setGenerationStage(null);
      }

      setLoadingProjects(false);
      setLoadingMessages(false);
    };

    loadInitialData();
  }, [
    setProjects,
    setLoadingProjects,
    setMessages,
    setLoadingMessages,
    resetForProject,
    setGenerationStage,
    setGenerating,
    selectProject,
    mode,
  ]);

  // Load messages when project changes (after initial load).
  const loadMessagesForProject = useCallback(
    async (projectId: string) => {
      if (!projectId) return;

      resetForProject();
      setLoadingMessages(true);

      const result = await fetchProjectMessages(projectId);
      if (result.success) {
        setMessages(result.data);
        syncRecoveredGenerationState(
          result.data,
          setGenerating,
          setGenerationStage
        );
      } else {
        setGenerating(false);
        setGenerationStage(null);
      }

      setLoadingMessages(false);
    },
    [
      setGenerationStage,
      setMessages,
      setLoadingMessages,
      resetForProject,
      setGenerating,
    ]
  );

  return { loadMessagesForProject };
}
