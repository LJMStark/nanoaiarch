'use client';

import { getImageProjects } from '@/actions/image-project';
import { getProjectMessages } from '@/actions/project-message';
import { TemplateDetailModal } from '@/ai/image/components/TemplateDetailModal';
import { useTemplateApply } from '@/ai/image/hooks/use-template-apply';
import type {
  ArchTemplate,
  AspectRatioId,
  StylePresetId,
} from '@/ai/image/lib/arch-types';
import { ARCH_TEMPLATES } from '@/ai/image/lib/templates';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { useConversationStore } from '@/stores/conversation-store';
import { useProjectStore } from '@/stores/project-store';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
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

  const { currentProjectId, setProjects, setLoadingProjects } =
    useProjectStore();

  const { setMessages, setLoadingMessages, setCurrentProject } =
    useConversationStore();

  // Load projects on mount
  useEffect(() => {
    const loadProjects = async () => {
      setLoadingProjects(true);
      const result = await getImageProjects();
      if (result.success) {
        setProjects(result.data);
      }
      setLoadingProjects(false);
    };
    loadProjects();
  }, [setProjects, setLoadingProjects]);

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
    style: StylePresetId | null,
    ratio: AspectRatioId
  ) => {
    setIsTemplateModalOpen(false);
    setUrlTemplate(null);
    await applyTemplateWithProject({ template, prompt, style, ratio });
  };

  // Load messages when project changes
  useEffect(() => {
    const loadMessages = async () => {
      if (!currentProjectId) {
        setCurrentProject(null);
        return;
      }

      setCurrentProject(currentProjectId);
      setLoadingMessages(true);
      const result = await getProjectMessages(currentProjectId);
      if (result.success) {
        setMessages(result.data);
      }
      setLoadingMessages(false);
    };

    loadMessages();
  }, [currentProjectId, setMessages, setLoadingMessages, setCurrentProject]);

  return (
    <>
      <div className="fixed inset-0 z-50 bg-background">
        <SidebarProvider defaultOpen={true}>
          <ProjectSidebar />
          <SidebarInset className="flex flex-col h-screen">
            <ConversationHeader />
            <ConversationArea />
            <ConversationInput />
          </SidebarInset>
        </SidebarProvider>
      </div>

      {/* Template detail modal for URL parameter */}
      <TemplateDetailModal
        template={urlTemplate}
        open={isTemplateModalOpen}
        onOpenChange={setIsTemplateModalOpen}
        onApply={handleApplyUrlTemplate}
      />
    </>
  );
}
