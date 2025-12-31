'use client';

import { createImageProject } from '@/actions/image-project';
import type { ArchTemplate, AspectRatioId } from '@/ai/image/lib/arch-types';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import { useProjectStore } from '@/stores/project-store';
import { useCallback, useState } from 'react';

interface ApplyTemplateParams {
  template: ArchTemplate;
  prompt: string;
  ratio: AspectRatioId;
}

interface UseTemplateApplyReturn {
  applyTemplateWithProject: (params: ApplyTemplateParams) => Promise<boolean>;
  applyQuickPrompt: (prompt: string) => Promise<boolean>;
  isApplying: boolean;
}

/**
 * Hook for applying templates with automatic project creation
 * Handles error states and provides user feedback via toast
 */
export function useTemplateApply(): UseTemplateApplyReturn {
  const { toast } = useToast();
  const [isApplying, setIsApplying] = useState(false);

  const {
    currentProjectId,
    addProject,
    applyTemplate,
    selectProjectWithTemplate,
  } = useProjectStore();

  /**
   * Apply a template with full parameters
   * Creates a new project if none exists
   */
  const applyTemplateWithProject = useCallback(
    async ({
      template,
      prompt,
      ratio,
    }: ApplyTemplateParams): Promise<boolean> => {
      setIsApplying(true);

      try {
        if (currentProjectId) {
          // Apply to existing project
          applyTemplate({
            promptTemplate: prompt,
            defaultAspectRatio: ratio,
          });
          return true;
        }

        // Create new project with template
        const result = await createImageProject({
          title: template.id,
          templateId: template.id,
          aspectRatio: ratio,
        });

        if (!result.success || !result.data) {
          toast({
            title: 'Failed to create project',
            description: result.error || 'Please try again',
            variant: 'destructive',
          });
          return false;
        }

        // Add project and apply template atomically
        addProject(result.data);
        selectProjectWithTemplate(result.data.id, {
          promptTemplate: prompt,
          defaultAspectRatio: ratio,
        });

        return true;
      } catch (error) {
        logger.ai.error('Failed to apply template:', error);
        toast({
          title: 'Error',
          description: 'An unexpected error occurred',
          variant: 'destructive',
        });
        return false;
      } finally {
        setIsApplying(false);
      }
    },
    [
      currentProjectId,
      addProject,
      applyTemplate,
      selectProjectWithTemplate,
      toast,
    ]
  );

  /**
   * Apply a quick prompt
   * Creates a new project if none exists
   */
  const applyQuickPrompt = useCallback(
    async (prompt: string): Promise<boolean> => {
      // Always set the prompt first so it appears immediately
      applyTemplate({ promptTemplate: prompt });

      if (currentProjectId) {
        return true;
      }

      setIsApplying(true);

      try {
        const result = await createImageProject({
          title: 'New Project',
        });

        if (!result.success || !result.data) {
          toast({
            title: 'Failed to create project',
            description: result.error || 'Please try again',
            variant: 'destructive',
          });
          return false;
        }

        // Add project and re-apply template (selectProject clears draftPrompt)
        addProject(result.data);
        selectProjectWithTemplate(result.data.id, {
          promptTemplate: prompt,
        });

        return true;
      } catch (error) {
        logger.ai.error('Failed to create project:', error);
        toast({
          title: 'Error',
          description: 'An unexpected error occurred',
          variant: 'destructive',
        });
        return false;
      } finally {
        setIsApplying(false);
      }
    },
    [
      currentProjectId,
      addProject,
      applyTemplate,
      selectProjectWithTemplate,
      toast,
    ]
  );

  return {
    applyTemplateWithProject,
    applyQuickPrompt,
    isApplying,
  };
}
