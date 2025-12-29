import type { ImageProjectItem } from '@/actions/image-project';
import type { AspectRatioId, StylePresetId } from '@/ai/image/lib/arch-types';
import type { GeminiModelId } from '@/ai/image/lib/provider-config';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ProjectState {
  // Project list
  projects: ImageProjectItem[];
  currentProjectId: string | null;
  isLoadingProjects: boolean;

  // Current project config
  stylePreset: StylePresetId | null;
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
  setStylePreset: (preset: StylePresetId | null) => void;
  setAspectRatio: (ratio: AspectRatioId) => void;
  setSelectedModel: (model: GeminiModelId) => void;

  // Draft actions
  setDraftPrompt: (prompt: string) => void;
  setDraftImage: (image: string | null) => void;
  clearDraft: () => void;

  // Apply template
  applyTemplate: (template: {
    promptTemplate: string;
    defaultStyle?: StylePresetId;
    defaultAspectRatio?: AspectRatioId;
  }) => void;

  // Select project and apply template atomically (avoids race condition)
  selectProjectWithTemplate: (
    projectId: string,
    template: {
      promptTemplate: string;
      defaultStyle?: StylePresetId;
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
  stylePreset: null as StylePresetId | null,
  aspectRatio: '1:1' as AspectRatioId,
  selectedModel: 'gemini-2.0-flash-exp' as GeminiModelId,
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
          // Restore project config
          stylePreset: (project?.stylePreset as StylePresetId) ?? null,
          aspectRatio: (project?.aspectRatio as AspectRatioId) ?? '1:1',
          // Clear draft when switching projects
          draftPrompt: '',
          draftImage: null,
        });
      },

      setLoadingProjects: (loading) => set({ isLoadingProjects: loading }),

      setStylePreset: (preset) => set({ stylePreset: preset }),

      setAspectRatio: (ratio) => set({ aspectRatio: ratio }),

      setSelectedModel: (model) => set({ selectedModel: model }),

      setDraftPrompt: (prompt) => set({ draftPrompt: prompt }),

      setDraftImage: (image) => set({ draftImage: image }),

      clearDraft: () => set({ draftPrompt: '', draftImage: null }),

      applyTemplate: (template) => {
        set({
          draftPrompt: template.promptTemplate,
          stylePreset: template.defaultStyle ?? null,
          aspectRatio: template.defaultAspectRatio ?? '1:1',
        });
      },

      selectProjectWithTemplate: (projectId, template) => {
        set({
          currentProjectId: projectId,
          draftPrompt: template.promptTemplate,
          stylePreset: template.defaultStyle ?? null,
          aspectRatio: template.defaultAspectRatio ?? '1:1',
          draftImage: null,
        });
      },

      reset: () => set(initialState),
    }),
    {
      name: 'project-store',
      partialize: (state) => ({
        currentProjectId: state.currentProjectId,
        stylePreset: state.stylePreset,
        aspectRatio: state.aspectRatio,
        selectedModel: state.selectedModel,
      }),
    }
  )
);
