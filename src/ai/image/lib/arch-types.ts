// Architectural visualization type definitions
// 建筑可视化类型定义

import type { LucideIcon } from 'lucide-react';

// Style preset identifiers
// 风格预设标识符
export type StylePresetId =
  | 'modern-minimalist'
  | 'brutalist'
  | 'eco-green'
  | 'parametric'
  | 'new-chinese'
  | 'cyberpunk'
  | 'watercolor'
  | 'blueprint'
  | 'white-model';

// Aspect ratio identifiers
// 画幅比例标识符
export type AspectRatioId = '1:1' | '16:9' | '4:3' | '3:4' | '9:16';

// Style preset configuration
// 风格预设配置
export interface StylePresetConfig {
  id: StylePresetId;
  labelKey: string;
  promptSuffix: string;
  icon: LucideIcon;
  color?: string;
}

// Aspect ratio configuration
// 画幅比例配置
export interface AspectRatioConfig {
  id: AspectRatioId;
  labelKey: string;
  width: number;
  height: number;
  icon: LucideIcon;
}

// Template category identifiers
// 模版分类标识符
export type TemplateCategoryId =
  | 'render-style'
  | 'model-to-render'
  | 'sketch-to-render'
  | 'masterplan'
  | 'facade'
  | 'section'
  | 'analysis'
  | 'floor-plan'
  | 'renovation'
  | 'perspective';

// Template category configuration
// 模版分类配置
export interface TemplateCategory {
  id: TemplateCategoryId;
  labelKey: string;
  descriptionKey: string;
  icon: LucideIcon;
  color?: string;
}

// Architecture template definition
// 建筑模版定义
export interface ArchTemplate {
  id: string;
  categoryId: TemplateCategoryId;
  titleKey: string;
  descriptionKey: string;
  promptTemplate: string;
  previewImage: string;
  inputImage?: string;
  defaultStyle?: StylePresetId;
  defaultAspectRatio?: AspectRatioId;
  requiresInput: boolean;
  tags: string[];
  featured?: boolean;
  order?: number;
}

// Generation history item
// 生成历史记录项
export interface GenerationHistoryItem {
  id: string;
  prompt: string;
  stylePreset?: StylePresetId;
  aspectRatio: AspectRatioId;
  templateId?: string;
  inputImage?: string;
  outputImage: string;
  timestamp: number;
  creditsUsed: number;
}

// Generation request with architectural enhancements
// 带建筑增强的生成请求
export interface ArchGenerateRequest {
  prompt: string;
  modelId: string;
  referenceImage?: string;
  stylePreset?: StylePresetId;
  aspectRatio?: AspectRatioId;
  useSystemPrompt?: boolean;
  templateId?: string;
}

// Gallery filter state
// 画廊筛选状态
export interface GalleryFilterState {
  category: TemplateCategoryId | 'all';
  searchQuery: string;
  styleFilter?: StylePresetId;
}

// Arch generation state
// 建筑生成状态
export interface ArchGenerationState {
  stylePreset: StylePresetId | null;
  aspectRatio: AspectRatioId;
  selectedTemplate: ArchTemplate | null;
  templateCategory: TemplateCategoryId | 'all';
  showHero: boolean;
  showTemplateModal: boolean;
  history: GenerationHistoryItem[];
}
