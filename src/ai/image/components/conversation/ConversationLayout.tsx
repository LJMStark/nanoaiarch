'use client';

import { getProjectMessages } from '@/actions/project-message';
import { LazyTemplateDetailModal } from '@/ai/image/components/lazy';
import { useConversationInit } from '@/ai/image/hooks/use-conversation-init';
import { useGenerationRecovery } from '@/ai/image/hooks/use-generation-recovery';
import { useTemplateApply } from '@/ai/image/hooks/use-template-apply';
import type { ArchTemplate, AspectRatioId } from '@/ai/image/lib/arch-types';
import { ARCH_TEMPLATES } from '@/ai/image/lib/templates';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { useConversationStore } from '@/stores/conversation-store';
import { useProjectStore } from '@/stores/project-store';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ConversationArea } from './ConversationArea';
import { ConversationHeader } from './ConversationHeader';
import { ConversationInput } from './ConversationInput';
import { ProjectSidebar } from './ProjectSidebar';

export function ConversationLayout() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const templateId = searchParams.get('template');

  // Modal state for template from URL
  const [urlTemplate, setUrlTemplate] = useState<ArchTemplate | null>(null);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);

  // Use unified template apply hook
  const { applyTemplateWithProject } = useTemplateApply();

  // Use optimized conversation init hook (single request for projects + messages)
  const { loadMessagesForProject } = useConversationInit();

  const { currentProjectId } = useProjectStore();
  const prevProjectIdRef = useRef<string | null>(null);

  const { setMessages, setLoadingMessages, setCurrentProject, setGenerating } =
    useConversationStore();

  // Enable generation recovery polling
  useGenerationRecovery(currentProjectId);

  // Handle template from URL - show modal instead of direct apply
  useEffect(() => {
    if (!templateId) return;

    const template = ARCH_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;

    // Show the template detail modal
    setUrlTemplate(template);
    setIsTemplateModalOpen(true);

    // Clear the URL parameter to prevent re-triggering
    router.replace('/ai/image', { scroll: false });
  }, [templateId, router]);

  // Handle applying template from modal
  const handleApplyUrlTemplate = async (
    template: ArchTemplate,
    prompt: string,
    ratio: AspectRatioId
  ) => {
    setIsTemplateModalOpen(false);
    setUrlTemplate(null);
    await applyTemplateWithProject({ template, prompt, ratio });
  };

  // Load messages when project changes (after initial load)
  useEffect(() => {
    // Skip if this is the initial load (handled by useConversationInit)
    if (prevProjectIdRef.current === null) {
      prevProjectIdRef.current = currentProjectId;
      return;
    }

    // Skip if project hasn't changed
    if (prevProjectIdRef.current === currentProjectId) {
      return;
    }

    prevProjectIdRef.current = currentProjectId;

    if (!currentProjectId) {
      setCurrentProject(null);
      return;
    }

    // Load messages for the new project
    const loadMessages = async () => {
      setCurrentProject(currentProjectId);
      setLoadingMessages(true);
      const result = await getProjectMessages(currentProjectId);
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
    };

    loadMessages();
  }, [
    currentProjectId,
    setMessages,
    setLoadingMessages,
    setCurrentProject,
    setGenerating,
  ]);

  return (
    <>
      <div className="fixed inset-0 z-50 bg-background">
        <SidebarProvider defaultOpen={true}>
          <ProjectSidebar />
          <SidebarInset className="flex flex-col h-screen min-h-0">
            <ConversationHeader />
            <ConversationArea />
            <ConversationInput />
          </SidebarInset>
        </SidebarProvider>
      </div>

      {/* Template detail modal for URL parameter */}
      <LazyTemplateDetailModal
        template={urlTemplate}
        open={isTemplateModalOpen}
        onOpenChange={setIsTemplateModalOpen}
        onApply={handleApplyUrlTemplate}
      />
    </>
  );
}
