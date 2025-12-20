'use client';

// Category Card - Small category entry card
// 分类卡片 - 小型分类入口卡片

import { cn } from '@/lib/utils';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import type { TemplateCategory, TemplateCategoryId } from '../../lib/arch-types';
import { getTemplatesByCategory } from '../../lib/templates';
import { BentoCard } from './BentoCard';
import { BENTO_PRESETS } from './BentoGrid';

interface CategoryCardProps {
  category: TemplateCategory;
  isSelected?: boolean;
  onClick?: () => void;
  animationDelay?: number;
  className?: string;
}

/**
 * CategoryCard - Small card for category navigation
 *
 * Features:
 * - Category icon with color accent
 * - Template count badge
 * - Selected state highlight
 * - Hover glow effect
 */
export function CategoryCard({
  category,
  isSelected = false,
  onClick,
  animationDelay = 0,
  className,
}: CategoryCardProps) {
  const t = useTranslations();
  const Icon = category.icon;

  // Count templates in this category
  const templateCount = useMemo(() => {
    return getTemplatesByCategory(category.id).length;
  }, [category.id]);

  return (
    <BentoCard
      variant={isSelected ? 'gradient' : 'default'}
      onClick={onClick}
      hoverGlow
      hoverScale
      animationDelay={animationDelay}
      className={cn(
        BENTO_PRESETS.category,
        'flex flex-col justify-between min-h-[100px]',
        isSelected && 'ring-2 ring-primary/50',
        className
      )}
    >
      {/* Icon with colored background */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center mb-2"
        style={{ backgroundColor: `${category.color}20` }}
      >
        <Icon
          className="w-5 h-5"
          style={{ color: category.color }}
        />
      </div>

      {/* Label and count */}
      <div className="flex-1 flex flex-col justify-end">
        <h4 className="font-medium text-sm line-clamp-1">
          {t(category.labelKey as any)}
        </h4>
        <p className="text-xs text-muted-foreground mt-0.5">
          {templateCount} templates
        </p>
      </div>

      {/* Selected indicator */}
      {isSelected && (
        <motion.div
          layoutId="category-indicator"
          className="absolute inset-0 rounded-2xl lg:rounded-3xl border-2 border-primary pointer-events-none"
          transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
        />
      )}
    </BentoCard>
  );
}

// All Categories Card - Shows all templates
// 全部分类卡片
interface AllCategoriesCardProps {
  isSelected?: boolean;
  onClick?: () => void;
  totalCount: number;
  animationDelay?: number;
  className?: string;
}

export function AllCategoriesCard({
  isSelected = false,
  onClick,
  totalCount,
  animationDelay = 0,
  className,
}: AllCategoriesCardProps) {
  const t = useTranslations('ArchPage');

  return (
    <BentoCard
      variant={isSelected ? 'gradient' : 'default'}
      onClick={onClick}
      hoverGlow
      hoverScale
      animationDelay={animationDelay}
      className={cn(
        BENTO_PRESETS.category,
        'flex flex-col justify-between min-h-[100px]',
        isSelected && 'ring-2 ring-primary/50',
        className
      )}
    >
      {/* Grid icon */}
      <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-2 bg-primary/10">
        <svg
          className="w-5 h-5 text-primary"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      </div>

      {/* Label and count */}
      <div className="flex-1 flex flex-col justify-end">
        <h4 className="font-medium text-sm">{t('categories.all')}</h4>
        <p className="text-xs text-muted-foreground mt-0.5">
          {totalCount} templates
        </p>
      </div>

      {/* Selected indicator */}
      {isSelected && (
        <motion.div
          layoutId="category-indicator"
          className="absolute inset-0 rounded-2xl lg:rounded-3xl border-2 border-primary pointer-events-none"
          transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
        />
      )}
    </BentoCard>
  );
}
