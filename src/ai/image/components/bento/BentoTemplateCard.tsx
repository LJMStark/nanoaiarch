'use client';

// Bento Template Card - Template card for Bento grid layouts
// Bento 模板卡片 - 适配 Bento 网格布局的模板卡片
// 统一尺寸设计，移除 featured 大卡片变体

import { BorderBeam } from '@/components/magicui/border-beam';
import { cn } from '@/lib/utils';
import { ImageIcon, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { useState } from 'react';
import type { ArchTemplate } from '../../lib/arch-types';
import { getTemplateCategory } from '../../lib/template-categories';
import { BentoCard } from './BentoCard';
import { BENTO_PRESETS } from './BentoGrid';

interface BentoTemplateCardProps {
  template: ArchTemplate;
  onClick: () => void;
  animationDelay?: number;
  className?: string;
}

/**
 * BentoTemplateCard - Template card optimized for Bento grid
 *
 * Features:
 * - Unified size for all cards (no featured variation)
 * - Category badge with color
 * - Featured/Input indicators as badges only
 * - Hover effects with BorderBeam
 */
export function BentoTemplateCard({
  template,
  onClick,
  animationDelay = 0,
  className,
}: BentoTemplateCardProps) {
  const t = useTranslations();
  const [imageError, setImageError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const category = getTemplateCategory(template.categoryId);
  const CategoryIcon = category.icon;

  return (
    <BentoCard
      variant="default"
      onClick={onClick}
      hoverGlow
      hoverScale
      animationDelay={animationDelay}
      className={cn(
        BENTO_PRESETS.template,
        'p-0 group overflow-hidden',
        className
      )}
    >
      <button
        type="button"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="w-full h-full relative min-h-[160px]"
      >
        {/* Image */}
        <div className="absolute inset-0">
          {imageError ? (
            <div className="absolute inset-0 flex items-center justify-center bg-muted">
              <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
            </div>
          ) : (
            <Image
              src={template.previewImage}
              alt={t(template.titleKey as any)}
              fill
              className={cn(
                'object-cover transition-transform duration-500',
                'group-hover:scale-105'
              )}
              onError={() => setImageError(true)}
            />
          )}

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        </div>

        {/* Category badge - top left */}
        <div
          className={cn(
            'absolute top-2 left-2 z-10',
            'flex items-center gap-1 px-1.5 py-0.5',
            'rounded bg-black/50 backdrop-blur-sm',
            'text-[10px] font-medium text-white'
          )}
        >
          <CategoryIcon className="h-3 w-3" style={{ color: category.color }} />
        </div>

        {/* Featured badge - top right */}
        {template.featured && (
          <div
            className={cn(
              'absolute top-2 right-2 z-10',
              'flex items-center gap-0.5 px-1.5 py-0.5',
              'rounded bg-primary text-primary-foreground',
              'text-[10px] font-medium'
            )}
          >
            <Sparkles className="h-2.5 w-2.5" />
          </div>
        )}

        {/* Requires input indicator */}
        {template.requiresInput && !template.featured && (
          <div
            className={cn(
              'absolute top-2 right-2 z-10',
              'flex items-center gap-0.5 px-1.5 py-0.5',
              'rounded bg-black/50 backdrop-blur-sm',
              'text-[10px] text-white'
            )}
          >
            <ImageIcon className="h-2.5 w-2.5" />
          </div>
        )}

        {/* Content overlay - bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-2.5 z-10">
          <h3 className="font-medium text-white text-sm leading-tight line-clamp-2">
            {t(template.titleKey as any)}
          </h3>
        </div>

        {/* BorderBeam on hover */}
        {isHovered && (
          <BorderBeam
            duration={4}
            size={100}
            className="from-transparent via-primary/50 to-transparent"
          />
        )}
      </button>
    </BentoCard>
  );
}
