'use client';

// Hero Bento Card - Large featured template showcase
// Hero Bento 卡片 - 大尺寸精选模板展示

import { cn } from '@/lib/utils';
import { motion } from 'motion/react';
import { ArrowRight, Building2, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { useState } from 'react';
import type { ArchTemplate } from '../../lib/arch-types';
import { BentoCard } from './BentoCard';
import { BENTO_PRESETS } from './BentoGrid';

interface HeroBentoCardProps {
  featuredTemplate?: ArchTemplate | null;
  onTemplateClick?: (template: ArchTemplate) => void;
  className?: string;
}

/**
 * HeroBentoCard - Large showcase card for the featured template
 *
 * Features:
 * - Animated gradient background (Aurora effect)
 * - Featured template preview image
 * - Call-to-action overlay
 * - Responsive sizing (takes 7 cols on desktop)
 */
export function HeroBentoCard({
  featuredTemplate,
  onTemplateClick,
  className,
}: HeroBentoCardProps) {
  const t = useTranslations('ArchPage');
  const tRoot = useTranslations(); // Root translator for full key paths
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <BentoCard
      variant="glass"
      onClick={featuredTemplate ? () => onTemplateClick?.(featuredTemplate) : undefined}
      hoverGlow
      hoverScale
      animationDelay={0}
      className={cn(
        BENTO_PRESETS.hero,
        'group relative min-h-[280px] lg:min-h-[320px]',
        'overflow-hidden',
        className
      )}
    >
      {/* Animated Aurora Background */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Primary gradient orb */}
        <motion.div
          animate={{
            x: [0, 30, 0],
            y: [0, -20, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className={cn(
            'absolute -top-1/4 -left-1/4 w-3/4 h-3/4',
            'rounded-full blur-3xl opacity-30',
            'bg-gradient-to-br from-primary via-primary/50 to-transparent'
          )}
        />
        {/* Secondary gradient orb */}
        <motion.div
          animate={{
            x: [0, -20, 0],
            y: [0, 30, 0],
            scale: [1, 1.05, 1],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 1,
          }}
          className={cn(
            'absolute -bottom-1/4 -right-1/4 w-2/3 h-2/3',
            'rounded-full blur-3xl opacity-20',
            'bg-gradient-to-tl from-violet-500 via-violet-500/50 to-transparent'
          )}
        />
        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      {/* Content Layer */}
      <div className="relative z-10 h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-primary" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">
              {t('hero.badge')}
            </span>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-white/10 text-xs">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>Featured</span>
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 flex flex-col lg:flex-row gap-4 lg:gap-6">
          {/* Text content */}
          <div className="flex-1 flex flex-col justify-center">
            <h2 className="text-2xl lg:text-3xl xl:text-4xl font-bold mb-2 lg:mb-3 font-bricolage-grotesque">
              {t('hero.title')}
            </h2>
            <p className="text-sm lg:text-base text-muted-foreground mb-4 line-clamp-2 lg:line-clamp-3">
              {t('hero.subtitle')}
            </p>

            {/* CTA */}
            <div className="flex items-center gap-2 text-primary font-medium group/cta">
              <span>{featuredTemplate ? 'Try this template' : 'Start Creating'}</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover/cta:translate-x-1" />
            </div>
          </div>

          {/* Preview image */}
          {featuredTemplate && (
            <div className="relative w-full lg:w-2/5 h-32 lg:h-auto rounded-xl overflow-hidden bg-muted/50">
              <Image
                src={featuredTemplate.previewImage}
                alt={tRoot(featuredTemplate.titleKey as any)}
                fill
                className={cn(
                  'object-cover transition-all duration-700',
                  imageLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-105',
                  'group-hover:scale-110'
                )}
                onLoad={() => setImageLoaded(true)}
              />
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
              {/* Template name badge */}
              <div className="absolute bottom-2 left-2 px-2 py-1 rounded-md bg-black/50 backdrop-blur-sm">
                <span className="text-xs text-white font-medium">
                  {tRoot(featuredTemplate.titleKey as any)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hover border glow */}
      <div
        className={cn(
          'absolute inset-0 rounded-2xl lg:rounded-3xl opacity-0 transition-opacity duration-300',
          'border border-primary/50',
          'group-hover:opacity-100'
        )}
      />
    </BentoCard>
  );
}
