'use client';

// Animated hero section for the playground
// 动画 Hero 区域

import { NumberTicker } from '@/components/magicui/number-ticker';
import { AnimatedGradientText } from '@/components/magicui/animated-gradient-text';
import { BlurFade } from '@/components/magicui/blur-fade';
import { cn } from '@/lib/utils';
import { LayoutTemplate, Sparkles, Zap } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface PlaygroundHeroProps {
  className?: string;
}

export function PlaygroundHero({ className }: PlaygroundHeroProps) {
  const t = useTranslations('ArchPage');

  return (
    <div className={cn('text-center py-16 px-4', className)}>
      {/* Main title with gradient animation */}
      <BlurFade delay={0.1}>
        <AnimatedGradientText className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
          {t('hero.title')}
        </AnimatedGradientText>
      </BlurFade>

      {/* Subtitle */}
      <BlurFade delay={0.2}>
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-12">
          {t('hero.subtitle')}
        </p>
      </BlurFade>

      {/* Stats row */}
      <BlurFade delay={0.3}>
        <div className="flex items-center justify-center gap-8 md:gap-16 mb-12">
          <StatItem
            icon={Sparkles}
            value={1234}
            label={t('hero.stats.generated')}
            color="#8b5cf6"
          />
          <StatItem
            icon={Zap}
            value={89}
            suffix="%"
            label={t('hero.stats.accuracy')}
            color="#22c55e"
          />
          <StatItem
            icon={LayoutTemplate}
            value={26}
            suffix="+"
            label={t('hero.stats.templates')}
            color="#3b82f6"
          />
        </div>
      </BlurFade>

      {/* Quote */}
      <BlurFade delay={0.4}>
        <blockquote className="max-w-xl mx-auto">
          <p className="text-lg italic text-muted-foreground">
            "{t('hero.quote')}"
          </p>
          <footer className="mt-2 text-sm text-muted-foreground/60">
            — Louis Kahn
          </footer>
        </blockquote>
      </BlurFade>
    </div>
  );
}

// Stat item component
function StatItem({
  icon: Icon,
  value,
  suffix,
  label,
  color,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  value: number;
  suffix?: string;
  label: string;
  color: string;
}) {
  return (
    <div className="flex flex-col items-center">
      <div
        className="w-12 h-12 rounded-xl mb-3 flex items-center justify-center"
        style={{ backgroundColor: `${color}20` }}
      >
        <Icon className="h-6 w-6" style={{ color }} />
      </div>
      <div className="flex items-baseline gap-0.5">
        <NumberTicker
          value={value}
          className="text-2xl md:text-3xl font-bold"
        />
        {suffix && (
          <span className="text-2xl md:text-3xl font-bold">{suffix}</span>
        )}
      </div>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}
