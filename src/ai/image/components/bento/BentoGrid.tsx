'use client';

// Responsive Bento Grid container component
// 响应式 Bento 网格容器组件

import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface BentoGridProps {
  children: ReactNode;
  className?: string;
}

/**
 * BentoGrid - A responsive grid container for Bento-style layouts
 *
 * Grid System:
 * - Desktop (xl+): 12 columns
 * - Tablet (lg): 8 columns
 * - Mobile (md): 6 columns
 * - Small (sm): 4 columns
 *
 * Children should use BentoCard with appropriate colSpan/rowSpan
 */
export function BentoGrid({ children, className }: BentoGridProps) {
  return (
    <div
      className={cn(
        // Base grid setup
        'grid gap-4 lg:gap-5',
        // Responsive columns
        'grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12',
        // Auto rows for consistent sizing
        'auto-rows-[minmax(120px,auto)]',
        className
      )}
    >
      {children}
    </div>
  );
}

// Grid span utilities for responsive design
// 网格跨度工具类

export type BentoSpan = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type BentoRowSpan = 1 | 2 | 3;

interface BentoSpanConfig {
  // Column spans at different breakpoints
  cols?: BentoSpan;
  colsSm?: BentoSpan;
  colsMd?: BentoSpan;
  colsLg?: BentoSpan;
  // Row spans
  rows?: BentoRowSpan;
  rowsSm?: BentoRowSpan;
  rowsMd?: BentoRowSpan;
  rowsLg?: BentoRowSpan;
}

/**
 * Generate responsive span classes for BentoCard
 * 为 BentoCard 生成响应式跨度类名
 */
export function getBentoSpanClasses(config: BentoSpanConfig): string {
  const classes: string[] = [];

  // Column spans
  if (config.cols) classes.push(`col-span-${config.cols}`);
  if (config.colsSm) classes.push(`sm:col-span-${config.colsSm}`);
  if (config.colsMd) classes.push(`md:col-span-${config.colsMd}`);
  if (config.colsLg) classes.push(`lg:col-span-${config.colsLg}`);

  // Row spans
  if (config.rows) classes.push(`row-span-${config.rows}`);
  if (config.rowsSm) classes.push(`sm:row-span-${config.rowsSm}`);
  if (config.rowsMd) classes.push(`md:row-span-${config.rowsMd}`);
  if (config.rowsLg) classes.push(`lg:row-span-${config.rowsLg}`);

  return classes.join(' ');
}

// Predefined span presets for common card sizes
// 预定义的常用卡片尺寸

export const BENTO_PRESETS = {
  // Hero card - large featured area
  hero: getBentoSpanClasses({
    cols: 4,
    colsSm: 6,
    colsMd: 5,
    colsLg: 7,
    rows: 2,
    rowsLg: 2,
  }),
  // Quick action card - prominent but secondary
  quickAction: getBentoSpanClasses({
    cols: 4,
    colsSm: 6,
    colsMd: 3,
    colsLg: 5,
    rows: 2,
    rowsLg: 2,
  }),
  // Category card - small square
  category: getBentoSpanClasses({
    cols: 2,
    colsSm: 2,
    colsMd: 2,
    colsLg: 2,
    rows: 1,
  }),
  // Stats card - wide horizontal
  stats: getBentoSpanClasses({
    cols: 4,
    colsSm: 6,
    colsMd: 4,
    colsLg: 6,
    rows: 1,
  }),
  // Template card - uniform size for all templates
  // 4 columns on lg (12/4=3 cards per row)
  template: getBentoSpanClasses({
    cols: 2,
    colsSm: 2,
    colsMd: 2,
    colsLg: 3,
    rows: 1,
  }),
} as const;
