// Aspect ratio configuration for architectural visualization
// 建筑可视化画幅比例配置

import {
  RectangleHorizontal,
  RectangleVertical,
  Smartphone,
  Square,
} from 'lucide-react';
import type { AspectRatioConfig, AspectRatioId } from './arch-types';

// Aspect ratio definitions with dimensions
// 画幅比例定义及尺寸
export const ASPECT_RATIOS: Record<AspectRatioId, AspectRatioConfig> = {
  '1:1': {
    id: '1:1',
    labelKey: 'ArchPage.aspectRatios.square',
    width: 1024,
    height: 1024,
    icon: Square,
  },
  '16:9': {
    id: '16:9',
    labelKey: 'ArchPage.aspectRatios.landscape',
    width: 1280,
    height: 720,
    icon: RectangleHorizontal,
  },
  '4:3': {
    id: '4:3',
    labelKey: 'ArchPage.aspectRatios.standard',
    width: 1024,
    height: 768,
    icon: RectangleHorizontal,
  },
  '3:4': {
    id: '3:4',
    labelKey: 'ArchPage.aspectRatios.portrait',
    width: 768,
    height: 1024,
    icon: RectangleVertical,
  },
  '9:16': {
    id: '9:16',
    labelKey: 'ArchPage.aspectRatios.vertical',
    width: 720,
    height: 1280,
    icon: Smartphone,
  },
};

// Get all aspect ratios as array
// 获取所有画幅比例数组
export const ASPECT_RATIO_LIST = Object.values(ASPECT_RATIOS);

// Get aspect ratio by ID
// 根据 ID 获取画幅比例
export function getAspectRatio(id: AspectRatioId): AspectRatioConfig {
  return ASPECT_RATIOS[id];
}

// Get dimensions for aspect ratio
// 获取画幅比例的尺寸
export function getAspectRatioDimensions(id: AspectRatioId): {
  width: number;
  height: number;
} {
  const ratio = ASPECT_RATIOS[id];
  return { width: ratio.width, height: ratio.height };
}

// Default aspect ratio
// 默认画幅比例
export const DEFAULT_ASPECT_RATIO: AspectRatioId = '16:9';
