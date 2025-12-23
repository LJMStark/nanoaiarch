// Extended hook for architectural visualization generation
// 建筑可视化生成扩展 hook

import { useCallback, useState } from 'react';
import type {
  ArchGenerationState,
  ArchTemplate,
  AspectRatioId,
  GenerationHistoryItem,
  StylePresetId,
  TemplateCategoryId,
} from '../lib/arch-types';
import { DEFAULT_ASPECT_RATIO } from '../lib/aspect-ratios';
import { buildArchPrompt } from '../lib/system-prompts';
import { useImageGeneration } from './use-image-generation';

// 生成唯一 ID
const generateId = () => crypto.randomUUID().slice(0, 8);

// 历史记录最大长度
const MAX_HISTORY_ITEMS = 20;

interface UseArchGenerationReturn {
  // 继承自 useImageGeneration 的状态和方法
  image: ReturnType<typeof useImageGeneration>['image'];
  error: ReturnType<typeof useImageGeneration>['error'];
  timing: ReturnType<typeof useImageGeneration>['timing'];
  isLoading: ReturnType<typeof useImageGeneration>['isLoading'];
  activePrompt: ReturnType<typeof useImageGeneration>['activePrompt'];
  mode: ReturnType<typeof useImageGeneration>['mode'];
  selectedModel: ReturnType<typeof useImageGeneration>['selectedModel'];
  referenceImage: ReturnType<typeof useImageGeneration>['referenceImage'];
  conversationHistory: ReturnType<
    typeof useImageGeneration
  >['conversationHistory'];
  editHistory: ReturnType<typeof useImageGeneration>['editHistory'];
  lastCreditsUsed: ReturnType<typeof useImageGeneration>['lastCreditsUsed'];
  creditErrorType: ReturnType<typeof useImageGeneration>['creditErrorType'];
  setMode: ReturnType<typeof useImageGeneration>['setMode'];
  setSelectedModel: ReturnType<typeof useImageGeneration>['setSelectedModel'];
  setReferenceImage: ReturnType<typeof useImageGeneration>['setReferenceImage'];
  resetState: ReturnType<typeof useImageGeneration>['resetState'];
  clearEditHistory: ReturnType<typeof useImageGeneration>['clearEditHistory'];
  selectHistoryItem: ReturnType<typeof useImageGeneration>['selectHistoryItem'];

  // 建筑专属状态
  stylePreset: StylePresetId | null;
  aspectRatio: AspectRatioId;
  selectedTemplate: ArchTemplate | null;
  templateCategory: TemplateCategoryId | 'all';
  showHero: boolean;
  showTemplateModal: boolean;
  archHistory: GenerationHistoryItem[];
  promptValue: string;

  // 建筑专属操作
  setStylePreset: (preset: StylePresetId | null) => void;
  setAspectRatio: (ratio: AspectRatioId) => void;
  selectTemplate: (template: ArchTemplate | null) => void;
  setTemplateCategory: (category: TemplateCategoryId | 'all') => void;
  setShowTemplateModal: (show: boolean) => void;
  setPromptValue: (value: string) => void;
  applyTemplate: (template: ArchTemplate) => void;
  generateWithEnhancement: (prompt: string) => Promise<void>;
  editWithEnhancement: (prompt: string) => Promise<void>;
  clearArchHistory: () => void;
}

