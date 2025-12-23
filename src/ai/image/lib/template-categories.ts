// Template category definitions for architectural workflows
// 建筑工作流模版分类定义

import {
  BarChart3,
  Box,
  Building,
  Eye,
  Grid3X3,
  Hammer,
  LayoutPanelLeft,
  Map,
  Palette,
  PenTool,
} from 'lucide-react';
import type { TemplateCategory, TemplateCategoryId } from './arch-types';

// Template category definitions
// 模版分类定义
export const TEMPLATE_CATEGORIES: Record<TemplateCategoryId, TemplateCategory> =
  {
    'render-style': {
      id: 'render-style',
      labelKey: 'ArchPage.categories.renderStyle',
      descriptionKey: 'ArchPage.categories.renderStyleDesc',
      icon: Palette,
      color: '#8b5cf6',
    },
    'model-to-render': {
      id: 'model-to-render',
      labelKey: 'ArchPage.categories.modelToRender',
      descriptionKey: 'ArchPage.categories.modelToRenderDesc',
      icon: Box,
      color: '#64748b',
    },
    'sketch-to-render': {
      id: 'sketch-to-render',
      labelKey: 'ArchPage.categories.sketchToRender',
      descriptionKey: 'ArchPage.categories.sketchToRenderDesc',
      icon: PenTool,
      color: '#f59e0b',
    },
    masterplan: {
      id: 'masterplan',
      labelKey: 'ArchPage.categories.masterplan',
      descriptionKey: 'ArchPage.categories.masterplanDesc',
      icon: Map,
      color: '#22c55e',
    },
    facade: {
      id: 'facade',
      labelKey: 'ArchPage.categories.facade',
      descriptionKey: 'ArchPage.categories.facadeDesc',
      icon: Building,
      color: '#3b82f6',
    },
    section: {
      id: 'section',
      labelKey: 'ArchPage.categories.section',
      descriptionKey: 'ArchPage.categories.sectionDesc',
      icon: LayoutPanelLeft,
      color: '#06b6d4',
    },
    analysis: {
      id: 'analysis',
      labelKey: 'ArchPage.categories.analysis',
      descriptionKey: 'ArchPage.categories.analysisDesc',
      icon: BarChart3,
      color: '#ec4899',
    },
    'floor-plan': {
      id: 'floor-plan',
      labelKey: 'ArchPage.categories.floorPlan',
      descriptionKey: 'ArchPage.categories.floorPlanDesc',
      icon: Grid3X3,
      color: '#14b8a6',
    },
    renovation: {
      id: 'renovation',
      labelKey: 'ArchPage.categories.renovation',
      descriptionKey: 'ArchPage.categories.renovationDesc',
      icon: Hammer,
      color: '#f97316',
    },
    perspective: {
      id: 'perspective',
      labelKey: 'ArchPage.categories.perspective',
      descriptionKey: 'ArchPage.categories.perspectiveDesc',
      icon: Eye,
      color: '#a855f7',
    },
  };

// Get all categories as array
// 获取所有分类数组
export const TEMPLATE_CATEGORY_LIST = Object.values(TEMPLATE_CATEGORIES);

// Get category by ID
// 根据 ID 获取分类
export function getTemplateCategory(id: TemplateCategoryId): TemplateCategory {
  return TEMPLATE_CATEGORIES[id];
}
