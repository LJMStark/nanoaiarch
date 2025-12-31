import type { ImageProjectItem } from '@/actions/image-project';
import {
  DEFAULT_IMAGE_QUALITY,
  type ImageQuality,
} from '@/ai/image/components/ImageQualitySelect';
import type { AspectRatioId } from '@/ai/image/lib/arch-types';
import type { GeminiModelId } from '@/ai/image/lib/provider-config';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
  aspectRatio: '1:1' as AspectRatioId,
  selectedModel: 'forma' as GeminiModelId,
  draftPrompt: '',
  draftImage: null as string | null,
};

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
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
        })),

      selectProject: (projectId) => {
        const project = get().projects.find((p) => p.id === projectId);
        set({
          currentProjectId: projectId,
          // Restore project aspect ratio, keep user's quality preference
          aspectRatio: (project?.aspectRatio as AspectRatioId) ?? '1:1',
          // Clear draft when switching projects
          draftPrompt: '',
          draftImage: null,
        });
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
          aspectRatio: template.defaultAspectRatio ?? '1:1',
        });
      },

      selectProjectWithTemplate: (projectId, template) => {
        set({
          currentProjectId: projectId,
          draftPrompt: template.promptTemplate,
          aspectRatio: template.defaultAspectRatio ?? '1:1',
          draftImage: null,
        });
      },

      reset: () => set(initialState),
    }),
    {
      name: 'project-store',
      version: 2,
      partialize: (state) => ({
        currentProjectId: state.currentProjectId,
        imageQuality: state.imageQuality,
        aspectRatio: state.aspectRatio,
        selectedModel: state.selectedModel,
      }),
      migrate: (persistedState: unknown, version: number) => {
        if (
          version < 2 &&
          persistedState &&
          typeof persistedState === 'object'
        ) {
          // Migrate from v1: remove stylePreset, add imageQuality
          // Always use 'forma' as it's the only model now (gemini-3-pro-image-preview)
          const { stylePreset, ...rest } = persistedState as Record<
            string,
            unknown
          >;
          return {
            ...rest,
            imageQuality: DEFAULT_IMAGE_QUALITY,
            selectedModel: 'forma',
          };
        }
        return persistedState;
      },
    }
  )
);
