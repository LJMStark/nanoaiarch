import { getConversationInitData } from '@/actions/conversation-data';
import { getProjectMessages } from '@/actions/project-message';
import { useConversationStore } from '@/stores/conversation-store';
import { useProjectStore } from '@/stores/project-store';
import { useCallback, useEffect, useRef } from 'react';

/**
 * Hook to handle conversation data initialization
 * Optimizes initial load by fetching projects and messages in a single request
 */
export function useConversationInit() {
  const initRef = useRef(false);

  const { currentProjectId, setProjects, setLoadingProjects, selectProject } =
    useProjectStore();

  const { setMessages, setLoadingMessages, setCurrentProject, setGenerating } =
    useConversationStore();

  // Initial data load - single request for projects + messages
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const loadInitialData = async () => {
      setLoadingProjects(true);
      setLoadingMessages(true);

      // Get persisted project ID from store
      const persistedProjectId = useProjectStore.getState().currentProjectId;

      const result = await getConversationInitData(persistedProjectId);

      if (result.success) {
        const {
          projects,
          messages,
          currentProjectId: resolvedProjectId,
        } = result.data;

        // Update projects
        setProjects(projects);

        // Update current project if different
        if (resolvedProjectId && resolvedProjectId !== persistedProjectId) {
          selectProject(resolvedProjectId);
        }

        // Update messages
        if (resolvedProjectId) {
          setCurrentProject(resolvedProjectId);
          setMessages(messages);

          // Check for generating messages and restore generation state
          const generatingMessage = messages.find(
            (msg) => msg.role === 'assistant' && msg.status === 'generating'
          );
          if (generatingMessage) {
            setGenerating(true, generatingMessage.id);
          }
        }
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
    setCurrentProject,
    setGenerating,
    selectProject,
  ]);

  // Load messages when project changes (after initial load)
  const loadMessagesForProject = useCallback(
    async (projectId: string) => {
      if (!projectId) return;

      setCurrentProject(projectId);
      setLoadingMessages(true);

      const result = await getProjectMessages(projectId);
      if (result.success) {
        setMessages(result.data);

        // Check for generating messages and restore generation state
        const generatingMessage = result.data.find(
          (msg) => msg.role === 'assistant' && msg.status === 'generating'
        );
        if (generatingMessage) {
          setGenerating(true, generatingMessage.id);
        }
      }

      setLoadingMessages(false);
    },
    [setMessages, setLoadingMessages, setCurrentProject, setGenerating]
  );

  return { loadMessagesForProject };
}
