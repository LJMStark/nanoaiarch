// Template browsing hook for the Playground showcase page
// Generation logic lives in the Conversation system (ConversationInput + api-utils)

import { useCallback, useState } from 'react';
import type {
  ArchTemplate,
  AspectRatioId,
  StylePresetId,
  TemplateCategoryId,
} from '../lib/arch-types';
import { DEFAULT_ASPECT_RATIO } from '../lib/aspect-ratios';

interface UseArchGenerationReturn {
  // Template browsing state
  stylePreset: StylePresetId | null;
  aspectRatio: AspectRatioId;
  selectedTemplate: ArchTemplate | null;
  templateCategory: TemplateCategoryId | 'all';
  showTemplateModal: boolean;
  promptValue: string;

  // Actions
  setStylePreset: (preset: StylePresetId | null) => void;
  setAspectRatio: (ratio: AspectRatioId) => void;
  selectTemplate: (template: ArchTemplate | null) => void;
  setTemplateCategory: (category: TemplateCategoryId | 'all') => void;
  setShowTemplateModal: (show: boolean) => void;
  setPromptValue: (value: string) => void;
}

export function useArchGeneration(): UseArchGenerationReturn {
  const [stylePreset, setStylePreset] = useState<StylePresetId | null>(null);
  const [aspectRatio, setAspectRatio] =
    useState<AspectRatioId>(DEFAULT_ASPECT_RATIO);
  const [selectedTemplate, setSelectedTemplate] =
    useState<ArchTemplate | null>(null);
  const [templateCategory, setTemplateCategory] = useState<
    TemplateCategoryId | 'all'
  >('all');
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [promptValue, setPromptValue] = useState('');

  const selectTemplate = useCallback((template: ArchTemplate | null) => {
    setSelectedTemplate(template);
    setShowTemplateModal(!!template);
  }, []);

  return {
    stylePreset,
    aspectRatio,
    selectedTemplate,
    templateCategory,
    showTemplateModal,
    promptValue,
    setStylePreset,
    setAspectRatio,
    selectTemplate,
    setTemplateCategory,
    setShowTemplateModal,
    setPromptValue,
  };
}