export function useArchGeneration(): UseArchGenerationReturn {
  // 使用基础 hook
  const baseHook = useImageGeneration();

  // 建筑专属状态
  const [stylePreset, setStylePreset] = useState<StylePresetId | null>(null);
  const [aspectRatio, setAspectRatio] =
    useState<AspectRatioId>(DEFAULT_ASPECT_RATIO);
  const [selectedTemplate, setSelectedTemplate] = useState<ArchTemplate | null>(
    null
  );
  const [templateCategory, setTemplateCategory] = useState<
    TemplateCategoryId | 'all'
  >('all');
  const [showHero, setShowHero] = useState(true);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [archHistory, setArchHistory] = useState<GenerationHistoryItem[]>([]);
  const [promptValue, setPromptValue] = useState('');

  // 应用模版
  const applyTemplate = useCallback(
    (template: ArchTemplate) => {
      setSelectedTemplate(template);
      setPromptValue(template.promptTemplate);

      // 应用模版默认设置
      if (template.defaultStyle) {
        setStylePreset(template.defaultStyle);
      }
      if (template.defaultAspectRatio) {
        setAspectRatio(template.defaultAspectRatio);
      }

      // 如果模版需要输入图像，切换到编辑模式
      if (template.requiresInput) {
        baseHook.setMode('edit');
      } else {
        baseHook.setMode('generate');
      }

      // 关闭模版模态框
      setShowTemplateModal(false);

      // 隐藏 Hero
      setShowHero(false);
    },
    [baseHook]
  );

  // 选择模版（打开详情模态框）
  const selectTemplate = useCallback((template: ArchTemplate | null) => {
    setSelectedTemplate(template);
    setShowTemplateModal(!!template);
  }, []);

  // 带增强的生成
  const generateWithEnhancement = useCallback(
    async (prompt: string) => {
      // 隐藏 Hero
      setShowHero(false);

      // 构建增强提示词
      const enhancedPrompt = buildArchPrompt(
        prompt,
        stylePreset ?? undefined,
        aspectRatio
      );

      // 调用基础生成
      await baseHook.generateImage(enhancedPrompt);

      // 如果成功，添加到历史
      if (baseHook.image?.image) {
        const historyItem: GenerationHistoryItem = {
          id: generateId(),
          prompt,
          stylePreset: stylePreset ?? undefined,
          aspectRatio,
          templateId: selectedTemplate?.id,
          outputImage: baseHook.image.image,
          timestamp: Date.now(),
          creditsUsed: baseHook.lastCreditsUsed ?? 0,
        };
        setArchHistory((prev) =>
          [historyItem, ...prev].slice(0, MAX_HISTORY_ITEMS)
        );
      }
    },
    [stylePreset, aspectRatio, selectedTemplate, baseHook]
  );

  // 带增强的编辑
  const editWithEnhancement = useCallback(
    async (prompt: string) => {
      // 隐藏 Hero
      setShowHero(false);

      // 构建增强提示词
      const enhancedPrompt = buildArchPrompt(
        prompt,
        stylePreset ?? undefined,
        aspectRatio
      );

      // 调用基础编辑
      await baseHook.editImage(enhancedPrompt);

      // 如果成功，添加到历史
      if (baseHook.image?.image && baseHook.referenceImage) {
        const historyItem: GenerationHistoryItem = {
          id: generateId(),
          prompt,
          stylePreset: stylePreset ?? undefined,
          aspectRatio,
          templateId: selectedTemplate?.id,
          inputImage: baseHook.referenceImage,
          outputImage: baseHook.image.image,
          timestamp: Date.now(),
          creditsUsed: baseHook.lastCreditsUsed ?? 0,
        };
        setArchHistory((prev) =>
          [historyItem, ...prev].slice(0, MAX_HISTORY_ITEMS)
        );
      }
    },
    [stylePreset, aspectRatio, selectedTemplate, baseHook]
  );

  // 清除建筑历史
  const clearArchHistory = useCallback(() => {
    setArchHistory([]);
  }, []);

  // 扩展重置状态
  const resetState = useCallback(() => {
    baseHook.resetState();
    setStylePreset(null);
    setAspectRatio(DEFAULT_ASPECT_RATIO);
    setSelectedTemplate(null);
    setShowHero(true);
    setPromptValue('');
  }, [baseHook]);

  return {
    // 继承的状态
    image: baseHook.image,
    error: baseHook.error,
    timing: baseHook.timing,
    isLoading: baseHook.isLoading,
    activePrompt: baseHook.activePrompt,
    mode: baseHook.mode,
    selectedModel: baseHook.selectedModel,
    referenceImage: baseHook.referenceImage,
    conversationHistory: baseHook.conversationHistory,
    editHistory: baseHook.editHistory,
    lastCreditsUsed: baseHook.lastCreditsUsed,
    creditErrorType: baseHook.creditErrorType,

    // 继承的操作
    setMode: baseHook.setMode,
    setSelectedModel: baseHook.setSelectedModel,
    setReferenceImage: baseHook.setReferenceImage,
    clearEditHistory: baseHook.clearEditHistory,
    selectHistoryItem: baseHook.selectHistoryItem,

    // 建筑专属状态
    stylePreset,
    aspectRatio,
    selectedTemplate,
    templateCategory,
    showHero,
    showTemplateModal,
    archHistory,
    promptValue,

    // 建筑专属操作
    setStylePreset,
    setAspectRatio,
    selectTemplate,
    setTemplateCategory,
    setShowTemplateModal,
    setPromptValue,
    applyTemplate,
    generateWithEnhancement,
    editWithEnhancement,
    resetState,
    clearArchHistory,
  };
}
