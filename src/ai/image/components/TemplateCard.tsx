'use client';

// Template card component for gallery display
// 画廊中的模版卡片组件 - 与主站风格一致

import { BorderBeam } from '@/components/magicui/border-beam';
import { cn } from '@/lib/utils';
import { ImageIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { useState } from 'react';
import type { ArchTemplate } from '../lib/arch-types';
import { getTemplateCategory } from '../lib/template-categories';

interface TemplateCardProps {
  template: ArchTemplate;
  onClick: () => void;
  className?: string;
}

export function TemplateCard({
  template,
  onClick,
  className,
}: TemplateCardProps) {
  const t = useTranslations();
  const [imageError, setImageError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const category = getTemplateCategory(template.categoryId);
  const CategoryIcon = category.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        // Base styles - w-full ensures button takes grid cell width
        'group relative w-full overflow-hidden rounded-xl',
        'bg-background border border-border/50',
        'transition-all duration-300',
        // Hover effects
        'hover:border-primary/30 hover:shadow-xl hover:shadow-primary/10',
        'hover:scale-[1.02]',
        // Focus styles
        'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
        // Featured style
        template.featured && 'ring-1 ring-primary/20',
        className
      )}
    >
      {/* Image container - explicit height for aspect ratio */}
      <div className="aspect-[4/3] relative w-full overflow-hidden bg-muted">
        {imageError ? (
          // Fallback for missing images
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <ImageIcon className="h-12 w-12 text-muted-foreground/30" />
          </div>
        ) : (
          <Image
            src={template.previewImage}
            alt={t(template.titleKey as any)}
            fill
            className={cn(
              'object-cover transition-transform duration-500',
              'group-hover:scale-110'
            )}
            onError={() => setImageError(true)}
          />
        )}

        {/* Gradient overlay */}
        <div
          className={cn(
            'absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent',
            'opacity-60 group-hover:opacity-80 transition-opacity'
          )}
        />

        {/* Category badge */}
        <div
          className={cn(
            'absolute top-3 left-3',
            'flex items-center gap-1.5 px-2 py-1',
            'rounded-full bg-black/50 backdrop-blur-sm',
            'text-xs font-medium text-white'
          )}
        >
          <CategoryIcon className="h-3 w-3" style={{ color: category.color }} />
          <span>{t(category.labelKey as any)}</span>
        </div>

        {/* Featured badge */}
        {template.featured && (
          <div
            className={cn(
              'absolute top-3 right-3',
              'px-2 py-1 rounded-full',
              'bg-primary text-primary-foreground',
              'text-xs font-medium'
            )}
          >
            Featured
          </div>
        )}

        {/* Requires input indicator */}
        {template.requiresInput && (
          <div
            className={cn(
              'absolute top-3 right-3',
              !template.featured && 'flex items-center gap-1 px-2 py-1',
              !template.featured && 'rounded-full bg-black/50 backdrop-blur-sm',
              !template.featured && 'text-xs text-white',
              template.featured && 'hidden'
            )}
          >
            <ImageIcon className="h-3 w-3" />
            <span>Input</span>
          </div>
        )}

        {/* Content overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h3 className="font-semibold text-white text-sm mb-1">
            {t(template.titleKey as any)}
          </h3>
          <p
            className={cn(
              'text-xs text-white/70 line-clamp-2',
              'opacity-0 group-hover:opacity-100',
              'transform translate-y-2 group-hover:translate-y-0',
              'transition-all duration-300'
            )}
          >
            {t(template.descriptionKey as any)}
          </p>
        </div>
      </div>

      {/* BorderBeam effect on hover - matches main site style */}
      {isHovered && (
        <BorderBeam
          duration={4}
          size={150}
          className="from-transparent via-primary/50 to-transparent"
        />
      )}
    </button>
  );
}
