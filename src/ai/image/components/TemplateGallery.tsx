'use client';

// Template gallery with category filtering and masonry layout
// 带分类筛选的模版瀑布流画廊 - 与主站风格一致

import { BlurFade } from '@/components/magicui/blur-fade';
import { cn } from '@/lib/utils';
import { LayoutGrid } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import type { ArchTemplate, TemplateCategoryId } from '../lib/arch-types';
import { TEMPLATE_CATEGORY_LIST } from '../lib/template-categories';
import { getTemplatesByCategory } from '../lib/templates';
import { TemplateCard } from './TemplateCard';

interface TemplateGalleryProps {
  category: TemplateCategoryId | 'all';
  onCategoryChange: (category: TemplateCategoryId | 'all') => void;
  onTemplateClick: (template: ArchTemplate) => void;
  className?: string;
}

export function TemplateGallery({
  category,
  onCategoryChange,
  onTemplateClick,
  className,
}: TemplateGalleryProps) {
  const t = useTranslations();

  // Get templates for current category
  const templates = useMemo(() => getTemplatesByCategory(category), [category]);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Category filter tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {/* All category */}
        <button
          type="button"
          onClick={() => onCategoryChange('all')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-full',
            'text-sm font-medium whitespace-nowrap',
            'transition-colors',
            category === 'all'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted hover:bg-muted/80 text-muted-foreground'
          )}
        >
          <LayoutGrid className="h-4 w-4" />
          <span>{t('ArchPage.categories.all')}</span>
        </button>

        {/* Category tabs */}
        {TEMPLATE_CATEGORY_LIST.map((cat) => {
          const Icon = cat.icon;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onCategoryChange(cat.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-full',
                'text-sm font-medium whitespace-nowrap',
                'transition-colors',
                category === cat.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80 text-muted-foreground'
              )}
            >
              <Icon className="h-4 w-4" style={{ color: category === cat.id ? undefined : cat.color }} />
              <span>{t(cat.labelKey as any)}</span>
            </button>
          );
        })}
      </div>

      {/* Templates grid - masonry-like layout with staggered animations */}
      <div
        className={cn(
          'grid gap-4',
          'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
        )}
      >
        {templates.map((template, index) => (
          <BlurFade
            key={template.id}
            delay={0.1 + index * 0.05}
            inView
            className={cn(
              // Ensure BlurFade takes full width
              'w-full',
              // Create masonry-like effect for featured items
              template.featured && index % 3 === 0 && 'sm:col-span-2 sm:row-span-2',
              template.featured && index % 3 === 0 && '[&_.aspect-\\[4\\/3\\]]:aspect-square'
            )}
          >
            <TemplateCard
              template={template}
              onClick={() => onTemplateClick(template)}
            />
          </BlurFade>
        ))}
      </div>

      {/* Empty state */}
      {templates.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <LayoutGrid className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <h3 className="font-medium text-lg mb-1">{t('ArchPage.gallery.empty')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('ArchPage.gallery.emptyDescription')}
          </p>
        </div>
      )}
    </div>
  );
}
