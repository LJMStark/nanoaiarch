import type { AspectRatioId } from '@/ai/image/lib/arch-types';
import { DEFAULT_ASPECT_RATIO } from '@/ai/image/lib/aspect-ratios';
import {
  DEFAULT_IMAGE_QUALITY,
  type ImageQuality,
} from '@/ai/image/lib/image-constants';
import type { GeminiModelId } from '@/ai/image/lib/provider-config';
import { isTemporaryId } from '@/ai/image/lib/temp-ids';
import type { ImageProjectItem } from '@/ai/image/lib/workspace-types';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Project Store - Zustand state for image projects
 */

interface ProjectState {
  // Project list
  projects: ImageProjectItem[];
  currentProjectId: string | null;
  isLoadingProjects: boolean;

  // Current project config
  imageQuality: ImageQuality;
  aspectRatio: AspectRatioId;
  selectedModel: GeminiModelId;

  // Draft state for new project
  draftPrompt: string;
  draftImage: string | null;

  // Actions
  setProjects: (projects: ImageProjectItem[]) => void;
  addProject: (project: ImageProjectItem) => void;
  updateProject: (
    projectId: string,
    updates: Partial<ImageProjectItem>
  ) => void;
  removeProject: (projectId: string) => void;
  selectProject: (projectId: string | null) => void;
  setLoadingProjects: (loading: boolean) => void;

  // Config actions
  setImageQuality: (quality: ImageQuality) => void;
  setAspectRatio: (ratio: AspectRatioId) => void;
  setSelectedModel: (model: GeminiModelId) => void;

  // Draft actions
  setDraftPrompt: (prompt: string) => void;
  setDraftImage: (image: string | null) => void;
  clearDraft: () => void;

  // Apply template
  applyTemplate: (template: {
    promptTemplate: string;
    defaultAspectRatio?: AspectRatioId;
  }) => void;

  // Select project and apply template atomically (avoids race condition)
  selectProjectWithTemplate: (
    projectId: string,
    template: {
      promptTemplate: string;
      defaultAspectRatio?: AspectRatioId;
    }
  ) => void;

  // Reset
  reset: () => void;
}

const initialState = {
  projects: [] as ImageProjectItem[],
  currentProjectId: null as string | null,
  isLoadingProjects: false,
  imageQuality: DEFAULT_IMAGE_QUALITY,
  aspectRatio: DEFAULT_ASPECT_RATIO,
  selectedModel: 'forma' as GeminiModelId,
  draftPrompt: '',
  draftImage: null as string | null,
};

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      ...initialState,

      setProjects: (projects) => set({ projects }),

      addProject: (project) =>
        set((state) => ({
          projects: [project, ...state.projects],
        })),

      updateProject: (projectId, updates) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId ? { ...p, ...updates } : p
          ),
        })),

      removeProject: (projectId) =>
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== projectId),
          currentProjectId:
            state.currentProjectId === projectId
              ? null
              : state.currentProjectId,
          aspectRatio:
            state.currentProjectId === projectId
              ? DEFAULT_ASPECT_RATIO
              : state.aspectRatio,
        })),

      selectProject: (projectId) => {
        set((state) => ({
          currentProjectId: projectId,
          // Workspace entry should always start from auto, and project records do
          // not reflect live in-session ratio changes, so don't restore from them.
          aspectRatio: projectId ? state.aspectRatio : DEFAULT_ASPECT_RATIO,
          // Clear draft when switching projects
          draftPrompt: '',
          draftImage: null,
        }));
      },

      setLoadingProjects: (loading) => set({ isLoadingProjects: loading }),

      setImageQuality: (quality) => set({ imageQuality: quality }),

      setAspectRatio: (ratio) => set({ aspectRatio: ratio }),

      setSelectedModel: (model) => set({ selectedModel: model }),

      setDraftPrompt: (prompt) => set({ draftPrompt: prompt }),

      setDraftImage: (image) => set({ draftImage: image }),

      clearDraft: () => set({ draftPrompt: '', draftImage: null }),

      applyTemplate: (template) => {
        set({
          draftPrompt: template.promptTemplate,
          aspectRatio: template.defaultAspectRatio ?? DEFAULT_ASPECT_RATIO,
        });
      },

      selectProjectWithTemplate: (projectId, template) => {
        set({
          currentProjectId: projectId,
          draftPrompt: template.promptTemplate,
          aspectRatio: template.defaultAspectRatio ?? DEFAULT_ASPECT_RATIO,
          draftImage: null,
        });
      },

      reset: () => set(initialState),
    }),
    {
      name: 'project-store',
      version: 3,
      partialize: (state) => ({
        currentProjectId: isTemporaryId(state.currentProjectId)
          ? null
          : state.currentProjectId,
        imageQuality: state.imageQuality,
        selectedModel: state.selectedModel,
      }),
      migrate: (persistedState: unknown, version: number) => {
        if (!persistedState || typeof persistedState !== 'object') {
          return persistedState;
        }

        let nextState = persistedState as Record<string, unknown>;

        if (version < 2) {
          // Migrate from v1: remove stylePreset, add imageQuality
          // Always use 'forma' as it's the only model now (gemini-3-pro-image-preview)
          const { stylePreset, ...rest } = nextState;
          nextState = {
            ...rest,
            imageQuality: DEFAULT_IMAGE_QUALITY,
            selectedModel: 'forma',
          };
        }

        if (version < 3) {
          const { aspectRatio, ...rest } = nextState;
          nextState = rest;
        }

        return nextState;
      },
    }
  )
);
