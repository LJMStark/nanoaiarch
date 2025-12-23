// Architectural style presets configuration
// 建筑风格预设配置

import {
  Box,
  Building2,
  Droplets,
  Landmark,
  Layers,
  Leaf,
  Ruler,
  Sparkles,
  Zap,
} from 'lucide-react';
import type { StylePresetConfig, StylePresetId } from './arch-types';

// Style preset definitions with prompt suffixes
// 风格预设定义及对应的提示词后缀
export const STYLE_PRESETS: Record<StylePresetId, StylePresetConfig> = {
  'modern-minimalist': {
    id: 'modern-minimalist',
    labelKey: 'ArchPage.styles.modernMinimalist',
    promptSuffix:
      'Modern minimalist architectural style. Clean geometric lines, white and neutral color palette, large glass surfaces and floor-to-ceiling windows, minimal ornamentation, emphasis on form and negative space, sleek materials like concrete, glass and steel, natural lighting.',
    icon: Building2,
    color: '#64748b',
  },
  brutalist: {
    id: 'brutalist',
    labelKey: 'ArchPage.styles.brutalist',
    promptSuffix:
      'Brutalist architectural style. Raw exposed concrete (béton brut), monolithic massive forms, bold geometric shapes, textured board-marked concrete surfaces, dramatic shadows and light play, fortress-like presence, unfinished material aesthetic.',
    icon: Layers,
    color: '#78716c',
  },
  'eco-green': {
    id: 'eco-green',
    labelKey: 'ArchPage.styles.ecoGreen',
    promptSuffix:
      'Sustainable eco-green architecture. Integrated vegetation and living walls, extensive green roofs, biophilic design elements, natural and recycled materials, passive solar design, rainwater collection features, harmony with natural environment, abundant natural light.',
    icon: Leaf,
    color: '#22c55e',
  },
  parametric: {
    id: 'parametric',
    labelKey: 'ArchPage.styles.parametric',
    promptSuffix:
      'Parametric architecture style. Algorithmically-derived organic forms, flowing curved surfaces, complex tessellated patterns, dynamic facade systems, computational design aesthetic, innovative structural solutions, futuristic appearance.',
    icon: Sparkles,
    color: '#8b5cf6',
  },
  'new-chinese': {
    id: 'new-chinese',
    labelKey: 'ArchPage.styles.newChinese',
    promptSuffix:
      'New Chinese (新中式) architectural style. Traditional Chinese elements reinterpreted with contemporary materials and techniques, sloped rooflines with modern twist, courtyard spaces, timber and stone materials, harmony of old and new, cultural symbolism.',
    icon: Landmark,
    color: '#dc2626',
  },
  cyberpunk: {
    id: 'cyberpunk',
    labelKey: 'ArchPage.styles.cyberpunk',
    promptSuffix:
      'Cyberpunk architectural style. Neon lighting accents, holographic display elements, dystopian mega-structures, exposed high-tech infrastructure, dark atmospheric mood, rain-slicked surfaces, vertical dense urbanism, retro-futuristic details.',
    icon: Zap,
    color: '#06b6d4',
  },
  watercolor: {
    id: 'watercolor',
    labelKey: 'ArchPage.styles.watercolor',
    promptSuffix:
      'Artistic watercolor architectural rendering. Hand-painted watercolor style, soft diffused edges, transparent color washes, visible brushwork texture, artistic interpretation, atmospheric perspective, sketch-like quality with color accents.',
    icon: Droplets,
    color: '#3b82f6',
  },
  blueprint: {
    id: 'blueprint',
    labelKey: 'ArchPage.styles.blueprint',
    promptSuffix:
      'Technical architectural blueprint style. Blue and white color scheme, precise technical linework, orthographic projections, dimension annotations, section cut lines, hatching patterns, engineering drawing aesthetic, gridded background.',
    icon: Ruler,
    color: '#1d4ed8',
  },
  'white-model': {
    id: 'white-model',
    labelKey: 'ArchPage.styles.whiteModel',
    promptSuffix:
      'Pure white massing model render. Monochromatic white material, soft ambient occlusion shadows, clean studio lighting, architectural model aesthetic, no textures or materials, form study focus, subtle shadow gradients.',
    icon: Box,
    color: '#e2e8f0',
  },
};

// Get all style presets as array
// 获取所有风格预设数组
export const STYLE_PRESET_LIST = Object.values(STYLE_PRESETS);

// Get style preset by ID
// 根据 ID 获取风格预设
export function getStylePreset(id: StylePresetId): StylePresetConfig {
  return STYLE_PRESETS[id];
}

// Get prompt suffix for a style
// 获取风格的提示词后缀
export function getStylePromptSuffix(id: StylePresetId): string {
  return STYLE_PRESETS[id].promptSuffix;
}
