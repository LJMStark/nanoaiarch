'use client';

import { BlurFade } from '@/components/magicui/blur-fade';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';
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

interface CategoryTabProps {
  isActive: boolean;
  onClick: () => void;
  icon: LucideIcon;
  iconColor?: string;
  label: string;
}

function CategoryTab({
  isActive,
  onClick,
  icon: Icon,
  iconColor,
  label,
}: CategoryTabProps): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-4 py-2 rounded-full',
        'text-sm font-medium whitespace-nowrap',
        'transition-colors',
        isActive
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted hover:bg-muted/80 text-muted-foreground'
      )}
    >
      <Icon
        className="h-4 w-4"
        style={{ color: isActive ? undefined : iconColor }}
      />
      <span>{label}</span>
    </button>
  );
}

export function TemplateGallery({
  category,
  onCategoryChange,
  onTemplateClick,
  className,
}: TemplateGalleryProps): React.ReactElement {
  const t = useTranslations();

  const templates = useMemo(() => getTemplatesByCategory(category), [category]);

  function isFeaturedLarge(template: ArchTemplate, index: number): boolean {
    return Boolean(template.featured && index % 3 === 0);
  }

  return (
    <div className={cn('space-y-6', className)}>
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
        <CategoryTab
          isActive={category === 'all'}
          onClick={() => onCategoryChange('all')}
          icon={LayoutGrid}
          label={t('ArchPage.categories.all')}
        />

        {TEMPLATE_CATEGORY_LIST.map((cat) => (
          <CategoryTab
            key={cat.id}
            isActive={category === cat.id}
            onClick={() => onCategoryChange(cat.id)}
            icon={cat.icon}
            iconColor={cat.color}
            label={t(cat.labelKey as any)}
          />
        ))}
      </div>

      <div
        className={cn(
          'grid gap-4',
          'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
        )}
      >
        {templates.map((template, index) => {
          const isLarge = isFeaturedLarge(template, index);
          return (
            <BlurFade
              key={template.id}
              delay={0.1 + index * 0.05}
              inView
              className={cn('w-full', isLarge && 'sm:col-span-2 sm:row-span-2')}
            >
              <TemplateCard
                template={template}
                onClick={() => onTemplateClick(template)}
                aspectSquare={isLarge}
              />
            </BlurFade>
          );
        })}
      </div>

      {templates.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <LayoutGrid className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <h3 className="font-medium text-lg mb-1">
            {t('ArchPage.gallery.empty')}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t('ArchPage.gallery.emptyDescription')}
          </p>
        </div>
      )}
    </div>
  );
}
