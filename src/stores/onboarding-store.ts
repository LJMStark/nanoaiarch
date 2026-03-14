import { create } from 'zustand';

export type OnboardingStep = 'welcome' | 'template' | 'generate' | 'complete';

interface OnboardingState {
  isOpen: boolean;
  currentStep: OnboardingStep;
  selectedTemplateId: string | null;
  selectedTemplateName: string | null;
  selectedTemplatePreview: string | null;
  generatedImageUrl: string | null;
  isGenerating: boolean;

  // Actions
  openOnboarding: () => void;
  closeOnboarding: () => void;
  setStep: (step: OnboardingStep) => void;
  nextStep: () => void;
  prevStep: () => void;
  selectTemplate: (id: string, name: string, previewImage: string) => void;
  setGeneratedImage: (url: string) => void;
  setIsGenerating: (isGenerating: boolean) => void;
  reset: () => void;
}

const STEP_ORDER: OnboardingStep[] = [
  'welcome',
  'template',
  'generate',
  'complete',
];

const initialState = {
  isOpen: false,
  currentStep: 'welcome' as OnboardingStep,
  selectedTemplateId: null as string | null,
  selectedTemplateName: null as string | null,
  selectedTemplatePreview: null as string | null,
  generatedImageUrl: null as string | null,
  isGenerating: false,
};

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  ...initialState,

  openOnboarding: () => set({ isOpen: true }),

  closeOnboarding: () => set({ isOpen: false }),

  setStep: (step) => set({ currentStep: step }),

  nextStep: () => {
    const { currentStep } = get();
    const currentIndex = STEP_ORDER.indexOf(currentStep);
    if (currentIndex < STEP_ORDER.length - 1) {
      set({ currentStep: STEP_ORDER[currentIndex + 1] });
    }
  },

  prevStep: () => {
    const { currentStep } = get();
    const currentIndex = STEP_ORDER.indexOf(currentStep);
    if (currentIndex > 0) {
      set({ currentStep: STEP_ORDER[currentIndex - 1] });
    }
  },

  selectTemplate: (id, name, previewImage) =>
    set({
      selectedTemplateId: id,
      selectedTemplateName: name,
      selectedTemplatePreview: previewImage,
    }),

  setGeneratedImage: (url) => set({ generatedImageUrl: url }),

  setIsGenerating: (isGenerating) => set({ isGenerating }),

  reset: () => set(initialState),
}));
