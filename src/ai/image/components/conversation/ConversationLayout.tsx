'use client';

import { LazyTemplateDetailModal } from '@/ai/image/components/lazy';
import { useConversationInit } from '@/ai/image/hooks/use-conversation-init';
import { useGenerationRecovery } from '@/ai/image/hooks/use-generation-recovery';
import { useTemplateApply } from '@/ai/image/hooks/use-template-apply';
import type { ArchTemplate, AspectRatioId } from '@/ai/image/lib/arch-types';
import { ARCH_TEMPLATES } from '@/ai/image/lib/templates';
import { fetchProjectMessages } from '@/ai/image/lib/workspace-client';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { Routes } from '@/routes';
import { useConversationStore } from '@/stores/conversation-store';
import { useProjectStore } from '@/stores/project-store';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ConversationArea } from './ConversationArea';
import { ConversationHeader } from './ConversationHeader';
import { ConversationInput } from './ConversationInput';
import { ProjectSidebar } from './ProjectSidebar';

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

export function ConversationLayout() {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const router = useRouter();
  const templateId = searchParams.get('template');
  const startNewProject = searchParams.get('new') === '1';

  // Modal state for template from URL
  const [urlTemplate, setUrlTemplate] = useState<ArchTemplate | null>(null);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);

  // Use unified template apply hook
  const { applyTemplateWithProject } = useTemplateApply();

  // Use optimized conversation init hook (single request for projects + messages)
  useConversationInit({
    mode: startNewProject ? 'new-project' : templateId ? 'blank' : 'resume',
  });

  const { currentProjectId } = useProjectStore();
  const prevProjectIdRef = useRef<string | null>(null);
  const loadRequestIdRef = useRef(0);

  const {
    setMessages,
    setLoadingMessages,
    setCurrentProject,
    setGenerating,
    setGenerationStage,
  } = useConversationStore();

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
    router.replace(Routes.AIImage, { scroll: false });
  }, [templateId, router]);

  // Handle applying template from modal
  const handleApplyUrlTemplate = async (
    template: ArchTemplate,
    prompt: string,
    ratio: AspectRatioId
  ) => {
    setIsTemplateModalOpen(false);
    setUrlTemplate(null);
    const title = t(template.titleKey as any);
    await applyTemplateWithProject({ template, prompt, ratio, title });
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
      loadRequestIdRef.current += 1;
      setCurrentProject(null);
      setGenerating(false);
      setGenerationStage(null);
      setLoadingMessages(false);
      return;
    }

    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;

    // Load messages for the new project
    const loadMessages = async () => {
      setCurrentProject(currentProjectId);
      setLoadingMessages(true);
      const result = await fetchProjectMessages(currentProjectId);

      if (loadRequestIdRef.current !== requestId) {
        return;
      }

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
      if (loadRequestIdRef.current === requestId) {
        setLoadingMessages(false);
      }
    };

    loadMessages();
  }, [
    currentProjectId,
    setMessages,
    setLoadingMessages,
    setCurrentProject,
    setGenerationStage,
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
